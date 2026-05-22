from __future__ import annotations

from dataclasses import dataclass

from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import PlanAdjustmentV2, RecommendationV2
from sikao_api.modules.plans.application.helpers import now_utc
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.scheduler.jobs._shared import (
    HOME_SCHEDULER_ACTOR_ID,
    HOME_SCHEDULER_ACTOR_TYPE,
    build_request_id,
    run_sync_job,
    run_with_session,
)
from sikao_api.scheduler.registry import HomeSchedulerContext, HomeSchedulerJob

JOB_ID = "home.cleanup_expired"


@dataclass(frozen=True, slots=True)
class CleanupExpiredResult:
    expired_adjustments: int
    expired_recommendations: int


def build_cleanup_expired_job(settings: Settings) -> HomeSchedulerJob:
    return HomeSchedulerJob(
        job_id=JOB_ID,
        name=JOB_ID,
        trigger=CronTrigger(
            hour=settings.home_cleanup_expired_hour,
            minute=settings.home_cleanup_expired_minute,
            timezone=settings.home_scheduler_timezone,
        ),
        func=run_cleanup_expired_job,
    )


async def run_cleanup_expired_job(context: HomeSchedulerContext) -> CleanupExpiredResult:
    return await run_sync_job(context, sync_run_cleanup_expired_job)


def sync_run_cleanup_expired_job(
    context: HomeSchedulerContext,
) -> CleanupExpiredResult:
    now = now_utc()
    request_id = build_request_id(JOB_ID)

    def _cleanup(session: Session) -> CleanupExpiredResult:
        adjustments = list(
            session.scalars(
                select(PlanAdjustmentV2).where(
                    PlanAdjustmentV2.status == "pending",
                    PlanAdjustmentV2.expires_at <= now,
                )
            )
        )
        recommendations = list(
            session.scalars(
                select(RecommendationV2).where(
                    RecommendationV2.status == "pending",
                    RecommendationV2.expires_at <= now,
                )
            )
        )
        for adjustment in adjustments:
            adjustment.status = "expired"
            adjustment.decided_at = now
            session.add(adjustment)
            add_audit_log(
                session,
                user_id=adjustment.user_id,
                actor_type=HOME_SCHEDULER_ACTOR_TYPE,
                actor_id=HOME_SCHEDULER_ACTOR_ID,
                action="plan_adjustment.expire",
                target_type="plan_adjustment_v2",
                target_id=adjustment.id,
                after={"status": "expired", "decided_at": now.isoformat()},
                metadata={"job_id": JOB_ID},
                request_id=request_id,
            )
        for recommendation in recommendations:
            recommendation.status = "expired"
            session.add(recommendation)
            add_audit_log(
                session,
                user_id=recommendation.user_id,
                actor_type=HOME_SCHEDULER_ACTOR_TYPE,
                actor_id=HOME_SCHEDULER_ACTOR_ID,
                action="recommendation.expire",
                target_type="recommendation_v2",
                target_id=recommendation.id,
                after={"status": "expired"},
                metadata={"job_id": JOB_ID},
                request_id=request_id,
            )
        return CleanupExpiredResult(
            expired_adjustments=len(adjustments),
            expired_recommendations=len(recommendations),
        )

    return run_with_session(context, _cleanup)
