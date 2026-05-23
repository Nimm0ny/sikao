from __future__ import annotations

from datetime import UTC, datetime, time

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import AiGeneratedQuestionRequestV2
from sikao_api.modules.ai_questions.domain.errors import AI_QUOTA_EXCEEDED
from sikao_api.modules.system.application.errors import QuotaExceededError

_ACTIVE_REQUEST_STATUSES = ("pending", "partial_pool", "llm_generated")
_PER_USER_DAILY_LIMIT = 30


class AiQuestionsQuotaService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def check_quota(self, *, user_id: int) -> None:
        today = datetime.now(UTC).date()
        start = datetime.combine(today, time.min)
        count = self.session.scalar(
            select(func.count(AiGeneratedQuestionRequestV2.id)).where(
                AiGeneratedQuestionRequestV2.user_id == user_id,
                AiGeneratedQuestionRequestV2.started_at >= start,
                AiGeneratedQuestionRequestV2.status.in_(_ACTIVE_REQUEST_STATUSES),
            )
        )
        if int(count or 0) >= _PER_USER_DAILY_LIMIT:
            raise QuotaExceededError(
                "daily ai question quota exceeded",
                code=AI_QUOTA_EXCEEDED,
            )

