"""Slice 3c · 学习计划历史 routes integration tests.

GET /api/v2/study-plan/history — auth gate + cursor 分页 + 排除今日 +
跨用户隔离 + limit 422 边界 + cursor 非法 422 + task_completed 计数.

Plan: docs/plan/slice-3c-study-plan-history.md §7.

测试构造方式: 不打 LLM, 直接用 SQLAlchemy session 往 study_plans /
study_plan_tasks 插过去日期的行 (避开 /today 端点的 today-only 限制).
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


def _seed_plan(
    client: TestClient,
    *,
    user_id: int,
    plan_date: date,
    generation_status: str = "success",
    task_statuses: list[str] | None = None,
) -> int:
    """直接通过 app.state.db.session_factory 落 study_plans + study_plan_tasks
    行, 不走 /today (避开 today-only 限制, 插任意过去日期).

    task_statuses: e.g. ['completed', 'completed', 'skipped', 'pending']
    每个 status 对应一个 minimum-payload practice task. 返 plan id.
    """
    if task_statuses is None:
        task_statuses = ["pending"]
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
        for idx, st in enumerate(task_statuses):
            task = StudyPlanTask(
                plan_id=plan.id,
                task_kind="practice",
                payload_json={
                    "paperCode": "FENBI-TEST",
                    "questionIds": [1, 2, 3],
                    "title": f"task {idx}",
                },
                display_order=idx,
                status=st,
            )
            sess.add(task)
        sess.commit()
        return int(plan.id)
    finally:
        sess.close()


# ── Auth gate ────────────────────────────────────────────────────────────


def test_history_unauthenticated_401(client) -> None:
    c, _ = client
    resp = c.get("/api/v2/study-plan/history")
    assert resp.status_code == 401


# ── 1. 空 list ───────────────────────────────────────────────────────────


def test_returns_empty_list_when_no_history(client) -> None:
    c, _ = client
    _register(c)
    resp = c.get("/api/v2/study-plan/history")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body == {"items": [], "nextCursor": None}


# ── 2. 排除今日 ──────────────────────────────────────────────────────────


def test_excludes_today_plan(client) -> None:
    """今日 plan 不出现在 history 列表里 (D3 today_plan_date_shanghai cutoff)."""
    c, _ = client
    user_id = _register(c)
    today = today_plan_date_shanghai()
    yesterday = today - timedelta(days=1)
    _seed_plan(c, user_id=user_id, plan_date=today)
    yesterday_id = _seed_plan(c, user_id=user_id, plan_date=yesterday)

    resp = c.get("/api/v2/study-plan/history")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["id"] == yesterday_id


# ── 3. 跨用户隔离 ────────────────────────────────────────────────────────


def test_returns_only_caller_user_plans(client) -> None:
    c, _ = client
    alice_id = _register(c, username="alice")
    today = today_plan_date_shanghai()
    alice_plan_id = _seed_plan(
        c, user_id=alice_id, plan_date=today - timedelta(days=1)
    )
    # alice 退出, 注册 bob, bob 也插一条历史
    c.cookies.clear()
    bob_id = _register(c, username="bob")
    bob_plan_id = _seed_plan(
        c, user_id=bob_id, plan_date=today - timedelta(days=2)
    )

    # bob 当前登录, 调 history 只看到 bob 的
    resp = c.get("/api/v2/study-plan/history")
    assert resp.status_code == 200
    items = resp.json()["items"]
    # 正向断言 (review P1-2): 必须返 bob 那一条, 而不是漏 user_id WHERE
    # 把 alice 截在 limit 外但仍返出来.
    assert len(items) == 1
    assert items[0]["id"] == bob_plan_id
    assert items[0]["id"] != alice_plan_id


# ── 4. cursor 分页递减 ───────────────────────────────────────────────────


def test_cursor_pagination_descending(client) -> None:
    """5 条历史, limit=2, cursor 翻 3 页, plan_date 严格递减."""
    c, _ = client
    user_id = _register(c)
    today = today_plan_date_shanghai()
    # 插 5 条 plan: 1/2/3/4/5 天前
    plan_dates = [today - timedelta(days=n) for n in range(1, 6)]
    for pd in plan_dates:
        _seed_plan(c, user_id=user_id, plan_date=pd)

    # 第 1 页 limit=2 → 拿 day-1, day-2; nextCursor = day-2
    resp1 = c.get("/api/v2/study-plan/history?limit=2")
    assert resp1.status_code == 200
    body1 = resp1.json()
    assert len(body1["items"]) == 2
    dates1 = [item["planDate"] for item in body1["items"]]
    assert dates1 == [
        (today - timedelta(days=1)).isoformat(),
        (today - timedelta(days=2)).isoformat(),
    ]
    assert body1["nextCursor"] == (today - timedelta(days=2)).isoformat()

    # 第 2 页 cursor=day-2 → day-3, day-4; nextCursor = day-4
    cursor1 = body1["nextCursor"]
    resp2 = c.get(f"/api/v2/study-plan/history?limit=2&cursor={cursor1}")
    assert resp2.status_code == 200
    body2 = resp2.json()
    dates2 = [item["planDate"] for item in body2["items"]]
    assert dates2 == [
        (today - timedelta(days=3)).isoformat(),
        (today - timedelta(days=4)).isoformat(),
    ]
    assert body2["nextCursor"] == (today - timedelta(days=4)).isoformat()

    # 第 3 页 cursor=day-4 → day-5; 已到底, nextCursor = None
    cursor2 = body2["nextCursor"]
    resp3 = c.get(f"/api/v2/study-plan/history?limit=2&cursor={cursor2}")
    assert resp3.status_code == 200
    body3 = resp3.json()
    assert len(body3["items"]) == 1
    assert body3["items"][0]["planDate"] == (today - timedelta(days=5)).isoformat()
    assert body3["nextCursor"] is None


# ── 4b. cursor 翻页边界: plan 数 == limit 整除 (review P1-1) ──────────────


def test_cursor_pagination_exact_limit_multiple(client) -> None:
    """4 条历史 limit=2 翻 2 页, 第 2 页 nextCursor 必须 None.

    review P1-1: limit+1 hasMore 判断回归 — 若有人改成 `>=` 而非 `>`,
    第 2 页会假信号 nextCursor 不为 None.
    """
    c, _ = client
    user_id = _register(c)
    today = today_plan_date_shanghai()
    for n in range(1, 5):
        _seed_plan(c, user_id=user_id, plan_date=today - timedelta(days=n))

    resp1 = c.get("/api/v2/study-plan/history?limit=2")
    body1 = resp1.json()
    assert len(body1["items"]) == 2
    assert body1["nextCursor"] == (today - timedelta(days=2)).isoformat()

    cursor1 = body1["nextCursor"]
    resp2 = c.get(f"/api/v2/study-plan/history?limit=2&cursor={cursor1}")
    body2 = resp2.json()
    assert len(body2["items"]) == 2
    assert body2["nextCursor"] is None  # 整除 limit 后 hasMore=False


# ── 5. limit 422 边界 ────────────────────────────────────────────────────


def test_limit_validation_422_outside_range(client) -> None:
    """P0-3: limit 范围外 fail-fast 422 (不 clamp)."""
    c, _ = client
    _register(c)
    for bad in ("0", "51", "999", "-1"):
        resp = c.get(f"/api/v2/study-plan/history?limit={bad}")
        assert resp.status_code == 422, f"limit={bad} expected 422, got {resp.status_code}"
    # limit=50 边界值通过
    resp = c.get("/api/v2/study-plan/history?limit=50")
    assert resp.status_code == 200


# ── 6. cursor 非法 422 ───────────────────────────────────────────────────


def test_cursor_invalid_returns_422(client) -> None:
    """P1-6: FastAPI date 强类型, 非法 cursor 自动 422."""
    c, _ = client
    _register(c)
    for bad in ("foo", "2099-13-99", "not-a-date", "2026/04/30"):
        resp = c.get(f"/api/v2/study-plan/history?cursor={bad}")
        assert resp.status_code == 422, f"cursor={bad} expected 422, got {resp.status_code}"


# ── 7. task_completed 计数正确 + SQL 一句出 ───────────────────────────────


def test_task_completed_count_correct(client) -> None:
    """5 task: 3 completed / 1 skipped / 1 pending → completed=3, total=5.

    skipped 不计入 completed, pending 也不计入 (status='completed' 唯一).
    """
    c, _ = client
    user_id = _register(c)
    yesterday = today_plan_date_shanghai() - timedelta(days=1)
    _seed_plan(
        c,
        user_id=user_id,
        plan_date=yesterday,
        task_statuses=[
            "completed", "completed", "completed",
            "skipped", "pending",
        ],
    )

    resp = c.get("/api/v2/study-plan/history")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 1
    item = items[0]
    assert item["taskTotal"] == 5
    assert item["taskCompleted"] == 3
    assert item["generationStatus"] == "success"


def test_task_total_zero_for_plan_with_no_tasks(client) -> None:
    """P1-1: SUM(CASE) outer join 配合 COALESCE → 无 task plan 返 total=0, completed=0.

    覆盖 SQL 一句出 + COALESCE 分支 (没匹配行时 SUM 返 NULL, 必须 COALESCE 兜底 0).
    """
    c, _ = client
    user_id = _register(c)
    yesterday = today_plan_date_shanghai() - timedelta(days=1)
    _seed_plan(
        c,
        user_id=user_id,
        plan_date=yesterday,
        task_statuses=[],  # 0 task
    )
    resp = c.get("/api/v2/study-plan/history")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["taskTotal"] == 0
    assert items[0]["taskCompleted"] == 0
