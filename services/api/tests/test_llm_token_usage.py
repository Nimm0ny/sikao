"""LLM token usage tests — Slice 0b.

Cover:
- pricing.compute_cost_cents (DS V4 flash / pro / 未知 model None)
- usage_recorder.record_usage (落 row + 计 cost_cents + total_tokens)
- llm_usage aggregator (空 user / 单 row / 多 feature / 跨日 / cost None 传播)
- routes /llm/usage/me + /admin/llm/usage (auth + admin auth + summary shape)
"""

from __future__ import annotations

import base64
from collections.abc import Iterator
from datetime import UTC, date, datetime, time, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from sikao_api.core.config import Settings
from sikao_api.db.base import Base
from sikao_api.db.models import LlmTokenUsage, User
from sikao_api.main import create_app
from sikao_api.modules.llm.application.llm.pricing import MODEL_PRICES, compute_cost_cents
from sikao_api.modules.llm.application.llm.usage_recorder import UsageRecord, record_usage
from sikao_api.modules.llm.application.usage import (
    get_admin_usage_summary,
    get_user_usage_summary,
)
from sikao_api.modules.auth.application.security import hash_password

# ─── pricing ──────────────────────────────────────────────────────────────


def test_compute_cost_cents_deepseek_v4_flash() -> None:
    """deepseek-v4-flash: 1M input miss + 1M output. (按官方 cents/M 计算).

    1_000_000 * 14.0 / 1_000_000 + 1_000_000 * 28.0 / 1_000_000 = 14 + 28 = 42 cents.
    """
    cost = compute_cost_cents(
        model="deepseek-v4-flash",
        prompt_cache_hit_tokens=0,
        prompt_cache_miss_tokens=1_000_000,
        completion_tokens=1_000_000,
    )
    assert cost == 42


def test_compute_cost_cents_with_cache_hit_savings() -> None:
    """cache hit 部分单价 0.28 cents/M (50x cheaper than miss).

    1_000_000 hit + 0 miss + 0 output = 0.28 cents → round to 0.
    """
    cost = compute_cost_cents(
        model="deepseek-v4-flash",
        prompt_cache_hit_tokens=1_000_000,
        prompt_cache_miss_tokens=0,
        completion_tokens=0,
    )
    assert cost == 0  # 0.28 round to 0


def test_compute_cost_cents_unknown_model_returns_none() -> None:
    """BYOM 用户给的 endpoint 没价格表 → None (admin dashboard 标 N/A)."""
    cost = compute_cost_cents(
        model="user-byom-mystery-model",
        prompt_cache_hit_tokens=0,
        prompt_cache_miss_tokens=1000,
        completion_tokens=500,
    )
    assert cost is None


def test_model_prices_known_keys_complete() -> None:
    """价格表覆盖 plan §4.5 列出的 4 个 model id."""
    expected = {"deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner"}
    assert expected.issubset(set(MODEL_PRICES.keys()))


# ─── usage_recorder ────────────────────────────────────────────────────────


