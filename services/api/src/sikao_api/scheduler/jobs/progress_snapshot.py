from __future__ import annotations

from sqlalchemy import select
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import UserV2
from sikao_api.modules.progress.application.snapshot_writer import refresh_daily_progress_snapshot
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.scheduler.jobs._shared import (
    HOME_SCHEDULER_ACTOR_ID,
    HOME_SCHEDULER_ACTOR_TYPE,
    build_request_id,
    run_sync_job,
    run_with_session,
)
from sikao_api.scheduler.registry import HomeSchedulerContext, HomeSchedulerJob

JOB_ID = "home.progress_snapshot"


def build_progress_snapshot_job(settings: Settings) -> HomeSchedulerJob:
    return HomeSchedulerJob(
        job_id=JOB_ID,
        name=JOB_ID,
        trigger=CronTrigger(
            hour=settings.home_progress_snapshot_hour,
            minute=settings.home_progress_snapshot_minute,
            timezone=settings.home_scheduler_timezone,
        ),
        func=run_progress_snapshot_job,
    )


async def run_progress_snapshot_job(context: HomeSchedulerContext) -> int:
    return await run_sync_job(context, sync_run_progress_snapshot_job)


def sync_run_progress_snapshot_job(context: HomeSchedulerContext) -> int:
    request_id = build_request_id(JOB_ID)
    user_ids = run_with_session(
        context,
        lambda session: list(
            session.scalars(
                select(UserV2.id)
                .where(UserV2.is_active.is_(True), UserV2.deleted_at.is_(None))
                .order_by(UserV2.id.asc())
            )
        ),
    )
    processed = 0
    for user_id in user_ids:
        def _write(session: Session) -> int:
            snapshot = refresh_daily_progress_snapshot(session, user_id=user_id)
            add_audit_log(
                session,
                user_id=user_id,
                actor_type=HOME_SCHEDULER_ACTOR_TYPE,
                actor_id=HOME_SCHEDULER_ACTOR_ID,
                action="progress_snapshot.refresh",
                target_type="progress_snapshot_v2",
                target_id=snapshot.id,
                after={
                    "snapshot_date": snapshot.snapshot_date.isoformat(),
                    "data": snapshot.data_json,
                },
                metadata={"job_id": JOB_ID},
                request_id=request_id,
            )
            return snapshot.id

        run_with_session(context, _write)
        processed += 1
    return processed
