from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Event

import pytest
from sqlalchemy import select

from sikao_api.core.home_scheduler import HomeScheduler
from sikao_api.db.models_v2 import AuditLogV2, PlanAdjustmentV2, PlanEventV2, RecommendationV2
from sikao_api.modules.system.application.home_runtime import HomeRuntimeOrchestrator, SkippedEventHookPayload

from _home_phase_m5_support import (
    build_client,
    load_user,
    register_user,
    seed_active_plan,
    seed_event,
    seed_recommendation,
)


class _HookRuntime:
    def __init__(self) -> None:
        self.login_called = Event()
        self.skipped_called = Event()

    async def run_daily_progress_snapshot(self) -> int:
        return 0

    async def run_weekly_weakness_snapshot(self) -> int:
        return 0

    async def run_event_status_tick(self):
        return [SkippedEventHookPayload(user_id=1, plan_id=2, event_id=3)]

    async def run_cleanup_expired(self):
        return {"adjustments": 0, "recommendations": 0}

    async def run_cleanup_soft_deleted_events(self) -> int:
        return 0

    async def run_daily_plan_adjust(self) -> int:
        return 0

    async def run_login_adjustment_check(self, *, user_id: int, request_id: str | None) -> bool:
        del user_id, request_id
        self.login_called.set()
        return True

    async def run_submit_progress_hooks(self, *, user_id: int) -> None:
        del user_id

    async def run_skipped_adjustment_check(
        self,
        *,
        user_id: int,
        plan_id: int,
        event_id: int,
        occurrence_ref: str | None,
        request_id: str | None,
    ) -> bool:
        del user_id, plan_id, event_id, occurrence_ref, request_id
        self.skipped_called.set()
        return True

    async def run_submit_recommender_refresh(
        self,
        *,
        user_id: int,
        session_id: int,
        request_id: str | None,
    ) -> bool:
        del user_id, session_id, request_id
        return True


def test_daily_plan_adjust_creates_proposal_and_cleanup_expires_it(tmp_path: Path) -> None:
    with build_client(tmp_path, home_scheduler_enabled=False) as (client, app):
        register_user(client)
        user = load_user(app)
        plan_id = seed_active_plan(app, user_id=user.id)
        runtime = HomeRuntimeOrchestrator(app.state.db, app.state.settings)

        created = asyncio.run(runtime.run_daily_plan_adjust())
        assert created == 1

        session = app.state.db.session_factory()
        try:
            adjustment = session.scalar(
                select(PlanAdjustmentV2).where(
                    PlanAdjustmentV2.user_id == user.id,
                    PlanAdjustmentV2.plan_id == plan_id,
                )
            )
            assert adjustment is not None
            adjustment.expires_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=1)
            session.add(adjustment)
            session.commit()
        finally:
            session.close()

        cleanup_counts = asyncio.run(runtime.run_cleanup_expired())
        assert cleanup_counts["adjustments"] == 1

        session = app.state.db.session_factory()
        try:
            refreshed = session.scalar(
                select(PlanAdjustmentV2).where(
                    PlanAdjustmentV2.user_id == user.id,
                    PlanAdjustmentV2.plan_id == plan_id,
                )
            )
            audits = list(
                session.scalars(
                    select(AuditLogV2).where(
                        AuditLogV2.user_id == user.id,
                        AuditLogV2.action.in_(("plan_adjustment.proposed", "plan_adjustment.expired")),
                    )
                )
            )
        finally:
            session.close()

    assert refreshed is not None and refreshed.status == "expired"
    assert {row.action for row in audits} == {"plan_adjustment.proposed", "plan_adjustment.expired"}


def test_recent_rejected_adjustment_suppresses_duplicate_proposal(tmp_path: Path) -> None:
    with build_client(tmp_path, home_scheduler_enabled=False) as (client, app):
        register_user(client)
        user = load_user(app)
        plan_id = seed_active_plan(app, user_id=user.id)
        runtime = HomeRuntimeOrchestrator(app.state.db, app.state.settings)

        assert asyncio.run(runtime.run_daily_plan_adjust()) == 1

        session = app.state.db.session_factory()
        try:
            adjustment = session.scalar(
                select(PlanAdjustmentV2).where(
                    PlanAdjustmentV2.user_id == user.id,
                    PlanAdjustmentV2.plan_id == plan_id,
                )
            )
            assert adjustment is not None
            adjustment.status = "rejected"
            adjustment.user_reject_reason = "not_now"
            adjustment.decided_at = datetime.now(UTC).replace(tzinfo=None)
            session.add(adjustment)
            session.commit()
        finally:
            session.close()

        created = asyncio.run(
            runtime.run_login_adjustment_check(user_id=user.id, request_id="req-login")
        )
        assert created is False

        session = app.state.db.session_factory()
        try:
            adjustments = list(
                session.scalars(
                    select(PlanAdjustmentV2).where(
                        PlanAdjustmentV2.user_id == user.id,
                        PlanAdjustmentV2.plan_id == plan_id,
                    )
                )
            )
            audits = list(
                session.scalars(
                    select(AuditLogV2).where(
                        AuditLogV2.user_id == user.id,
                        AuditLogV2.action == "plan_adjustment.suppressed_after_reject",
                    )
                )
            )
        finally:
            session.close()

    assert len(adjustments) == 1
    assert adjustments[0].status == "rejected"
    assert len(audits) == 1


