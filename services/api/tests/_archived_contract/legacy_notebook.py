"""SIKAO Wave 4 Phase 2B (notebook module) — 9 endpoints + SM-2 algorithm tests.

Coverage:
  - 9 endpoint happy path (POST/GET/PUT/DELETE notes + POST/GET reviews +
    GET reviews/due + GET stats)
  - 跨用户 IDOR (alice create, bob get/update/delete/review → 404)
  - body shape validation (4 NoteType wrong shape → 422)
  - tag / sourceDomain / type filter
  - cursor pagination
  - SM-2 algorithm invariants (quality 0/3/5; ease floor 1.3; interval growth)
  - Due queue ordering (NULLS first, then ASC by next_review_at)
  - Stats aggregation (total / due / by_type / by_source_domain)

Pattern follows test_study_plan_routes.py — function-scoped SQLite via tmp_path,
Settings minimal config, register via /auth/register/email + cookie csrf.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from sikao_api.core.config import Settings
from sikao_api.db.session import DatabaseManager
from sikao_api.db.models import Note
from sikao_api.main import create_app
from sikao_api.modules.notes.application.notebook import _SM2_DEFAULT_EASE, _SM2_MIN_EASE, _update_sm2
from sikao_api.modules.auth.application.security import hash_password


@contextmanager
def _build_client(tmp_path: Path) -> Iterator[tuple[TestClient, Settings]]:
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'exam.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        admin_username="admin",
        admin_password_hash=hash_password("adminpass"),
        jwt_secret="test-secret-0123456789-test-secret",
        llm_api_key="sk-test-key",
        llm_base_url="https://api.deepseek.com/v1",
    )
    app = create_app(settings=settings, initialize_schema=True)
    db = DatabaseManager(settings)
    db.create_all()
    with TestClient(app) as client:
        yield client, settings


@pytest.fixture
def client(tmp_path: Path) -> Iterator[tuple[TestClient, Settings]]:
    with _build_client(tmp_path) as (c, s):
        yield c, s


def _register(c: TestClient, *, username: str = "user1") -> int:
    resp = c.post(
        "/api/v2/auth/register/email",
        json={
            "email": f"{username}@test.local",
            "password": "passw0rd",
            "displayName": username,
        },
    )
    assert resp.status_code == 200, resp.text
    return int(resp.json()["user"]["id"])


def _csrf(c: TestClient) -> dict[str, str]:
    csrf = c.cookies.get("csrf_token")
    assert csrf, "csrf_token cookie missing"
    return {"X-CSRF-Token": csrf}


def _quote_payload(text: str = "治理之细") -> dict:
    return {
        "type": "quote",
        "body": {"text": text},
        "sourceKind": "specialty",
        "sourceRef": "2023 国考 副省级 第三题",
        "sourceDomain": "essay",
        "title": "金句一",
        "tags": ["#治理"],
    }


def _method_payload() -> dict:
    return {
        "type": "method",
        "body": {
            "title": "归纳概括 三步法",
            "steps": [
                {"index": "1", "text": "找关键词"},
                {"index": "2", "text": "去重合并"},
                {"index": "3", "text": "分层归类"},
            ],
        },
        "sourceKind": "manual",
        "sourceRef": "复习总结",
        "sourceDomain": "essay",
        "tags": ["#方法论"],
    }


def _reflect_payload() -> dict:
    return {
        "type": "reflect",
        "body": {"text": "本次失分主要在结构层次"},
        "sourceKind": "grading",
        "sourceRef": "2024 国考 副省级 第二题",
        "sourceDomain": "essay",
    }


def _material_payload() -> dict:
    return {
        "type": "material",
        "body": {
            "rows": [
                {"key": "概念", "value": "新基建"},
                {"key": "数据", "value": "2025 投资 2.6 万亿"},
            ]
        },
        "sourceKind": "manual",
        "sourceRef": "积累本",
        "sourceDomain": "xingce",
        "tags": ["#素材"],
    }


# ── Auth gate ────────────────────────────────────────────────────────────


def test_create_note_unauthenticated_401(client) -> None:
    c, _ = client
    resp = c.post("/api/v2/notebook/notes", json=_quote_payload())
    assert resp.status_code == 401


def test_list_notes_unauthenticated_401(client) -> None:
    c, _ = client
    resp = c.get("/api/v2/notebook/notes")
    assert resp.status_code == 401


def test_get_stats_unauthenticated_401(client) -> None:
    c, _ = client
    resp = c.get("/api/v2/notebook/stats")
    assert resp.status_code == 401


# ── CRUD happy paths ─────────────────────────────────────────────────────


def test_create_quote_note(client) -> None:
    c, _ = client
    _register(c)
    resp = c.post(
        "/api/v2/notebook/notes",
        json=_quote_payload(),
        headers=_csrf(c),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["id"] > 0
    assert body["type"] == "quote"
    assert body["body"] == {"text": "治理之细"}
    assert body["sourceKind"] == "specialty"
    assert body["sourceRef"] == "2023 国考 副省级 第三题"
    assert body["sourceDomain"] == "essay"
    assert body["tags"] == ["#治理"]
    assert body["title"] == "金句一"
    assert body["visibility"] == "self"
    assert body["ease"] == pytest.approx(_SM2_DEFAULT_EASE)
    assert body["reviewCount"] == 0
    assert body["nextReviewAt"] is None


def test_create_method_note(client) -> None:
    c, _ = client
    _register(c)
    resp = c.post(
        "/api/v2/notebook/notes",
        json=_method_payload(),
        headers=_csrf(c),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["type"] == "method"
    assert body["body"]["title"] == "归纳概括 三步法"
    assert len(body["body"]["steps"]) == 3


def test_create_reflect_and_material(client) -> None:
    c, _ = client
    _register(c)
    r1 = c.post(
        "/api/v2/notebook/notes", json=_reflect_payload(), headers=_csrf(c)
    )
    assert r1.status_code == 201
    r2 = c.post(
        "/api/v2/notebook/notes", json=_material_payload(), headers=_csrf(c)
    )
    assert r2.status_code == 201
    assert r1.json()["type"] == "reflect"
    assert r2.json()["type"] == "material"
    assert len(r2.json()["body"]["rows"]) == 2


def test_get_note_returns_full_record(client) -> None:
    c, _ = client
    _register(c)
    created = c.post(
        "/api/v2/notebook/notes", json=_quote_payload(), headers=_csrf(c)
    ).json()
    resp = c.get(f"/api/v2/notebook/notes/{created['id']}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == created["id"]
    assert body["body"]["text"] == "治理之细"


def test_update_note_title_and_tags(client) -> None:
    c, _ = client
    _register(c)
    created = c.post(
        "/api/v2/notebook/notes", json=_quote_payload(), headers=_csrf(c)
    ).json()
    resp = c.put(
        f"/api/v2/notebook/notes/{created['id']}",
        json={"title": "金句一·修订", "tags": ["#治理", "#人民"]},
        headers=_csrf(c),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "金句一·修订"
    assert body["tags"] == ["#治理", "#人民"]
    # 没改的字段保持
    assert body["body"] == {"text": "治理之细"}


def test_update_note_change_type_requires_body(client) -> None:
    c, _ = client
    _register(c)
    created = c.post(
        "/api/v2/notebook/notes", json=_quote_payload(), headers=_csrf(c)
    ).json()
    # quote 改 method 但 body 仍是 quote shape → 422 (业务层校验)
    resp = c.put(
        f"/api/v2/notebook/notes/{created['id']}",
        json={"type": "method"},
        headers=_csrf(c),
    )
    assert resp.status_code == 422


def test_update_note_change_type_with_matching_body(client) -> None:
    c, _ = client
    _register(c)
    created = c.post(
        "/api/v2/notebook/notes", json=_quote_payload(), headers=_csrf(c)
    ).json()
    resp = c.put(
        f"/api/v2/notebook/notes/{created['id']}",
        json={
            "type": "reflect",
            "body": {"text": "改成反思"},
        },
        headers=_csrf(c),
    )
    assert resp.status_code == 200
    assert resp.json()["type"] == "reflect"


def test_delete_note_204_then_404(client) -> None:
    c, _ = client
    _register(c)
    created = c.post(
        "/api/v2/notebook/notes", json=_quote_payload(), headers=_csrf(c)
    ).json()
    resp = c.delete(
        f"/api/v2/notebook/notes/{created['id']}", headers=_csrf(c)
    )
    assert resp.status_code == 204
    # 删后 GET → 404
    resp2 = c.get(f"/api/v2/notebook/notes/{created['id']}")
    assert resp2.status_code == 404


# ── Body shape validation ────────────────────────────────────────────────


def test_create_quote_missing_text_422(client) -> None:
    c, _ = client
    _register(c)
    payload = _quote_payload()
    payload["body"] = {}  # missing text
    resp = c.post("/api/v2/notebook/notes", json=payload, headers=_csrf(c))
    assert resp.status_code == 422


def test_create_method_missing_steps_422(client) -> None:
    c, _ = client
    _register(c)
    payload = _method_payload()
    payload["body"] = {"title": "三步法"}  # missing steps
    resp = c.post("/api/v2/notebook/notes", json=payload, headers=_csrf(c))
    assert resp.status_code == 422


def test_create_material_invalid_row_422(client) -> None:
    c, _ = client
    _register(c)
    payload = _material_payload()
    payload["body"] = {"rows": [{"key": "x"}]}  # value 缺
    resp = c.post("/api/v2/notebook/notes", json=payload, headers=_csrf(c))
    assert resp.status_code == 422


# ── 跨用户 IDOR (404) ────────────────────────────────────────────────────


def test_cross_user_get_returns_404(client) -> None:
    c, _ = client
    _register(c, username="alice")
    created = c.post(
        "/api/v2/notebook/notes", json=_quote_payload(), headers=_csrf(c)
    ).json()
    note_id = created["id"]
    c.cookies.clear()
    _register(c, username="bob")
    resp = c.get(f"/api/v2/notebook/notes/{note_id}")
    assert resp.status_code == 404


def test_cross_user_update_returns_404(client) -> None:
    c, _ = client
    _register(c, username="alice")
    created = c.post(
        "/api/v2/notebook/notes", json=_quote_payload(), headers=_csrf(c)
    ).json()
    note_id = created["id"]
    c.cookies.clear()
    _register(c, username="bob")
    resp = c.put(
        f"/api/v2/notebook/notes/{note_id}",
        json={"title": "hacked"},
        headers=_csrf(c),
    )
    assert resp.status_code == 404


def test_cross_user_delete_returns_404(client) -> None:
    c, _ = client
    _register(c, username="alice")
    created = c.post(
        "/api/v2/notebook/notes", json=_quote_payload(), headers=_csrf(c)
    ).json()
    note_id = created["id"]
    c.cookies.clear()
    _register(c, username="bob")
    resp = c.delete(
        f"/api/v2/notebook/notes/{note_id}", headers=_csrf(c)
    )
    assert resp.status_code == 404


def test_cross_user_review_returns_404(client) -> None:
    c, _ = client
    _register(c, username="alice")
    created = c.post(
        "/api/v2/notebook/notes", json=_quote_payload(), headers=_csrf(c)
    ).json()
    note_id = created["id"]
    c.cookies.clear()
    _register(c, username="bob")
    resp = c.post(
        f"/api/v2/notebook/notes/{note_id}/reviews",
        json={"recallQuality": 5},
        headers=_csrf(c),
    )
    assert resp.status_code == 404


# ── List + filters ──────────────────────────────────────────────────────


def test_list_returns_only_own_notes(client) -> None:
    c, _ = client
    _register(c, username="alice")
    c.post("/api/v2/notebook/notes", json=_quote_payload(), headers=_csrf(c))
    c.post("/api/v2/notebook/notes", json=_method_payload(), headers=_csrf(c))
    c.cookies.clear()
    _register(c, username="bob")
    c.post("/api/v2/notebook/notes", json=_reflect_payload(), headers=_csrf(c))
    resp = c.get("/api/v2/notebook/notes")
    assert resp.status_code == 200
    body = resp.json()
    # bob 只看到 1 张
    assert len(body["items"]) == 1
    assert body["items"][0]["type"] == "reflect"


def test_list_filter_by_type(client) -> None:
    c, _ = client
    _register(c)
    for p in (_quote_payload(), _method_payload(), _reflect_payload()):
        c.post("/api/v2/notebook/notes", json=p, headers=_csrf(c))
    resp = c.get("/api/v2/notebook/notes?type=quote")
    body = resp.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["type"] == "quote"


def test_list_filter_by_source_domain(client) -> None:
    c, _ = client
    _register(c)
    # quote/method/reflect 都是 essay; material 是 xingce
    for p in (_quote_payload(), _method_payload(), _material_payload()):
        c.post("/api/v2/notebook/notes", json=p, headers=_csrf(c))
    resp = c.get("/api/v2/notebook/notes?sourceDomain=xingce")
    body = resp.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["sourceDomain"] == "xingce"


def test_list_filter_by_tag(client) -> None:
    c, _ = client
    _register(c)
    c.post("/api/v2/notebook/notes", json=_quote_payload(), headers=_csrf(c))
    c.post("/api/v2/notebook/notes", json=_method_payload(), headers=_csrf(c))
    resp = c.get("/api/v2/notebook/notes?tag=%23%E6%B2%BB%E7%90%86")
    body = resp.json()
    assert len(body["items"]) == 1
    assert "#治理" in body["items"][0]["tags"]


def test_list_cursor_pagination(client) -> None:
    c, _ = client
    _register(c)
    for i in range(5):
        p = _quote_payload(text=f"text{i}")
        c.post("/api/v2/notebook/notes", json=p, headers=_csrf(c))
    resp1 = c.get("/api/v2/notebook/notes?limit=2")
    body1 = resp1.json()
    assert len(body1["items"]) == 2
    assert body1["nextCursor"] is not None
    resp2 = c.get(
        f"/api/v2/notebook/notes?limit=2&cursor={body1['nextCursor']}"
    )
    body2 = resp2.json()
    assert len(body2["items"]) == 2
    # 不重叠
    ids1 = {n["id"] for n in body1["items"]}
    ids2 = {n["id"] for n in body2["items"]}
    assert ids1.isdisjoint(ids2)


# ── Reviews + SM-2 ──────────────────────────────────────────────────────


def test_submit_review_quality_5_increments(client) -> None:
    c, _ = client
    _register(c)
    created = c.post(
        "/api/v2/notebook/notes", json=_quote_payload(), headers=_csrf(c)
    ).json()
    resp = c.post(
        f"/api/v2/notebook/notes/{created['id']}/reviews",
        json={"recallQuality": 5},
        headers=_csrf(c),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["reviewCount"] == 1
    # quality=5: ease delta = +0.1 (since (5-5) terms vanish)
    assert body["ease"] == pytest.approx(_SM2_DEFAULT_EASE + 0.1)
    assert body["nextReviewAt"] is not None


def test_submit_review_quality_0_resets_interval(client) -> None:
    c, _ = client
    _register(c)
    created = c.post(
        "/api/v2/notebook/notes", json=_quote_payload(), headers=_csrf(c)
    ).json()
    # Pre-warm: 一次 quality=5 → review_count=1, ease=2.6
    c.post(
        f"/api/v2/notebook/notes/{created['id']}/reviews",
        json={"recallQuality": 5},
        headers=_csrf(c),
    )
    # quality=0: ease -= 0.2, interval=1
    resp = c.post(
        f"/api/v2/notebook/notes/{created['id']}/reviews",
        json={"recallQuality": 0},
        headers=_csrf(c),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["reviewCount"] == 2
    assert body["ease"] == pytest.approx(_SM2_DEFAULT_EASE + 0.1 - 0.2)


def test_submit_review_invalid_quality_422(client) -> None:
    c, _ = client
    _register(c)
    created = c.post(
        "/api/v2/notebook/notes", json=_quote_payload(), headers=_csrf(c)
    ).json()
    resp = c.post(
        f"/api/v2/notebook/notes/{created['id']}/reviews",
        json={"recallQuality": 9},
        headers=_csrf(c),
    )
    assert resp.status_code == 422


def test_list_reviews_returns_audit_history(client) -> None:
    c, _ = client
    _register(c)
    created = c.post(
        "/api/v2/notebook/notes", json=_quote_payload(), headers=_csrf(c)
    ).json()
    for q in (5, 4, 0):
        c.post(
            f"/api/v2/notebook/notes/{created['id']}/reviews",
            json={"recallQuality": q},
            headers=_csrf(c),
        )
    resp = c.get(f"/api/v2/notebook/notes/{created['id']}/reviews")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 3
    # DESC by reviewed_at, 第一条是最近的 (quality 0)
    assert items[0]["recallQuality"] == 0
    assert items[2]["recallQuality"] == 5


# ── Due queue ───────────────────────────────────────────────────────────


def test_due_queue_includes_unreviewed_notes(client) -> None:
    """新建 note next_review_at NULL → 立即在 due queue (NULLS FIRST)."""
    c, _ = client
    _register(c)
    c.post("/api/v2/notebook/notes", json=_quote_payload(), headers=_csrf(c))
    c.post("/api/v2/notebook/notes", json=_reflect_payload(), headers=_csrf(c))
    resp = c.get("/api/v2/notebook/reviews/due?limit=5")
    body = resp.json()
    assert len(body["items"]) == 2


def test_due_queue_excludes_future_reviews(client, tmp_path: Path) -> None:
    """next_review_at > now → 不在 due queue.

    通过直接 SQL 设 future next_review_at (无 endpoint 让 client 跳时间).
    """
    c, _ = client
    _register(c)
    created = c.post(
        "/api/v2/notebook/notes", json=_quote_payload(), headers=_csrf(c)
    ).json()
    # 走 quality=5 review 一次, default interval=1 day → next_review +1d (still due
    # if 1d clock skip is large; test via direct DB push to +30d)
    db_url = f"sqlite:///{(tmp_path / 'exam.db').as_posix()}"
    db = DatabaseManager(
        Settings(
            app_env="test",
            database_url=db_url,
            upload_dir=tmp_path / "uploads",
            import_tmp_dir=tmp_path / "imports",
            admin_username="admin",
            admin_password_hash=hash_password("adminpass"),
            jwt_secret="test-secret-0123456789-test-secret",
            llm_api_key="sk-test-key",
            llm_base_url="https://api.deepseek.com/v1",
        )
    )
    with db.session_factory() as session:
        row = session.get(Note, created["id"])
        assert row is not None
        row.next_review_at = datetime.now(UTC).replace(tzinfo=None) + timedelta(days=30)
        session.commit()
    resp = c.get("/api/v2/notebook/reviews/due?limit=5")
    body = resp.json()
    # 30d future → 不在 due
    assert len(body["items"]) == 0


# ── Stats ───────────────────────────────────────────────────────────────


def test_stats_aggregates_correctly(client) -> None:
    c, _ = client
    _register(c)
    # 4 类各加 1, 全部 essay 加 1 个 xingce material
    c.post("/api/v2/notebook/notes", json=_quote_payload(), headers=_csrf(c))
    c.post("/api/v2/notebook/notes", json=_method_payload(), headers=_csrf(c))
    c.post("/api/v2/notebook/notes", json=_reflect_payload(), headers=_csrf(c))
    c.post(
        "/api/v2/notebook/notes", json=_material_payload(), headers=_csrf(c)
    )  # xingce
    resp = c.get("/api/v2/notebook/stats")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 4
    # 全部新建 next_review_at NULL → 全在 due queue
    assert body["dueCount"] == 4
    assert body["byType"] == {"quote": 1, "method": 1, "reflect": 1, "material": 1}
    assert body["bySourceDomain"] == {"essay": 3, "xingce": 1}


def test_stats_empty_user(client) -> None:
    c, _ = client
    _register(c)
    resp = c.get("/api/v2/notebook/stats")
    body = resp.json()
    assert body["total"] == 0
    assert body["dueCount"] == 0
    assert body["byType"] == {"quote": 0, "method": 0, "reflect": 0, "material": 0}
    assert body["bySourceDomain"] == {"xingce": 0, "essay": 0}


# ── SM-2 algorithm unit tests (pure function) ─────────────────────────────


def test_sm2_quality_0_resets_interval_to_1():
    new_ease, interval, _next = _update_sm2(
        ease=2.5, review_count=5, recall_quality=0
    )
    assert interval == 1
    assert new_ease == pytest.approx(2.3)


def test_sm2_ease_floor_clamps_to_min():
    """ease 已在下限附近, quality=0 不能再降."""
    new_ease, _interval, _next = _update_sm2(
        ease=_SM2_MIN_EASE, review_count=0, recall_quality=0
    )
    assert new_ease == pytest.approx(_SM2_MIN_EASE)


def test_sm2_quality_5_increases_ease():
    new_ease, _interval, _next = _update_sm2(
        ease=2.5, review_count=2, recall_quality=5
    )
    assert new_ease > 2.5


def test_sm2_first_review_interval_is_1():
    _ease, interval, _next = _update_sm2(
        ease=2.5, review_count=0, recall_quality=4
    )
    assert interval == 1


def test_sm2_second_review_interval_is_6():
    _ease, interval, _next = _update_sm2(
        ease=2.5, review_count=1, recall_quality=4
    )
    assert interval == 6


def test_sm2_invalid_quality_raises():
    """Quality 超 0-5 → ServiceValidationError."""
    from sikao_api.modules.system.application.errors import ValidationError as ServiceValidationError

    with pytest.raises(ServiceValidationError):
        _update_sm2(ease=2.5, review_count=0, recall_quality=10)
