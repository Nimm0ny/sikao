from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import PlanEventV2
from sikao_api.modules.plans.application.helpers import now_utc, serialize_event
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.scheduler.jobs._shared import (
    HOME_SCHEDULER_ACTOR_ID,
    HOME_SCHEDULER_ACTOR_TYPE,
    build_request_id,
    run_sync_job,
    run_with_session,
)
from sikao_api.scheduler.registry import HomeSchedulerContext, HomeSchedulerJob

JOB_ID = "home.cleanup_soft_deleted"


@dataclass(frozen=True, slots=True)
class CleanupSoftDeletedResult:
    deleted_events: int


def build_cleanup_soft_deleted_job(settings: Settings) -> HomeSchedulerJob:
    return HomeSchedulerJob(
        job_id=JOB_ID,
        name=JOB_ID,
        trigger=CronTrigger(
            hour=settings.home_cleanup_soft_deleted_hour,
            minute=settings.home_cleanup_soft_deleted_minute,
            timezone=settings.home_scheduler_timezone,
        ),
        func=run_cleanup_soft_deleted_job,
    )


async def run_cleanup_soft_deleted_job(context: HomeSchedulerContext) -> CleanupSoftDeletedResult:
    return await run_sync_job(context, sync_run_cleanup_soft_deleted_job)


def sync_run_cleanup_soft_deleted_job(
    context: HomeSchedulerContext,
) -> CleanupSoftDeletedResult:
    cutoff = now_utc() - timedelta(days=30)
    request_id = build_request_id(JOB_ID)

    def _cleanup(session: Session) -> CleanupSoftDeletedResult:
        rows = list(
            session.scalars(
                select(PlanEventV2).where(
                    PlanEventV2.deleted_at.is_not(None),
                    PlanEventV2.deleted_at < cutoff,
                )
            )
        )
        rows_by_id = {row.id: row for row in rows}
        for row in rows:
            before = serialize_event(row)
            add_audit_log(
                session,
                user_id=row.user_id,
                actor_type=HOME_SCHEDULER_ACTOR_TYPE,
                actor_id=HOME_SCHEDULER_ACTOR_ID,
                action="plan_event.cleanup_soft_deleted",
                target_type="plan_event_v2",
                target_id=row.id,
                before=before,
                after=None,
                metadata={"job_id": JOB_ID},
                request_id=request_id,
            )
            if row.recurring_parent_id is not None and row.recurring_parent_id in rows_by_id:
                continue
            session.delete(row)
        return CleanupSoftDeletedResult(deleted_events=len(rows))

    return run_with_session(context, _cleanup)
