from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeSessionAnswerV2, PracticeSessionV2, UserV2
from sikao_api.db.schemas_v2 import PracticeSessionItemV2
from sikao_api.modules.question_flags.application.create import upsert_question_flag_record
from sikao_api.modules.session.application.answer_lookup import (
    load_answer_by_question,
    load_session,
    load_session_answer,
)
from sikao_api.modules.session.application.answer_item_state import (
    serialize_answer_item,
)
from sikao_api.modules.system.application.errors import ConflictError


def set_answer_flag(
    session: Session,
    *,
    user: UserV2,
    session_id: int,
    answer_id: int,
    flagged: bool,
) -> PracticeSessionItemV2:
    practice_session, answer = load_session_answer(session, user_id=user.id, session_id=session_id, answer_id=answer_id)
    answer.flagged = flagged
    session.add(answer)
    session.flush()
    return serialize_answer_item(session, practice_session=practice_session, answer=answer)


def create_persistent_flag(
    session: Session,
    *,
    user: UserV2,
    session_id: int,
    question_id: int,
    reason: str,
) -> PracticeSessionItemV2:
    practice_session = load_session(session, user_id=user.id, session_id=session_id)
    if practice_session.status != "submitted":
        raise ConflictError(
            "persistent flag requires submitted session",
            code="practice_session_not_submitted",
        )
    answer = load_answer_by_question(session, session_id=session_id, question_id=question_id)
    upsert_question_flag_record(
        session,
        user=user,
        question_id=question_id,
        reason=reason,
        source_session_id=practice_session.id,
    )
    session.flush()
    return serialize_answer_item(session, practice_session=practice_session, answer=answer)


def promote_flagged_answers(
    session: Session,
    *,
    user: UserV2,
    practice_session: PracticeSessionV2,
) -> None:
    answers = list(
        session.scalars(
            select(PracticeSessionAnswerV2).where(
                PracticeSessionAnswerV2.session_id == practice_session.id,
                PracticeSessionAnswerV2.flagged.is_(True),
                PracticeSessionAnswerV2.question_id.is_not(None),
            )
        )
    )
    for answer in answers:
        if answer.question_id is None:
            continue
        upsert_question_flag_record(
            session,
            user=user,
            question_id=answer.question_id,
            reason="uncertain",
            source_session_id=practice_session.id,
            overwrite_existing=False,
        )
