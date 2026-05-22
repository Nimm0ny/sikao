from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import PlanAdjustmentV2, PlanEventV2, PlanV2, ProfileInfoV2, UserV2
from sikao_api.modules.llm.application.plan_adjustor import PlanAdjustmentContext
from sikao_api.modules.llm.application.service import HomeLlmService
from sikao_api.modules.llm.application.window_queries import load_window_events
from sikao_api.modules.plans.application.helpers import now_utc, serialize_plan
from sikao_api.modules.progress.application.service import build_progress_overview
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.scheduler.jobs._shared import (
    HOME_SCHEDULER_ACTOR_ID,
    HOME_SCHEDULER_ACTOR_TYPE,
    build_request_id,
    local_day_bounds,
    next_n_days_window,
    run_with_session,
    stable_json_hash,
)
from sikao_api.scheduler.registry import HomeSchedulerContext, HomeSchedulerJob

JOB_ID = "home.plan_adjustor_daily"


@dataclass(frozen=True, slots=True)
class PlanAdjustCandidate:
    user_id: int
    plan_id: int


@dataclass(frozen=True, slots=True)
class PlanAdjustorDailyResult:
    generated: int
    skipped_same_day: int
    skipped_rejected_duplicate: int
    skipped_no_adjustment: int


def build_plan_adjustor_daily_job(settings: Settings) -> HomeSchedulerJob:
    return HomeSchedulerJob(
        job_id=JOB_ID,
        name=JOB_ID,
        trigger=CronTrigger(
            hour=settings.home_plan_adjustor_hour,
            minute=settings.home_plan_adjustor_minute,
            timezone=settings.home_scheduler_timezone,
        ),
        func=run_plan_adjustor_daily_job,
    )


async def run_plan_adjustor_daily_job(context: HomeSchedulerContext) -> PlanAdjustorDailyResult:
    candidates = await asyncio.to_thread(collect_plan_adjust_candidates, context)
    generated = 0
    skipped_same_day = 0
    skipped_rejected_duplicate = 0
    skipped_no_adjustment = 0
    for candidate in candidates:
        outcome = await asyncio.to_thread(sync_process_plan_adjust_candidate, context, candidate)
        if outcome == "generated":
            generated += 1
        elif outcome == "skipped_same_day":
            skipped_same_day += 1
        elif outcome == "skipped_rejected_duplicate":
            skipped_rejected_duplicate += 1
        else:
            skipped_no_adjustment += 1
    return PlanAdjustorDailyResult(
        generated=generated,
        skipped_same_day=skipped_same_day,
        skipped_rejected_duplicate=skipped_rejected_duplicate,
        skipped_no_adjustment=skipped_no_adjustment,
    )


def collect_plan_adjust_candidates(context: HomeSchedulerContext) -> list[PlanAdjustCandidate]:
    def _collect(session: Session) -> list[PlanAdjustCandidate]:
        rows = session.execute(
            select(PlanV2.id, PlanV2.user_id)
            .select_from(PlanV2)
            .join(UserV2, UserV2.id == PlanV2.user_id)
            .outerjoin(ProfileInfoV2, ProfileInfoV2.user_id == UserV2.id)
            .where(
                PlanV2.status == "active",
                PlanV2.deleted_at.is_(None),
                UserV2.is_active.is_(True),
                UserV2.deleted_at.is_(None),
                (ProfileInfoV2.id.is_(None) | ProfileInfoV2.ai_adjust_enabled.is_(True)),
            )
            .order_by(PlanV2.user_id.asc(), PlanV2.id.asc())
        ).all()
        return [PlanAdjustCandidate(user_id=user_id, plan_id=plan_id) for plan_id, user_id in rows]

    return run_with_session(context, _collect)


