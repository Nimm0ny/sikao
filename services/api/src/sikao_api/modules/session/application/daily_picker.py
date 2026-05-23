from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import DailyPracticeV2, QuestionV2
from sikao_api.modules.progress.application.aggregates import today_cn
from sikao_api.modules.system.application.errors import NotFoundError


def pick_daily_questions(
    session: Session,
    *,
    user_id: int,
    track: str,
    config: dict[str, Any],
) -> tuple[list[QuestionV2], dict[str, Any]]:
    daily_practice_id = config.get("daily_practice_id")
    stmt = select(DailyPracticeV2).where(DailyPracticeV2.user_id == user_id, DailyPracticeV2.type == track)
    now = datetime.now(UTC).replace(tzinfo=None)
    if daily_practice_id is not None:
        stmt = stmt.where(DailyPracticeV2.id == int(daily_practice_id))
    else:
        stmt = stmt.where(DailyPracticeV2.date == today_cn())
    daily = session.scalar(
        stmt.where(
            DailyPracticeV2.status == "pending",
            DailyPracticeV2.completed_session_id.is_(None),
            DailyPracticeV2.expired_at > now,
        ).order_by(DailyPracticeV2.created_at.desc(), DailyPracticeV2.id.desc())
    )
    if daily is None:
        raise NotFoundError("daily practice not found", code="daily_practice_not_found")
    questions_by_id = {
        question.id: question
        for question in session.scalars(select(QuestionV2).where(QuestionV2.id.in_(daily.question_ids)))
    }
    questions = [questions_by_id[question_id] for question_id in daily.question_ids if question_id in questions_by_id]
    if len(questions) != len(daily.question_ids):
        raise NotFoundError("daily practice questions missing", code="daily_practice_question_missing")
    return questions, {"daily_practice_id": daily.id, "question_ids": list(daily.question_ids)}
