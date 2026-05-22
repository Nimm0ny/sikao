from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal, cast

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import QuestionFlagV2, QuestionV2, UserV2
from sikao_api.db.schemas_v2 import OperationAckV2
from sikao_api.modules.question_flags.application.review_sync import settle_flagged_persistent_review_item
from sikao_api.modules.question_flags.interface.schemas import QuestionFlagItemV2
from sikao_api.modules.system.application.errors import NotFoundError


def delete_question_flag(
    session: Session,
    *,
    user: UserV2,
    question_id: int,
) -> OperationAckV2:
    flag = _load_active_flag_or_raise(session, user_id=user.id, question_id=question_id)
    session.delete(flag)
    settle_flagged_persistent_review_item(
        session,
        user_id=user.id,
        question_id=question_id,
        target_status="removed",
    )
    session.commit()
    return OperationAckV2(ok=True, status="deleted")


def resolve_question_flag(
    session: Session,
    *,
    user: UserV2,
    question_id: int,
) -> QuestionFlagItemV2:
    flag = _load_active_flag_or_raise(session, user_id=user.id, question_id=question_id)
    question = session.get(QuestionV2, question_id)
    if question is None:
        raise NotFoundError("question not found", code="question_not_found")
    flag.resolved_at = datetime.now(UTC).replace(tzinfo=None)
    settle_flagged_persistent_review_item(
        session,
        user_id=user.id,
        question_id=question_id,
        target_status="resolved",
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
        status="resolved",
        question_status="active" if question.is_active else "retired",
        source_session_id=flag.source_session_id,
        href=None,
        created_at=flag.created_at,
        resolved_at=flag.resolved_at,
    )


def _load_active_flag_or_raise(
    session: Session,
    *,
    user_id: int,
    question_id: int,
) -> QuestionFlagV2:
    flag = session.scalar(
        select(QuestionFlagV2).where(
            QuestionFlagV2.user_id == user_id,
            QuestionFlagV2.question_id == question_id,
            QuestionFlagV2.resolved_at.is_(None),
        )
    )
    if flag is None:
        raise NotFoundError("flag not found", code="question_flag_not_found")
    return flag