def sync_process_plan_adjust_candidate(
    context: HomeSchedulerContext,
    candidate: PlanAdjustCandidate,
) -> str:
    request_id = build_request_id(JOB_ID)

    def _process(session: Session) -> str:
        now = now_utc()
        user = session.get(UserV2, candidate.user_id)
        plan = session.get(PlanV2, candidate.plan_id)
        if user is None or plan is None:
            return "skipped_no_adjustment"
        if _has_same_day_adjustment(
            session=session,
            user_id=user.id,
            timezone=context.settings.home_scheduler_timezone,
            now=now,
        ):
            add_audit_log(
                session,
                user_id=user.id,
                actor_type=HOME_SCHEDULER_ACTOR_TYPE,
                actor_id=HOME_SCHEDULER_ACTOR_ID,
                action="plan_adjustment.skip_same_day",
                target_type="plan_v2",
                target_id=plan.id,
                metadata={"job_id": JOB_ID},
                request_id=request_id,
            )
            return "skipped_same_day"

        payload = _build_adjustment_payload(
            session=session,
            plan=plan,
            user=user,
            timezone=context.settings.home_scheduler_timezone,
            now=now,
        )
        service = HomeLlmService(session, context.settings)
        adjustment = asyncio.run(
            service.adjust_plan(
                user=user,
                context=PlanAdjustmentContext(
                    plan_id=plan.id,
                    source="cron_daily",
                    payload=payload,
                ),
            )
        )
        if adjustment is None:
            return "skipped_no_adjustment"
        if _matches_recent_rejected_adjustment(
            session=session,
            user_id=user.id,
            plan_id=plan.id,
            adjustment=adjustment,
            now=now,
        ):
            add_audit_log(
                session,
                user_id=user.id,
                actor_type=HOME_SCHEDULER_ACTOR_TYPE,
                actor_id=HOME_SCHEDULER_ACTOR_ID,
                action="plan_adjustment.skip_rejected_duplicate",
                target_type="plan_v2",
                target_id=plan.id,
                metadata={"job_id": JOB_ID},
                request_id=request_id,
            )
            session.delete(adjustment)
            return "skipped_rejected_duplicate"
        add_audit_log(
            session,
            user_id=user.id,
            actor_type=HOME_SCHEDULER_ACTOR_TYPE,
            actor_id=HOME_SCHEDULER_ACTOR_ID,
            action="plan_adjustment.generate_daily",
            target_type="plan_adjustment_v2",
            target_id=adjustment.id,
            after={"status": adjustment.status, "source": adjustment.source},
            metadata={"job_id": JOB_ID, "plan_id": plan.id},
            request_id=request_id,
        )
        return "generated"

    return run_with_session(context, _process)


def _build_adjustment_payload(
    *,
    session: Session,
    plan: PlanV2,
    user: UserV2,
    timezone: str,
    now: datetime,
) -> dict[str, object]:
    from_date, to_date = next_n_days_window(anchor_day=HomeLlmService.today_cn(), timezone=timezone, days=7)
    progress = build_progress_overview(session, user=user, plan_id=plan.id)
    future_events = load_window_events(
        session,
        user_id=user.id,
        plan_id=plan.id,
        from_date=from_date,
        to_date=to_date,
        timezone=timezone,
    )
    overdue_rows = list(
        session.scalars(
            select(PlanEventV2).where(
                PlanEventV2.user_id == user.id,
                PlanEventV2.plan_id == plan.id,
                PlanEventV2.deleted_at.is_(None),
                PlanEventV2.end_at <= now,
                PlanEventV2.end_at >= now - timedelta(hours=24),
            )
        )
    )
    return {
        "trigger": "cron_daily",
        "plan": serialize_plan(plan),
        "future_events": future_events,
        "recent_overdue_events": [
            {
                "id": row.id,
                "title": row.title,
                "status": row.status,
                "start_at": row.start_at.replace(tzinfo=UTC).isoformat().replace("+00:00", "Z"),
                "end_at": row.end_at.replace(tzinfo=UTC).isoformat().replace("+00:00", "Z"),
            }
            for row in overdue_rows
        ],
        "progress_summary": progress.summary.model_dump(mode="json"),
        "weakness_top3": [item.model_dump(mode="json") for item in progress.weakness_top3],
        "nearest_exam_target": (
            progress.nearest_exam_target.model_dump(mode="json")
            if progress.nearest_exam_target is not None
            else None
        ),
        "policy": {
            "daily_banner_limit": 1,
            "reject_duplicate_window_hours": 24,
            "future_only": True,
        },
    }


def _has_same_day_adjustment(*, session: Session, user_id: int, timezone: str, now: datetime) -> bool:
    day_start, next_day_start = local_day_bounds(instant=now, timezone=timezone)
    existing = session.scalar(
        select(PlanAdjustmentV2.id).where(
            PlanAdjustmentV2.user_id == user_id,
            PlanAdjustmentV2.proposed_at >= day_start,
            PlanAdjustmentV2.proposed_at < next_day_start,
        )
    )
    return existing is not None


def _matches_recent_rejected_adjustment(
    *,
    session: Session,
    user_id: int,
    plan_id: int,
    adjustment: PlanAdjustmentV2,
    now: datetime,
) -> bool:
    current_hash = stable_json_hash({"plan_id": plan_id, "changes": adjustment.changes})
    recent_rejected = list(
        session.scalars(
            select(PlanAdjustmentV2).where(
                PlanAdjustmentV2.user_id == user_id,
                PlanAdjustmentV2.status == "rejected",
                PlanAdjustmentV2.proposed_at >= now - timedelta(hours=24),
            )
        )
    )
    return any(
        stable_json_hash({"plan_id": row.plan_id, "changes": row.changes}) == current_hash
        for row in recent_rejected
    )
