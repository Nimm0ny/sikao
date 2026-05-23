from __future__ import annotations

from typing import Literal, cast

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import QuestionFlagV2, QuestionV2, UserV2
from sikao_api.modules.question_flags.interface.schemas import (
    QuestionFlagItemV2,
    QuestionFlagListV2,
)


def list_question_flags(
    session: Session,
    *,
    user: UserV2,
    reason_filter: str | None,
) -> QuestionFlagListV2:
    stmt = (
        select(QuestionFlagV2, QuestionV2)
        .join(QuestionV2, QuestionV2.id == QuestionFlagV2.question_id)
        .where(QuestionFlagV2.user_id == user.id)
        .order_by(
            QuestionFlagV2.resolved_at.is_not(None).asc(),
            QuestionFlagV2.created_at.desc(),
            QuestionFlagV2.id.desc(),
        )
    )
    if reason_filter is not None:
        stmt = stmt.where(QuestionFlagV2.reason == reason_filter)
    rows = session.execute(stmt).all()
    items = [
        QuestionFlagItemV2(
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
        for flag, question in rows
    ]
    return QuestionFlagListV2(
        items=items,
        total=len(items),
        page=1,
        page_size=max(len(items), 1),
    )
