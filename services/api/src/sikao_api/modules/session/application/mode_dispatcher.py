from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import QuestionV2, UserV2
from sikao_api.db.schemas_v2 import PracticeSessionCreateRequestV2
from sikao_api.modules.session.application.category_picker import pick_category_questions
from sikao_api.modules.session.application.custom_picker import pick_custom_questions
from sikao_api.modules.session.application.daily_picker import pick_daily_questions
from sikao_api.modules.session.application.wrong_redo_picker import pick_wrong_redo_questions
from sikao_api.modules.system.application.errors import ValidationError


@dataclass(frozen=True)
class SessionSelection:
    source_mode: str
    questions: list[QuestionV2]
    config_snapshot: dict[str, Any]


def resolve_session_selection(
    session: Session,
    *,
    user: UserV2,
    payload: PracticeSessionCreateRequestV2,
) -> SessionSelection:
    mode = payload.mode or "paper"
    if mode != "paper" and (payload.paper_code is not None or payload.question_ids):
        raise ValidationError(
            "non-paper mode cannot combine with paper_code or question_ids",
            code="practice_session_mode_conflict",
        )
    if mode == "paper":
        return SessionSelection(source_mode="paper", questions=[], config_snapshot=payload.config)
    if mode == "category":
        questions, snapshot = pick_category_questions(session, user_id=user.id, track=payload.track, config=payload.config)
        return SessionSelection(source_mode="category", questions=questions, config_snapshot=snapshot)
    if mode == "custom":
        questions, snapshot = pick_custom_questions(session, user_id=user.id, track=payload.track, config=payload.config)
        return SessionSelection(source_mode="custom", questions=questions, config_snapshot=snapshot)
    if mode == "daily":
        questions, snapshot = pick_daily_questions(session, user_id=user.id, track=payload.track, config=payload.config)
        return SessionSelection(source_mode="daily", questions=questions, config_snapshot=snapshot)
    if mode == "wrong_redo":
        questions, snapshot = pick_wrong_redo_questions(
            session,
            user_id=user.id,
            track=payload.track,
            config=payload.config,
        )
        return SessionSelection(source_mode="wrong_redo", questions=questions, config_snapshot=snapshot)
    if mode == "ai_generated":
        raise ValidationError("ai_generated mode is blocked until B22 lands", code="practice_session_mode_blocked")
    raise ValidationError("unsupported session mode", code="practice_session_mode_invalid")
