from __future__ import annotations

from sqlalchemy import select, update
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
    locked_session = session.scalar(
        select(PracticeSessionV2)
        .where(PracticeSessionV2.id == practice_session.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if locked_session is None:
        raise ConflictError(
            "practice session is not writable",
            code="SESSION_NOT_WRITABLE",
        )
    practice_session = locked_session
    if practice_session.status == "submitted":
        raise ConflictError(
            "practice session already submitted",
            code="practice_session_submitted",
        )
    if practice_session.status in {"abandoned", "expired"}:
        raise ConflictError(
            "practice session is not writable",
            code="SESSION_NOT_WRITABLE",
        )
    result = session.execute(
        update(PracticeSessionAnswerV2)
        .where(
            PracticeSessionAnswerV2.id == answer.id,
            PracticeSessionAnswerV2.session_id == practice_session.id,
        )
        .values(flagged=flagged)
        .execution_options(synchronize_session=False)
    )
    if getattr(result, "rowcount", None) != 1:
        current_status = session.scalar(
            select(PracticeSessionV2.status).where(PracticeSessionV2.id == practice_session.id)
        )
        if current_status == "submitted":
            raise ConflictError(
                "practice session already submitted",
                code="practice_session_submitted",
            )
        if current_status in {"abandoned", "expired"}:
            raise ConflictError(
                "practice session is not writable",
                code="SESSION_NOT_WRITABLE",
            )
        raise ConflictError(
            "invalid session transition",
            code="INVALID_TRANSITION",
        )
    answer.flagged = flagged
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
