"""LLM token usage service tests.

Route-level usage endpoints remain archived with the legacy unmounted surface.
These tests keep pricing, recorder, and summary aggregation active.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, date, datetime, time, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from sikao_api.db.base import Base
from sikao_api.db.models import LlmTokenUsage, User
from sikao_api.modules.auth.application.security import hash_password
from sikao_api.modules.llm.application.llm.pricing import MODEL_PRICES, compute_cost_cents
from sikao_api.modules.llm.application.llm.usage_recorder import (
    UsageRecord,
    record_usage,
)
from sikao_api.modules.llm.application.usage import (
    _cutoff_for_window,
    get_admin_usage_summary,
    get_user_usage_summary,
)


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


def _record_sample(
    db: Session,
    *,
    user_id: int | None,
    feature: str = "qa",
    model: str = "deepseek-v4-flash",
    prompt_tokens: int = 10,
    completion_tokens: int = 5,
    estimated: bool = False,
) -> None:
    record_usage(
        db,
        UsageRecord(
            feature=feature,
            user_id=user_id,
            provider="system" if user_id is not None else "anonymous",
            model=model,
            prompt_tokens=prompt_tokens,
            prompt_cache_hit_tokens=0,
            prompt_cache_miss_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            estimated=estimated,
        ),
    )


def test_compute_cost_cents_flash_round_trip() -> None:
    assert compute_cost_cents(
        model="deepseek-v4-flash",
        prompt_cache_hit_tokens=0,
        prompt_cache_miss_tokens=1_000_000,
        completion_tokens=1_000_000,
    ) == 42


def test_compute_cost_cents_unknown_model_returns_none() -> None:
    assert compute_cost_cents(
        model="user-byom-mystery-model",
        prompt_cache_hit_tokens=0,
        prompt_cache_miss_tokens=1000,
        completion_tokens=500,
    ) is None


def test_compute_cost_cents_with_cache_hit_savings() -> None:
    assert compute_cost_cents(
        model="deepseek-v4-flash",
        prompt_cache_hit_tokens=1_000_000,
        prompt_cache_miss_tokens=0,
        completion_tokens=0,
    ) == 0


def test_model_prices_known_keys_complete() -> None:
    expected = {
        "deepseek-v4-flash",
        "deepseek-v4-pro",
        "deepseek-chat",
        "deepseek-reasoner",
    }
    assert expected.issubset(set(MODEL_PRICES.keys()))


def test_record_usage_persists_cost_tokens_and_estimated_flag(session: Session) -> None:
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
            estimated=True,
        ),
    )
    assert row.id is not None
    assert row.total_tokens == 2_000_000
    assert row.cost_cents == 42
    assert row.estimated is True


def test_user_usage_summary_zero_pads_empty_window(session: Session) -> None:
    user = _make_user(session)
    summary = get_user_usage_summary(session, user_id=user.id)
    assert summary.total_tokens == 0
    assert summary.total_cost_cents == 0
    assert len(summary.recent_days) == 30
    assert all(day.tokens == 0 for day in summary.recent_days)


def test_user_usage_summary_aggregates_features_and_none_cost(session: Session) -> None:
    user = _make_user(session)
    _record_sample(session, user_id=user.id, feature="qa")
    _record_sample(session, user_id=user.id, feature="essay_grading")
    _record_sample(
        session,
        user_id=user.id,
        feature="qa",
        model="byom-mystery",
        prompt_tokens=1000,
        completion_tokens=500,
    )
    summary = get_user_usage_summary(session, user_id=user.id)
    assert set(summary.by_feature.keys()) == {"qa", "essay_grading"}
    assert summary.by_feature["essay_grading"].prompt_tokens == 10
    assert summary.by_feature["qa"].cost_cents is None
    assert summary.total_cost_cents is None


def test_admin_usage_summary_includes_all_users_and_anonymous(session: Session) -> None:
    alice = _make_user(session, username="alice")
    bob = _make_user(session, username="bob")
    _record_sample(session, user_id=alice.id)
    _record_sample(session, user_id=bob.id)
    _record_sample(session, user_id=bob.id)
    _record_sample(session, user_id=None)
    summary = get_admin_usage_summary(session)
    assert summary.total_tokens == 60
    assert summary.by_user is not None
    assert summary.by_user[0].username == "bob"
    assert summary.by_user[0].total_tokens == 30
    assert any(item.user_id is None for item in summary.by_user)


def test_admin_usage_summary_sorts_by_user_desc(session: Session) -> None:
    alice = _make_user(session, username="alice")
    bob = _make_user(session, username="bob")
    _record_sample(session, user_id=alice.id)
    _record_sample(session, user_id=bob.id)
    _record_sample(session, user_id=bob.id)
    _record_sample(session, user_id=None)
    _record_sample(session, user_id=None)
    summary = get_admin_usage_summary(session)
    assert summary.by_user is not None
    assert summary.by_user[0].username == "bob"
    assert summary.by_user[0].total_tokens == 30
    assert summary.by_user[1].user_id is None
    assert summary.by_user[1].total_tokens == 30
    assert summary.by_user[2].username == "alice"


def test_cutoff_for_window_math() -> None:
    today = date(2026, 4, 29)
    assert _cutoff_for_window(today, 30) == datetime(2026, 3, 31, 0, 0, 0)
    assert _cutoff_for_window(today, 1) == datetime(2026, 4, 29, 0, 0, 0)
    assert _cutoff_for_window(today, 7) == datetime(2026, 4, 23, 0, 0, 0)


def test_user_usage_summary_cutoff_excludes_old_row(session: Session) -> None:
    user = _make_user(session)
    _record_sample(session, user_id=user.id)
    row = session.query(LlmTokenUsage).filter_by(user_id=user.id).first()
    assert row is not None
    row.created_at = datetime.combine(
        datetime.now(UTC).date() - timedelta(days=30),
        time(23, 59, 30),
    )
    session.flush()
    summary = get_user_usage_summary(session, user_id=user.id, days=30)
    assert summary.total_tokens == 0


def test_user_usage_summary_cutoff_includes_window_start(session: Session) -> None:
    user = _make_user(session)
    _record_sample(session, user_id=user.id)
    row = session.query(LlmTokenUsage).filter_by(user_id=user.id).first()
    assert row is not None
    row.created_at = datetime.combine(
        datetime.now(UTC).date() - timedelta(days=29),
        time(0, 0, 0),
    )
    session.flush()
    summary = get_user_usage_summary(session, user_id=user.id, days=30)
    assert summary.total_tokens == 15


@pytest.fixture
def session() -> Iterator[Session]:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    session_local = sessionmaker(
        bind=engine,
        autoflush=False,
        expire_on_commit=False,
        future=True,
    )
    db = session_local()
    try:
        yield db
    finally:
        db.close()
