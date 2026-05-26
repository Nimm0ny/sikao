"""Quota checks for Home LLM features."""

from __future__ import annotations

from datetime import UTC, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import LlmCallV2
from sikao_api.modules.system.application.errors import QuotaExceededError

_PER_PURPOSE_DAILY_LIMITS: dict[str, int] = {
    "plan_generate": 5,
    "plan_regenerate_range": 5,
    "plan_adjust": 3,
    "recommend_today": 50,
    "review_cause_analysis": 20,
    "review_cause_analysis_deep": 5,
    "notes_ai_summary": 20,
    "notes_weekly_review": 20,
    "question_generation": 30,
    "essay_grading": 5,
    "reference_generation": 10,
}
_SHARED_NOTES_LLM_PURPOSES = {
    "review_cause_analysis",
    "review_cause_analysis_deep",
    "question_generation",
    "notes_ai_summary",
    "notes_weekly_review",
}
_SHARED_NOTES_LLM_DAILY_LIMIT = 20
_CN_OFFSET = timedelta(hours=8)


class HomeLlmQuotaService:
    def __init__(self, session: Session, settings: Settings) -> None:
        self.session = session
        self.settings = settings

    def check_quota(
        self,
        *,
        user_id: int,
        purpose: str,
        global_calls_needed: int = 1,
    ) -> None:
        now_cn = datetime.now(UTC) + _CN_OFFSET
        start = (
            datetime.combine(now_cn.date(), time.min).replace(tzinfo=UTC) - _CN_OFFSET
        ).replace(tzinfo=None)
        call_limit = _PER_PURPOSE_DAILY_LIMITS.get(
            purpose,
            self.settings.llm_quota_per_user_per_day,
        )
        total_count = self.session.scalar(
            select(func.count(LlmCallV2.id)).where(
                LlmCallV2.user_id == user_id,
                LlmCallV2.created_at >= start,
            )
        )
        if purpose in _SHARED_NOTES_LLM_PURPOSES:
            shared_count = self.session.scalar(
                select(func.count(LlmCallV2.id)).where(
                    LlmCallV2.user_id == user_id,
                    LlmCallV2.purpose.in_(tuple(_SHARED_NOTES_LLM_PURPOSES)),
                    LlmCallV2.created_at >= start,
                )
            )
            if int(shared_count or 0) + global_calls_needed > _SHARED_NOTES_LLM_DAILY_LIMIT:
                raise QuotaExceededError(
                    "daily llm shared notes quota exceeded",
                    code="llm_daily_call_quota_exceeded",
                )
        if int(total_count or 0) + global_calls_needed > self.settings.llm_quota_per_user_per_day:
            raise QuotaExceededError(
                "daily llm call quota exceeded",
                code="llm_daily_call_quota_exceeded",
            )
        count, cost = self.session.execute(
            select(
                func.count(LlmCallV2.id),
                func.coalesce(func.sum(LlmCallV2.cost_cny), 0),
            ).where(
                LlmCallV2.user_id == user_id,
                LlmCallV2.purpose == purpose,
                LlmCallV2.created_at >= start,
            )
        ).one()
        if int(count or 0) >= call_limit:
            raise QuotaExceededError(
                f"daily {purpose} quota exceeded",
                code=f"{purpose}_quota_exceeded",
            )
        total_cost = self.session.scalar(
            select(func.coalesce(func.sum(LlmCallV2.cost_cny), 0)).where(
                LlmCallV2.user_id == user_id,
                LlmCallV2.created_at >= start,
            )
        )
        if Decimal(str(total_cost or 0)) >= Decimal(str(self.settings.llm_quota_per_user_cost_cny_per_day)):
            raise QuotaExceededError(
                "daily llm cost quota exceeded",
                code="llm_daily_cost_quota_exceeded",
            )
