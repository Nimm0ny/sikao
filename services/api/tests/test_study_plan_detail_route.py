"""Slice 3d · 学习计划详情页 routes integration tests.

GET /api/v2/study-plan/{plan_id} — auth gate + 跨用户 404 (统一不暴露存在性) +
不存在 404 + path param 422 + 完整 task list discriminated union narrow.

Plan: docs/plan/slice-3d-study-plan-detail.md §7.

测试构造方式: 复用 test_study_plan_history_route.py 的 _seed_plan helper
直接落库, 避开 /today 的 today-only 限制.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import date, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from sikao_api.core.config import Settings
from sikao_api.db.models import StudyPlan, StudyPlanTask
from sikao_api.main import create_app
from sikao_api.modules.auth.application.security import hash_password
from sikao_api.modules.study_record.application.study_plans import today_plan_date_shanghai


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


def _seed_plan_with_mixed_tasks(
    client: TestClient,
    *,
    user_id: int,
    plan_date: date,
    generation_status: str = "success",
) -> int:
    """落 1 plan + 3 task (1 practice / 1 review_wrong / 1 essay_writing) +
    分别 status pending / completed / skipped, 验完整 narrow + 状态视觉.
    """
    factory = client.app.state.db.session_factory
    sess = factory()
    try:
        plan = StudyPlan(
            user_id=user_id,
            plan_date=plan_date,
            generation_status=generation_status,
            token_usage_id=None,
        )
        sess.add(plan)
        sess.flush()

        sess.add(
            StudyPlanTask(
                plan_id=plan.id,
                task_kind="practice",
                payload_json={
                    "paperCode": "FENBI-T1",
                    "questionIds": [1, 2, 3],
                    "title": "做 3 道行测题",
                    "subtitle": "言语 / 常识",
                },
                display_order=0,
                status="pending",
            )
        )
        sess.add(
            StudyPlanTask(
                plan_id=plan.id,
                task_kind="review_wrong",
                payload_json={
                    "questionIds": [10, 11],
                    "title": "复习 2 道错题",
                },
                display_order=1,
                status="completed",
            )
        )
        sess.add(
            StudyPlanTask(
                plan_id=plan.id,
                task_kind="essay_writing",
                payload_json={
                    "paperCode": "ESSAY-T1",
                    "questionId": 100,
                    "title": "写 1 道申论",
                },
                display_order=2,
                status="skipped",
            )
        )
        sess.commit()
        return int(plan.id)
    finally:
        sess.close()


# ── Auth gate ────────────────────────────────────────────────────────────


def test_get_detail_unauthenticated_401(client) -> None:
    c, _ = client
    resp = c.get("/api/v2/study-plan/1")
    assert resp.status_code == 401


# ── 不存在 → 404 ─────────────────────────────────────────────────────────


def test_get_detail_not_found_returns_404(client) -> None:
    c, _ = client
    _register(c)
    resp = c.get("/api/v2/study-plan/99999")
    assert resp.status_code == 404


# ── 跨用户 → 404 (alice 的 plan, bob 访问) ───────────────────────────────


def test_get_detail_cross_user_existing_plan_404(client) -> None:
    """alice 有 plan, bob 登录访问 → 404 (不暴露存在性).

    反向也测: alice 自己访问 → 200 + 完整 task list (合并断言, P1-4 简化).
    """
    c, _ = client
    alice_id = _register(c, username="alice")
    yesterday = today_plan_date_shanghai() - timedelta(days=1)
    plan_id = _seed_plan_with_mixed_tasks(
        c, user_id=alice_id, plan_date=yesterday
    )

    # alice 自己访问 — 200, 完整 task list discriminated narrow
    resp_alice = c.get(f"/api/v2/study-plan/{plan_id}")
    assert resp_alice.status_code == 200, resp_alice.text
    body = resp_alice.json()
    assert body["id"] == plan_id
    assert body["generationStatus"] == "success"
    assert len(body["tasks"]) == 3
    # 三种 task_kind 各 1 条 + status 三态各 1 条
    kinds = sorted(t["taskKind"] for t in body["tasks"])
    statuses = sorted(t["status"] for t in body["tasks"])
    assert kinds == ["essay_writing", "practice", "review_wrong"]
    assert statuses == ["completed", "pending", "skipped"]
    # discriminated narrow: practice 必须含 paperCode + questionIds
    practice = next(t for t in body["tasks"] if t["taskKind"] == "practice")
    assert practice["payload"]["paperCode"] == "FENBI-T1"
    assert practice["payload"]["questionIds"] == [1, 2, 3]
    # essay_writing 必须含 questionId (不是 questionIds)
    essay = next(t for t in body["tasks"] if t["taskKind"] == "essay_writing")
    assert essay["payload"]["questionId"] == 100

    # bob 登录 — 看不到 alice 的 plan, 跨用户 404
    c.cookies.clear()
    _register(c, username="bob")
    resp_bob = c.get(f"/api/v2/study-plan/{plan_id}")
    assert resp_bob.status_code == 404


def test_get_detail_cross_user_nonexistent_404(client) -> None:
    """别人范围内的不存在 plan_id 也是 404 — 同语义不暴露."""
    c, _ = client
    _register(c, username="alice")
    # alice 没建任何 plan, 直接访问任意 id
    resp = c.get("/api/v2/study-plan/12345")
    assert resp.status_code == 404


# ── path param 422 ───────────────────────────────────────────────────────


def test_get_detail_invalid_path_param_422(client) -> None:
    """plan_id 非法 → FastAPI int converter 422.

    'abc' / 负数都跑 int converter, 自动 422.
    P0-1 (FE) enabled 守门拦截 'abc', BE 仍要兜底.
    """
    c, _ = client
    _register(c)
    # P2-2 v0.2 review: 显式区分 422 (非 int) vs 404 (合法 int 但不存在).
    # FastAPI int converter 接受负数 + 0 — 这些是合法 int, 走 service 报 404.
    for bad in ("abc", "1.5", "1e2"):
        resp = c.get(f"/api/v2/study-plan/{bad}")
        assert resp.status_code == 422, (
            f"plan_id={bad!r} expected 422, got {resp.status_code}"
        )
    # 0 / -1 / 极大 int 都合法, service 层找不到 → 404
    for legal_but_missing in ("0", "-1", "999999999"):
        resp = c.get(f"/api/v2/study-plan/{legal_but_missing}")
        assert resp.status_code == 404, (
            f"plan_id={legal_but_missing!r} expected 404, got {resp.status_code}"
        )
