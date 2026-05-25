"""PR-3 MVP: update wrong-reason diagnosis on a submitted answer.

Ownership check: the PracticeSessionAnswer must belong to a PracticeSession
owned by the current user. 404 if session/answer not found or not owned.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db import schemas
from sikao_api.db.models import PracticeSession, PracticeSessionAnswer
from sikao_api.modules.system.application.errors import ServiceError


def update_wrong_reason(
    db: Session,
    *,
    session_id: int,
    answer_id: int,
    user_id: int,
    payload: schemas.WrongReasonUpdateV2,
) -> schemas.WrongReasonOutV2:
    practice_session = db.scalar(
        select(PracticeSession).where(
            PracticeSession.id == session_id,
            PracticeSession.user_id == user_id,
        )
    )
    if practice_session is None:
        raise ServiceError(
            "Practice session not found for user",
            status_code=404,
            code="practice_session_not_found",
        )

    answer = db.scalar(
        select(PracticeSessionAnswer).where(
            PracticeSessionAnswer.id == answer_id,
            PracticeSessionAnswer.session_id == session_id,
        )
    )
    if answer is None:
        raise ServiceError(
            "Answer not found in session",
            status_code=404,
            code="practice_session_answer_not_found",
        )

    answer.wrong_reason_code = payload.wrong_reason_code
    answer.wrong_reason_source = payload.source
    db.flush()

    return schemas.WrongReasonOutV2(
        answer_id=answer.id,
        wrong_reason_code=answer.wrong_reason_code,
        wrong_reason_source=answer.wrong_reason_source,
    )
