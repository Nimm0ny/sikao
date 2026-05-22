from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import select

from sikao_api.db.models_v2 import PlanAdjustmentV2, ProfileInfoV2, UserV2
from sikao_api.scheduler import HomeSchedulerContext
from sikao_api.scheduler.jobs.plan_adjustor_daily import (
    collect_plan_adjust_candidates,
    run_plan_adjustor_daily_job,
)

from tests._home_phase_m4_support import build_client, seed_active_plan


def _job_context(app) -> HomeSchedulerContext:
    return HomeSchedulerContext(settings=app.state.settings, db=app.state.db)


def _mock_adjustment_changes() -> list[dict[str, object]]:
    base = datetime.now(UTC).replace(second=0, microsecond=0, minute=0)
    start_at = base + timedelta(days=2, hours=9)
    end_at = start_at + timedelta(minutes=60)
    return [
        {
            "action": "add",
            "event_id": None,
            "before": None,
            "after": {
                "title": "Review wrong answers",
                "category": "review",
                "notes": "Revisit the highest-frequency weak spots from the last three days.",
                "start_at": start_at.isoformat(),
                "end_at": end_at.isoformat(),
                "timezone": "Asia/Shanghai",
                "status": "planned",
            },
            "diff_summary": "Add one morning review block",
        }
    ]


def test_plan_adjustor_daily_creates_pending_adjustment_for_active_user(tmp_path: Path) -> None:
    with build_client(tmp_path) as (_client, app):
        session = app.state.db.session_factory()
        try:
            user = UserV2(display_name="Alice")
            session.add(user)
            session.flush()
            plan = seed_active_plan(user=user, name="Adjust daily")
            session.add(plan)
            session.commit()
        finally:
            session.close()

        result = __import__("asyncio").run(run_plan_adjustor_daily_job(_job_context(app)))
        assert result.generated == 1

        session = app.state.db.session_factory()
        try:
            rows = list(session.scalars(select(PlanAdjustmentV2)))
            assert len(rows) == 1
            assert rows[0].status == "pending"
            assert rows[0].source == "cron_daily"
        finally:
            session.close()


def test_plan_adjustor_daily_skips_same_day_existing_adjustment(tmp_path: Path) -> None:
    with build_client(tmp_path) as (_client, app):
        session = app.state.db.session_factory()
        try:
            user = UserV2(display_name="Alice")
            session.add(user)
            session.flush()
            plan = seed_active_plan(user=user, name="Adjust daily")
            session.add(plan)
            session.flush()
            session.add(
                PlanAdjustmentV2(
                    plan_id=plan.id,
                    user_id=user.id,
                    proposed_at=datetime.now(UTC).replace(tzinfo=None),
                    expires_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=24),
                    reason="existing",
                    changes=[],
                    status="pending",
                    source="cron_daily",
                )
            )
            session.commit()
        finally:
            session.close()

        result = __import__("asyncio").run(run_plan_adjustor_daily_job(_job_context(app)))
        assert result.generated == 0
        assert result.skipped_same_day == 1


def test_plan_adjustor_daily_skips_users_with_ai_adjust_disabled(tmp_path: Path) -> None:
    with build_client(tmp_path) as (_client, app):
        session = app.state.db.session_factory()
        try:
            user = UserV2(display_name="Alice")
            session.add(user)
            session.flush()
            plan = seed_active_plan(user=user, name="Adjust daily")
            session.add(plan)
            session.flush()
            session.add(ProfileInfoV2(user_id=user.id, ai_adjust_enabled=False))
            session.commit()
        finally:
            session.close()

        candidates = collect_plan_adjust_candidates(_job_context(app))
        assert candidates == []


def test_plan_adjustor_daily_drops_recently_rejected_equivalent_adjustment(tmp_path: Path) -> None:
    with build_client(tmp_path) as (_client, app):
        session = app.state.db.session_factory()
        try:
            user = UserV2(display_name="Alice")
            session.add(user)
            session.flush()
            plan = seed_active_plan(user=user, name="Adjust daily")
            session.add(plan)
            session.flush()
            session.add(
                PlanAdjustmentV2(
                    plan_id=plan.id,
                    user_id=user.id,
                    proposed_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=23),
                    expires_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=1),
                    decided_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=22),
                    reason="old reject",
                    changes=_mock_adjustment_changes(),
                    status="rejected",
                    source="cron_daily",
                    user_reject_reason="not now",
                )
            )
            session.commit()
        finally:
            session.close()

        result = __import__("asyncio").run(run_plan_adjustor_daily_job(_job_context(app)))
        assert result.generated == 0
        assert result.skipped_rejected_duplicate == 1

        session = app.state.db.session_factory()
        try:
            rows = list(session.scalars(select(PlanAdjustmentV2).where(PlanAdjustmentV2.status == "pending")))
            assert rows == []
        finally:
            session.close()