@pytest.fixture
def session() -> Iterator[Session]:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False, future=True
    )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _make_user(db: Session, *, username: str = "alice") -> User:
    user = User(
        username=username,
        password_hash=hash_password("password"),
        display_name=username,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def test_record_usage_inserts_row_with_computed_cost(session: Session) -> None:
    """record_usage 落 row + 计 cost_cents + total_tokens."""
    user = _make_user(session)
    row = record_usage(
        session,
        UsageRecord(
            feature="qa",
            user_id=user.id,
            provider="system",
            model="deepseek-v4-flash",
            prompt_tokens=1_000_000,
            prompt_cache_hit_tokens=0,
            prompt_cache_miss_tokens=1_000_000,
            completion_tokens=1_000_000,
        ),
    )
    assert row.id is not None
    assert row.user_id == user.id
    assert row.feature == "qa"
    assert row.total_tokens == 2_000_000  # prompt + completion
    assert row.cost_cents == 42  # flash 1M miss + 1M output
    assert row.estimated is False


def test_record_usage_unknown_model_cost_cents_none(session: Session) -> None:
    """BYOM 模型 → cost_cents=None, 但 row 仍落."""
    user = _make_user(session)
    row = record_usage(
        session,
        UsageRecord(
            feature="qa",
            user_id=user.id,
            provider="user_byom",
            model="some-byom-model",
            prompt_tokens=100,
            prompt_cache_hit_tokens=0,
            prompt_cache_miss_tokens=100,
            completion_tokens=50,
        ),
    )
    assert row.cost_cents is None
    assert row.total_tokens == 150


def test_record_usage_estimated_flag_carried(session: Session) -> None:
    """tiktoken 估算 fallback 时 estimated=True 落 row."""
    user = _make_user(session)
    row = record_usage(
        session,
        UsageRecord(
            feature="qa",
            user_id=user.id,
            provider="system",
            model="deepseek-v4-flash",
            prompt_tokens=10,
            prompt_cache_hit_tokens=0,
            prompt_cache_miss_tokens=10,
            completion_tokens=5,
            estimated=True,
        ),
    )
    assert row.estimated is True


# ─── aggregator ────────────────────────────────────────────────────────────


def test_aggregator_empty_user_returns_zero_padded(session: Session) -> None:
    """空 user (没记账) → 0 totals + 30 天 zero-pad recent_days."""
    user = _make_user(session)
    summary = get_user_usage_summary(session, user_id=user.id)
    assert summary.total_tokens == 0
    assert summary.total_cost_cents == 0
    assert summary.by_feature == {}
    assert len(summary.recent_days) == 30
    # 升序: oldest → today
    assert summary.recent_days[0].date < summary.recent_days[-1].date
    assert all(d.tokens == 0 for d in summary.recent_days)


def test_aggregator_single_row(session: Session) -> None:
    """单 row 落库后 summary 正确算 total_tokens / by_feature / recent_days."""
    user = _make_user(session)
    record_usage(
        session,
        UsageRecord(
            feature="qa",
            user_id=user.id,
            provider="system",
            model="deepseek-v4-flash",
            prompt_tokens=100,
            prompt_cache_hit_tokens=0,
            prompt_cache_miss_tokens=100,
            completion_tokens=50,
        ),
    )
    summary = get_user_usage_summary(session, user_id=user.id)
    assert summary.total_tokens == 150
    assert "qa" in summary.by_feature
    assert summary.by_feature["qa"].prompt_tokens == 100
    assert summary.by_feature["qa"].completion_tokens == 50


def test_aggregator_multi_feature_breakdown(session: Session) -> None:
    """多 feature row → by_feature 各自 aggregate."""
    user = _make_user(session)
    for feat in ("qa", "qa", "essay_grading"):
        record_usage(
            session,
            UsageRecord(
                feature=feat,
                user_id=user.id,
                provider="system",
                model="deepseek-v4-flash",
                prompt_tokens=10,
                prompt_cache_hit_tokens=0,
                prompt_cache_miss_tokens=10,
                completion_tokens=5,
            ),
        )
    summary = get_user_usage_summary(session, user_id=user.id)
    assert set(summary.by_feature.keys()) == {"qa", "essay_grading"}
    assert summary.by_feature["qa"].prompt_tokens == 20  # 2 rows × 10
    assert summary.by_feature["essay_grading"].prompt_tokens == 10


def test_aggregator_cost_none_propagates(session: Session) -> None:
    """任一 row cost_cents=NULL (BYOM) → total_cost_cents=None (避免 lower-bound)."""
    user = _make_user(session)
    # 一条有价 (DS V4) + 一条无价 (BYOM unknown)
    record_usage(
        session,
        UsageRecord(
            feature="qa",
            user_id=user.id,
            provider="system",
            model="deepseek-v4-flash",
            prompt_tokens=1_000_000,
            prompt_cache_hit_tokens=0,
            prompt_cache_miss_tokens=1_000_000,
            completion_tokens=0,
        ),
    )
    record_usage(
        session,
        UsageRecord(
            feature="qa",
            user_id=user.id,
            provider="user_byom",
            model="byom-mystery",
            prompt_tokens=1000,
            prompt_cache_hit_tokens=0,
            prompt_cache_miss_tokens=1000,
            completion_tokens=500,
        ),
    )
    summary = get_user_usage_summary(session, user_id=user.id)
    assert summary.total_cost_cents is None  # 任一 None → 全 None
    # qa byFeature 也含 None (混 row)
    assert summary.by_feature["qa"].cost_cents is None


def test_aggregator_admin_includes_all_users(session: Session) -> None:
    """admin aggregate 含全 user (含匿名 user_id=NULL)."""
    user_a = _make_user(session, username="alice")
    user_b = _make_user(session, username="bob")
    for uid in (user_a.id, user_b.id, None):
        record_usage(
            session,
            UsageRecord(
                feature="qa",
                user_id=uid,
                provider="system",
                model="deepseek-v4-flash",
                prompt_tokens=10,
                prompt_cache_hit_tokens=0,
                prompt_cache_miss_tokens=10,
                completion_tokens=5,
            ),
        )
    admin_summary = get_admin_usage_summary(session)
    assert admin_summary.total_tokens == 45  # 3 rows × 15
    user_a_summary = get_user_usage_summary(session, user_id=user_a.id)
    assert user_a_summary.total_tokens == 15  # 仅 user_a 的 1 row


def test_aggregator_user_view_byuser_is_none(session: Session) -> None:
    """User view 不返 by_user 维度 (admin-only)."""
    user = _make_user(session)
    summary = get_user_usage_summary(session, user_id=user.id)
    assert summary.by_user is None


def test_aggregator_admin_view_byuser_sorted_desc(session: Session) -> None:
    """Admin view by_user 按 total_tokens 降序排, 含 username + 匿名 None."""
    user_alice = _make_user(session, username="alice")
    user_bob = _make_user(session, username="bob")
    # alice: 1 row (15 tokens), bob: 3 rows (45 tokens), 匿名: 2 rows (30 tokens)
    record_usage(
        session,
        UsageRecord(
            feature="qa", user_id=user_alice.id, provider="system",
            model="deepseek-v4-flash", prompt_tokens=10,
            prompt_cache_hit_tokens=0, prompt_cache_miss_tokens=10,
            completion_tokens=5,
        ),
    )
    for _ in range(3):
        record_usage(
            session,
            UsageRecord(
                feature="qa", user_id=user_bob.id, provider="system",
                model="deepseek-v4-flash", prompt_tokens=10,
                prompt_cache_hit_tokens=0, prompt_cache_miss_tokens=10,
                completion_tokens=5,
            ),
        )
    for _ in range(2):
        record_usage(
            session,
            UsageRecord(
                feature="qa", user_id=None, provider="system",
                model="deepseek-v4-flash", prompt_tokens=10,
                prompt_cache_hit_tokens=0, prompt_cache_miss_tokens=10,
                completion_tokens=5,
            ),
        )

    admin_summary = get_admin_usage_summary(session)
    assert admin_summary.by_user is not None
    assert len(admin_summary.by_user) == 3
    # 排序: bob 45 > 匿名 30 > alice 15
    assert admin_summary.by_user[0].user_id == user_bob.id
    assert admin_summary.by_user[0].username == "bob"
    assert admin_summary.by_user[0].total_tokens == 45
    assert admin_summary.by_user[1].user_id is None
    assert admin_summary.by_user[1].username is None
    assert admin_summary.by_user[1].total_tokens == 30
    assert admin_summary.by_user[2].username == "alice"


def test_cutoff_for_window_math() -> None:
    """`_cutoff_for_window` contract: 锁住 day-start of (today - (N-1)) 的边界.

    P1 #5 fix verification: today=2026-04-29, days=30 → cutoff=2026-03-31 00:00:00
    (含今天 + 前 29 天 = 完整 30 天). 直接 unit test 锁 contract, 比 SQL row
    boundary 测试更严格.
    """
    from sikao_api.modules.llm.application.usage import _cutoff_for_window

    today = date(2026, 4, 29)
    cutoff = _cutoff_for_window(today, 30)
    assert cutoff == datetime(2026, 3, 31, 0, 0, 0)
    # 边界对单位 1 天:
    assert _cutoff_for_window(today, 1) == datetime(2026, 4, 29, 0, 0, 0)
    # 边界对长 7 天:
    assert _cutoff_for_window(today, 7) == datetime(2026, 4, 23, 0, 0, 0)


def test_aggregator_cutoff_excludes_row_outside_window(session: Session) -> None:
    """30 天前 23:59:30 的 row 应该 **被 cutoff 排除** (在 cutoff = day-start
    of today-29d 之外).

    P1 #5 真 boundary: 旧 cutoff = now - 30d 让这个 row 在某些 hh:mm 下进结果
    (因为旧 cutoff 比 today-29d 00:00 更早, 30 days ago 23:59:30 > 旧 cutoff
    → 误进). 新 cutoff = today-29d 00:00, 该 row early 24h+, 一定漏.
    """
    user = _make_user(session)
    today = datetime.now(UTC).date()
    # 30 天前 23:59:30 — 在新 cutoff (today-29d 00:00:00) 之前 30 sec, 必漏
    out_of_window = datetime.combine(today - timedelta(days=30), time(23, 59, 30))
    record_usage(
        session,
        UsageRecord(
            feature="qa", user_id=user.id, provider="system",
            model="deepseek-v4-flash", prompt_tokens=10,
            prompt_cache_hit_tokens=0, prompt_cache_miss_tokens=10,
            completion_tokens=5,
        ),
    )
    row = session.query(LlmTokenUsage).filter_by(user_id=user.id).first()
    assert row is not None
    row.created_at = out_of_window
    session.flush()

    summary = get_user_usage_summary(session, user_id=user.id, days=30)
    assert summary.total_tokens == 0  # 该 row 在窗口外, 不进结果


def test_aggregator_cutoff_includes_row_at_window_start(session: Session) -> None:
    """29 天前 00:00:00 的 row 应该 **被 cutoff 包含** (恰在 cutoff 边界).

    与上一 test 配合, 锁住完整 30 天窗口边界 (含 [today-29d 00:00, today]).
    """
    user = _make_user(session)
    today = datetime.now(UTC).date()
    # 29 天前 00:00:00 — 等于 cutoff 边界 (>=), 必入
    at_window_start = datetime.combine(today - timedelta(days=29), time(0, 0, 0))
    record_usage(
        session,
        UsageRecord(
            feature="qa", user_id=user.id, provider="system",
            model="deepseek-v4-flash", prompt_tokens=10,
            prompt_cache_hit_tokens=0, prompt_cache_miss_tokens=10,
            completion_tokens=5,
        ),
    )
    row = session.query(LlmTokenUsage).filter_by(user_id=user.id).first()
    assert row is not None
    row.created_at = at_window_start
    session.flush()

    summary = get_user_usage_summary(session, user_id=user.id, days=30)
    assert summary.total_tokens == 15  # 边界 row 进结果


# ─── routes (endpoints) ────────────────────────────────────────────────────


@pytest.fixture
def client(tmp_path):  # type: ignore[no-untyped-def]
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'exam-api.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        admin_username="admin",
        admin_password_hash=hash_password("adminpass"),
        jwt_secret="test-secret-0123456789-test-secret",
    )
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as c:
        yield c, settings


