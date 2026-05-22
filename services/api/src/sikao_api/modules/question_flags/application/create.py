from __future__ import annotations

from typing import Literal, cast

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import QuestionFlagV2, QuestionV2, UserV2
from sikao_api.modules.question_flags.application.review_sync import sync_flagged_persistent_review_item
from sikao_api.modules.question_flags.interface.schemas import (
    QuestionFlagCreateV2,
    QuestionFlagItemV2,
)
from sikao_api.modules.system.application.errors import NotFoundError


def create_question_flag(
    session: Session,
    *,
    user: UserV2,
    question_id: int,
    payload: QuestionFlagCreateV2,
    source_session_id: int | None = None,
) -> QuestionFlagItemV2:
    question = _load_question_or_raise(session, question_id)
    flag = session.scalar(
        select(QuestionFlagV2).where(
            QuestionFlagV2.user_id == user.id,
            QuestionFlagV2.question_id == question.id,
            QuestionFlagV2.resolved_at.is_(None),
        )
    )
    if flag is None:
        flag = QuestionFlagV2(
            user_id=user.id,
            question_id=question.id,
            reason=payload.reason,
            source_session_id=source_session_id,
        )
        session.add(flag)
        session.flush()
    else:
        flag.reason = payload.reason
        if source_session_id is not None:
            flag.source_session_id = source_session_id

    sync_flagged_persistent_review_item(
        session,
        user_id=user.id,
        question=question,
        flag=flag,
    )
    session.commit()
    session.refresh(flag)
    return QuestionFlagItemV2(
        id=flag.id,
        question_id=question.id,
        title=question.prompt,
        type=cast(Literal["xingce", "essay"], question.subject_kind),
        category_l1=question.category_l1,
        category_l2=question.category_l2,
        year=question.year,
        region=question.region,
        exam_type=question.exam_type,
        reason=cast(Literal["uncertain", "revisit_later", "needs_review"], flag.reason),
        status="resolved" if flag.resolved_at is not None else "active",
        question_status="active" if question.is_active else "retired",
        source_session_id=flag.source_session_id,
        href=None,
        created_at=flag.created_at,
        resolved_at=flag.resolved_at,
    )


def _load_question_or_raise(session: Session, question_id: int) -> QuestionV2:
    question = session.get(QuestionV2, question_id)
    if question is None:
        raise NotFoundError("question not found", code="question_not_found")
    return question
