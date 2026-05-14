"""Slice 3a · 学习计划 routes integration tests (Commit 3).

2 endpoints (GET /today + PATCH /tasks/{id}) — auth + CSRF gate + happy path
+ 跨用户 404 + 已 finalized 422 + outer discriminated union 序列化正确.

LLM 路径不打真 LLM, monkeypatch build_llm_provider stub. 大部分测试走
fallback_cold_start (新用户 0 答题历史 → 不调 LLM, 1 task 含 3 题 fallback).
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db.session import DatabaseManager
from sikao_api.db.models import (
    Paper,
    PaperBlock,
    PaperRevision,
    PaperSection,
    Question,
)
from sikao_api.main import create_app
from sikao_api.modules.auth.application.security import hash_password
from sikao_api.modules.study_record.application.study_plans import (
    _FALLBACK_PAPER_CODE,
    _FALLBACK_QUESTION_SOURCE_UUIDS,
)

_FALLBACK_ROUTE_TEST_QUESTION_IDS: list[int] = [26276, 26277, 26278]


def _seed_fallback_paper(session: Session) -> None:
    paper = Paper(paper_code=_FALLBACK_PAPER_CODE, paper_name="fallback test paper")
    session.add(paper)
    session.flush()
    revision = PaperRevision(
        paper_id=paper.id,
        revision_number=1,
        sort_order=1,
        paper_name=paper.paper_name,
        question_count=len(_FALLBACK_ROUTE_TEST_QUESTION_IDS),
        source_hash="fallback-route-test",
        visible_in_public=True,
    )
    session.add(revision)
    session.flush()
    paper.current_revision_id = revision.id

    section = PaperSection(
        paper_revision_id=revision.id,
        section_key="s1",
        title="xingce",
        instruction_text="",
        display_order=1,
        question_count=len(_FALLBACK_ROUTE_TEST_QUESTION_IDS),
    )
    session.add(section)
    session.flush()
    block = PaperBlock(
        paper_revision_id=revision.id,
        section_id=section.id,
        block_type="question",
        display_order=1,
    )
    session.add(block)
    session.flush()

    for idx, question_id in enumerate(_FALLBACK_ROUTE_TEST_QUESTION_IDS):
        session.add(
            Question(
                id=question_id,
                paper_revision_id=revision.id,
                section_id=section.id,
                block_id=block.id,
                position=idx + 1,
                source_uuid=_FALLBACK_QUESTION_SOURCE_UUIDS[idx],
                question_kind="single_choice",
                subtype_name="language",
                stem_text=f"<p>question {question_id}</p>",
                answer_text="A",
                explanation_text="",
                difficulty_code="unknown",
                renderer_key="single_choice",
                type_payload_json={},
                special_payload_json={},
                source_payload_json={},
                is_gradable=True,
                enabled=True,
                subject="language",
            )
        )
    session.commit()


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
    with db.session_factory() as session:
        _seed_fallback_paper(session)
    with TestClient(app) as client:
        yield client, settings


@pytest.fixture
def client(tmp_path: Path) -> Iterator[tuple[TestClient, Settings]]:
    with _build_client(tmp_path) as (c, s):
        yield c, s


def _register(client: TestClient, *, username: str = "user1") -> int:
    resp = client.post(
        "/api/v2/auth/register/email",
        json={"email": f"{username}@test.local", "password": "passw0rd", "displayName": username},
    )
    assert resp.status_code == 200, resp.text
    return int(resp.json()["user"]["id"])


def _csrf(client: TestClient) -> dict[str, str]:
    csrf = client.cookies.get("csrf_token")
    assert csrf, "csrf_token cookie missing"
    return {"X-CSRF-Token": csrf}


# ── Auth gate ────────────────────────────────────────────────────────────


def test_get_today_unauthenticated_401(client) -> None:
    c, _ = client
    resp = c.get("/api/v2/study-plan/today")
    assert resp.status_code == 401


def test_patch_task_unauthenticated_401(client) -> None:
    c, _ = client
    resp = c.patch(
        "/api/v2/study-plan/tasks/1", json={"status": "completed"}
    )
    assert resp.status_code == 401


def test_patch_task_missing_csrf_403(client) -> None:
    c, _ = client
    _register(c)
    # 不带 X-CSRF-Token header
    resp = c.patch(
        "/api/v2/study-plan/tasks/1", json={"status": "completed"}
    )
    assert resp.status_code == 403


# ── Happy path: cold start fallback ──────────────────────────────────────


def test_get_today_cold_start_returns_fallback_plan(client) -> None:
    """新用户 0 答题历史 → fallback_cold_start, 1 practice task 含 3 题."""
    c, _ = client
    _register(c)
    resp = c.get("/api/v2/study-plan/today")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["generationStatus"] == "fallback_cold_start"
    assert "id" in body
    assert "planDate" in body
    assert "createdAt" in body
    assert isinstance(body["tasks"], list)
    assert len(body["tasks"]) == 1
    task = body["tasks"][0]
    assert task["taskKind"] == "practice"
    assert task["status"] == "pending"
    assert task["payload"]["paperCode"] == _FALLBACK_PAPER_CODE
    assert task["payload"]["questionIds"] == _FALLBACK_ROUTE_TEST_QUESTION_IDS
    assert task["payload"]["title"] == "先做 3 道行测题"


def test_get_today_second_call_returns_cached_plan(client) -> None:
    """同 user 同天第二次访问 → cache hit, 同 plan id."""
    c, _ = client
    _register(c)
    first = c.get("/api/v2/study-plan/today")
    assert first.status_code == 200
    second = c.get("/api/v2/study-plan/today")
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]


# ── PATCH task ───────────────────────────────────────────────────────────


def test_patch_task_completed_returns_updated(client) -> None:
    c, _ = client
    _register(c)
    today = c.get("/api/v2/study-plan/today").json()
    task_id = today["tasks"][0]["id"]

    resp = c.patch(
        f"/api/v2/study-plan/tasks/{task_id}",
        json={"status": "completed"},
        headers=_csrf(c),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "completed"
    assert body["completedAt"] is not None
    # outer discriminated union: task_kind narrow 让 FE 拿到 narrow type
    assert body["taskKind"] == "practice"
    assert "paperCode" in body["payload"]


def test_patch_task_skipped_no_completed_at(client) -> None:
    c, _ = client
    _register(c)
    today = c.get("/api/v2/study-plan/today").json()
    task_id = today["tasks"][0]["id"]

    resp = c.patch(
        f"/api/v2/study-plan/tasks/{task_id}",
        json={"status": "skipped"},
        headers=_csrf(c),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "skipped"
    assert body["completedAt"] is None


def test_patch_task_already_finalized_422(client) -> None:
    c, _ = client
    _register(c)
    today = c.get("/api/v2/study-plan/today").json()
    task_id = today["tasks"][0]["id"]

    # 第一次 completed OK
    first = c.patch(
        f"/api/v2/study-plan/tasks/{task_id}",
        json={"status": "completed"},
        headers=_csrf(c),
    )
    assert first.status_code == 200
    # 第二次 try skipped → 已 finalized → 422
    second = c.patch(
        f"/api/v2/study-plan/tasks/{task_id}",
        json={"status": "skipped"},
        headers=_csrf(c),
    )
    assert second.status_code == 422
    assert "finalized" in second.json().get("detail", "").lower()


def test_patch_task_cross_user_404(client) -> None:
    """alice 创建 task, bob 尝试 PATCH → 404 (防 leak task 存在性)."""
    c, _ = client
    _register(c, username="alice")
    today = c.get("/api/v2/study-plan/today").json()
    task_id = today["tasks"][0]["id"]
    # alice 退出 cookie
    c.cookies.clear()
    _register(c, username="bob")

    resp = c.patch(
        f"/api/v2/study-plan/tasks/{task_id}",
        json={"status": "completed"},
        headers=_csrf(c),
    )
    assert resp.status_code == 404


def test_patch_task_invalid_status_422(client) -> None:
    """status='pending' 不允许 (单向不可逆), Pydantic 422."""
    c, _ = client
    _register(c)
    today = c.get("/api/v2/study-plan/today").json()
    task_id = today["tasks"][0]["id"]

    resp = c.patch(
        f"/api/v2/study-plan/tasks/{task_id}",
        json={"status": "pending"},  # 不在 Literal['completed', 'skipped']
        headers=_csrf(c),
    )
    assert resp.status_code == 422


# ── OpenAPI discriminator output ─────────────────────────────────────────


def test_openapi_schema_has_oneof_discriminator_for_tasks(client) -> None:
    """FastAPI auto OpenAPI: StudyPlanResponse.tasks 应输出 oneOf+discriminator,
    跟 commit 1 P0-new-1 outer union 写法目标对齐 (FE openapi-typescript regen 拿
    narrow union)."""
    c, _ = client
    resp = c.get("/openapi.json")
    assert resp.status_code == 200
    spec = resp.json()
    plan_schema = spec["components"]["schemas"]["StudyPlanResponse"]
    tasks_field = plan_schema["properties"]["tasks"]
    items = tasks_field["items"]
    # discriminator 应该在 items level (Pydantic v2 outer union)
    assert "discriminator" in items or "oneOf" in items, json.dumps(items, indent=2)