def _admin_headers() -> dict[str, str]:
    token = base64.b64encode(b"admin:adminpass").decode("ascii")
    return {"Authorization": f"Basic {token}"}


def _register_and_login(client: TestClient) -> int:
    """Register a user via API. Auth cookie auto-set on TestClient by response,
    后续 GET 走 cookie auth (Phase B), 不需要显式 Authorization / CSRF header
    (GET 不 mutating).

    /register 返 200 + {tokenType, expiresIn, user, ...}. user.id 是新用户 PK.
    """
    resp = client.post(
        "/api/v2/auth/register/email",
        json={"email": "user1@test.local", "password": "passw0rd", "displayName": "U1"},
    )
    assert resp.status_code == 200, resp.text
    return int(resp.json()["user"]["id"])


def test_endpoint_my_usage_unauthenticated_401(client) -> None:  # type: ignore[no-untyped-def]
    c, _ = client
    resp = c.get("/api/v2/llm/usage/me")
    assert resp.status_code == 401


def test_endpoint_my_usage_returns_summary_shape(client) -> None:  # type: ignore[no-untyped-def]
    c, _ = client
    _register_and_login(c)
    resp = c.get("/api/v2/llm/usage/me")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # camelCase fields per CamelModel
    assert "totalTokens" in body
    assert "totalCostCents" in body
    assert "byFeature" in body
    assert "recentDays" in body
    assert body["totalTokens"] == 0  # 新 user 无记录
    assert isinstance(body["recentDays"], list)
    assert len(body["recentDays"]) == 30  # zero-padded


def test_endpoint_admin_usage_requires_basic_auth(client) -> None:  # type: ignore[no-untyped-def]
    c, _ = client
    resp = c.get("/api/v2/admin/llm/usage")
    assert resp.status_code == 401


def test_endpoint_admin_usage_returns_global_aggregate(client) -> None:  # type: ignore[no-untyped-def]
    c, _ = client
    resp = c.get("/api/v2/admin/llm/usage", headers=_admin_headers())
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["totalTokens"] == 0  # 空 DB
    assert body["byFeature"] == {}