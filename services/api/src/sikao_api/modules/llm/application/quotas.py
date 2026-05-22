"""Quota checks for Home LLM features."""

from __future__ import annotations

from datetime import UTC, datetime, time
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import LlmCallV2
from sikao_api.modules.system.application.errors import QuotaExceededError


class HomeLlmQuotaService:
    def __init__(self, session: Session, settings: Settings) -> None:
        self.session = session
        self.settings = settings

    def check_quota(self, *, user_id: int, purpose: str) -> None:
        del purpose
        today = datetime.now(UTC).date()
        start = datetime.combine(today, time.min)
        count, cost = self.session.execute(
            select(
                func.count(LlmCallV2.id),
                func.coalesce(func.sum(LlmCallV2.cost_cny), 0),
            ).where(
                LlmCallV2.user_id == user_id,
                LlmCallV2.created_at >= start,
            )
        ).one()
        if int(count or 0) >= self.settings.llm_quota_per_user_per_day:
            raise QuotaExceededError(
                "daily llm call quota exceeded",
                code="llm_daily_call_quota_exceeded",
            )
        if Decimal(str(cost or 0)) >= Decimal(str(self.settings.llm_quota_per_user_cost_cny_per_day)):
            raise QuotaExceededError(
                "daily llm cost quota exceeded",
                code="llm_daily_cost_quota_exceeded",
            )
