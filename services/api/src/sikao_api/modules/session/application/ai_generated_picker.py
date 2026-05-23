from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.core.config import get_settings
from sikao_api.db.models_v2 import QuestionV2
from sikao_api.modules.ai_questions.application.service import AiQuestionsService
from sikao_api.modules.system.application.errors import NotFoundError, ValidationError


def pick_ai_generated_questions(
    session: Session,
    *,
    user_id: int,
    track: str,
    config: dict[str, object],
) -> tuple[list[QuestionV2], dict[str, object]]:
    ai_request_id = config.get("ai_request_id", config.get("aiRequestId"))
    if not isinstance(ai_request_id, int):
        raise ValidationError(
            "ai_generated mode requires config.ai_request_id",
            code="practice_session_ai_request_required",
        )
    question_ids = AiQuestionsService(session, get_settings()).load_generated_question_ids(
        user_id=user_id,
        ai_request_id=ai_request_id,
    )
    if not question_ids:
        raise NotFoundError(
            "ai question request returned no questions",
            code="ai_question_request_empty",
        )
    questions = list(
        session.scalars(select(QuestionV2).where(QuestionV2.id.in_(question_ids)))
    )
    questions_by_id = {question.id: question for question in questions}
    ordered = [questions_by_id[question_id] for question_id in question_ids if question_id in questions_by_id]
    if len(ordered) != len(question_ids):
        raise NotFoundError(
            "ai question request references missing questions",
            code="ai_question_request_question_missing",
        )
    if any(question.subject_kind != track for question in ordered):
        raise ValidationError(
            "ai_generated session track does not match generated question track",
            code="practice_session_ai_track_mismatch",
        )
    return ordered, {"ai_request_id": ai_request_id, "question_ids": question_ids}
