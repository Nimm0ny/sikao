from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sikao_api.db.models_v2 import PlanAdjustmentV2, PlanEventV2, PracticeSessionV2, RecommendationV2, UserV2
from sikao_api.scheduler import HomeSchedulerContext
from sikao_api.scheduler.jobs.cleanup_expired import sync_run_cleanup_expired_job
from sikao_api.scheduler.jobs.cleanup_soft_deleted import sync_run_cleanup_soft_deleted_job

from tests._home_phase_m4_support import build_client, seed_active_plan


def _job_context(app) -> HomeSchedulerContext:
    return HomeSchedulerContext(settings=app.state.settings, db=app.state.db)


def test_cleanup_expired_marks_pending_adjustments_and_recommendations_expired(tmp_path) -> None:
    with build_client(tmp_path) as (_client, app):
        session = app.state.db.session_factory()
        try:
            user = UserV2(display_name="Alice")
            session.add(user)
            session.flush()
            plan = seed_active_plan(user=user, name="Cleanup")
            session.add(plan)
            session.flush()
            adjustment = PlanAdjustmentV2(
                plan_id=plan.id,
                user_id=user.id,
                proposed_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=1),
                expires_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=1),
                reason="expired",
                changes=[],
                status="pending",
                source="cron_daily",
            )
            recommendation = RecommendationV2(
                user_id=user.id,
                title="Review",
                reason="expired",
                estimated_minutes=15,
                cta="Review",
                action_type="review",
                payload={},
                expires_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=1),
                status="pending",
                source_signals={},
            )
            session.add_all([adjustment, recommendation])
            session.commit()
            adjustment_id = adjustment.id
            recommendation_id = recommendation.id
        finally:
            session.close()

        result = sync_run_cleanup_expired_job(_job_context(app))
        assert result.expired_adjustments == 1
        assert result.expired_recommendations == 1

        session = app.state.db.session_factory()
        try:
            adjustment = session.get(PlanAdjustmentV2, adjustment_id)
            recommendation = session.get(RecommendationV2, recommendation_id)
            assert adjustment is not None and adjustment.status == "expired"
            assert adjustment.decided_at is not None
            assert recommendation is not None and recommendation.status == "expired"
        finally:
            session.close()


def test_cleanup_soft_deleted_physically_deletes_old_events_and_preserves_sessions(tmp_path) -> None:
    with build_client(tmp_path) as (_client, app):
        session = app.state.db.session_factory()
        try:
            user = UserV2(display_name="Alice")
            session.add(user)
            session.flush()
            plan = seed_active_plan(user=user, name="Cleanup")
            session.add(plan)
            session.flush()
            old_deleted = PlanEventV2(
                plan_id=plan.id,
                user_id=user.id,
                title="Old deleted",
                category="custom",
                notes="",
                start_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=40, hours=2),
                end_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=40, hours=1),
                timezone="Asia/Shanghai",
                recurring_rule=None,
                recurring_exception_dates=[],
                status="skipped",
                source="user_manual",
                change_log=[],
                deleted_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=31),
            )
            alive_deleted = PlanEventV2(
                plan_id=plan.id,
                user_id=user.id,
                title="Recent deleted",
                category="custom",
                notes="",
                start_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=10, hours=2),
                end_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=10, hours=1),
                timezone="Asia/Shanghai",
                recurring_rule=None,
                recurring_exception_dates=[],
                status="skipped",
                source="user_manual",
                change_log=[],
                deleted_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=10),
            )
            session.add_all([old_deleted, alive_deleted])
            session.flush()
            linked_session = PracticeSessionV2(
                user_id=user.id,
                track="xingce",
                entry_kind="manual",
                status="submitted",
                started_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=40, hours=2),
                submitted_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=40, hours=1, minutes=10),
                payload_json={},
                linked_plan_event_id=old_deleted.id,
            )
            session.add(linked_session)
            session.commit()
            old_deleted_id = old_deleted.id
            alive_deleted_id = alive_deleted.id
            linked_session_id = linked_session.id
        finally:
            session.close()

        result = sync_run_cleanup_soft_deleted_job(_job_context(app))
        assert result.deleted_events == 1

        session = app.state.db.session_factory()
        try:
            assert session.get(PlanEventV2, old_deleted_id) is None
            assert session.get(PlanEventV2, alive_deleted_id) is not None
            linked_session = session.get(PracticeSessionV2, linked_session_id)
            assert linked_session is not None
            assert linked_session.linked_plan_event_id is None
        finally:
            session.close()


def test_cleanup_soft_deleted_removes_recurring_parent_and_detached_children(tmp_path) -> None:
    with build_client(tmp_path) as (_client, app):
        session = app.state.db.session_factory()
        try:
            user = UserV2(display_name="Alice")
            session.add(user)
            session.flush()
            plan = seed_active_plan(user=user, name="Cleanup recurring")
            session.add(plan)
            session.flush()
            parent = PlanEventV2(
                plan_id=plan.id,
                user_id=user.id,
                title="Recurring parent",
                category="review",
                notes="",
                start_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=40, hours=2),
                end_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=40, hours=1),
                timezone="Asia/Shanghai",
                recurring_rule="FREQ=DAILY;COUNT=2",
                recurring_exception_dates=["2026-05-01"],
                status="planned",
                source="ai_generated",
                change_log=[],
                deleted_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=31),
            )
            session.add(parent)
            session.flush()
            detached = PlanEventV2(
                plan_id=plan.id,
                user_id=user.id,
                title="Detached child",
                category="review",
                notes="",
                start_at=parent.start_at + timedelta(days=1),
                end_at=parent.end_at + timedelta(days=1),
                timezone="Asia/Shanghai",
                recurring_rule=None,
                recurring_parent_id=parent.id,
                recurring_exception_dates=[],
                status="skipped",
                source="ai_generated",
                change_log=[],
                deleted_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=31),
            )
            session.add(detached)
            session.commit()
            parent_id = parent.id
            detached_id = detached.id
        finally:
            session.close()

        result = sync_run_cleanup_soft_deleted_job(_job_context(app))
        assert result.deleted_events == 2

        session = app.state.db.session_factory()
        try:
            assert session.get(PlanEventV2, parent_id) is None
            assert session.get(PlanEventV2, detached_id) is None
        finally:
            session.close()