def test_cleanup_jobs_expire_recommendations_and_purge_soft_deleted_events(tmp_path: Path) -> None:
    with build_client(tmp_path, home_scheduler_enabled=False) as (client, app):
        register_user(client)
        user = load_user(app)
        plan_id = seed_active_plan(app, user_id=user.id)
        now = datetime.now(UTC).replace(tzinfo=None)
        event_id = seed_event(
            app,
            user_id=user.id,
            plan_id=plan_id,
            title="Old deleted event",
            start_at=now - timedelta(days=40, hours=1),
            end_at=now - timedelta(days=40),
            deleted_at=now - timedelta(days=31),
        )
        recommendation_id = seed_recommendation(
            app,
            user_id=user.id,
            generated_at=now - timedelta(hours=5),
            expires_at=now - timedelta(minutes=1),
            title="Expire me",
        )

        runtime = HomeRuntimeOrchestrator(app.state.db, app.state.settings)
        cleanup_counts = asyncio.run(runtime.run_cleanup_expired())
        deleted_count = asyncio.run(runtime.run_cleanup_soft_deleted_events())

        session = app.state.db.session_factory()
        try:
            recommendation = session.get(RecommendationV2, recommendation_id)
            event = session.get(PlanEventV2, event_id)
            audits = list(
                session.scalars(
                    select(AuditLogV2).where(
                        AuditLogV2.user_id == user.id,
                        AuditLogV2.action.in_(("recommendation.expired", "plan_event.cleanup_delete")),
                    )
                )
            )
        finally:
            session.close()

    assert cleanup_counts["recommendations"] == 1
    assert deleted_count == 1
    assert recommendation is not None and recommendation.status == "expired"
    assert event is None
    assert {row.action for row in audits} == {"recommendation.expired", "plan_event.cleanup_delete"}


def test_login_route_enqueues_adjustment_check(tmp_path: Path, monkeypatch) -> None:
    runtime = _HookRuntime()

    def _build_scheduler(db, *, settings, runtime=None):
        del runtime
        return HomeScheduler(db, settings=settings, runtime=runtime_obj)

    runtime_obj = runtime
    monkeypatch.setattr("sikao_api.core.home_scheduler.build_home_scheduler", _build_scheduler)

    with build_client(tmp_path, home_scheduler_enabled=True) as (client, _app):
        register_user(client)
        assert client.post("/api/v2/auth/logout").status_code == 200
        response = client.post(
            "/api/v2/auth/login",
            json={"identifier": "alice@example.com", "password": "secret123"},
        )
        assert response.status_code == 200, response.text
        assert runtime.login_called.wait(timeout=2.0) is True


@pytest.mark.asyncio
async def test_event_status_tick_enqueues_skipped_hook(tmp_path: Path) -> None:
    from sikao_api.core.config import Settings
    from sikao_api.db.session import DatabaseManager

    settings = Settings(
        app_env="test",
        llm_provider="mock",
        home_scheduler_enabled=True,
        database_url=f"sqlite:///{(tmp_path / 'home-m5-skipped-hook.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="home-m5-skipped-secret",
        app_version="home-m5-skipped-test",
        git_sha="home-m5-skipped-sha",
        image_tag="home-m5-skipped-tag",
        build_time="2026-05-22T00:00:00Z",
        schema_version="home-m5-skipped-schema",
    )
    db = DatabaseManager(settings)
    db.create_all()
    runtime = _HookRuntime()
    scheduler = HomeScheduler(db, settings=settings, runtime=runtime)

    await scheduler.start()
    try:
        await scheduler._job_event_status_tick()
        await asyncio.sleep(0.2)
    finally:
        await scheduler.stop()

    assert runtime.skipped_called.is_set() is True
