from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeSessionAnswerV2, PracticeSessionV2
from sikao_api.modules.system.application.errors import NotFoundError


def load_session(
    session: Session,
    *,
    user_id: int,
    session_id: int,
) -> PracticeSessionV2:
    practice_session = session.scalar(
        select(PracticeSessionV2).where(
            PracticeSessionV2.id == session_id,
            PracticeSessionV2.user_id == user_id,
        )
    )
    if practice_session is None:
        raise NotFoundError("practice session not found", code="practice_session_not_found")
    return practice_session


def load_session_answer(
    session: Session,
    *,
    user_id: int,
    session_id: int,
    answer_id: int,
) -> tuple[PracticeSessionV2, PracticeSessionAnswerV2]:
    practice_session = load_session(session, user_id=user_id, session_id=session_id)
    answer = session.scalar(
        select(PracticeSessionAnswerV2).where(
            PracticeSessionAnswerV2.id == answer_id,
            PracticeSessionAnswerV2.session_id == practice_session.id,
        )
    )
    if answer is None:
        raise NotFoundError("practice session answer not found", code="practice_session_answer_not_found")
    return practice_session, answer


def load_answer_by_question(
    session: Session,
    *,
    session_id: int,
    question_id: int,
) -> PracticeSessionAnswerV2:
    answer = session.scalar(
        select(PracticeSessionAnswerV2).where(
            PracticeSessionAnswerV2.session_id == session_id,
            PracticeSessionAnswerV2.question_id == question_id,
        )
    )
    if answer is None:
        raise NotFoundError("practice session answer not found", code="practice_session_answer_not_found")
    return answer
