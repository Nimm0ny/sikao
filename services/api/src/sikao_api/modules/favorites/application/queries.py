from __future__ import annotations

from typing import Literal, cast

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import QuestionFavoriteV2, QuestionV2, UserV2
from sikao_api.modules.favorites.interface.schemas import (
    QuestionFavoriteCountV2,
    QuestionFavoriteItemV2,
    QuestionFavoriteListV2,
)


def list_question_favorites(
    session: Session,
    *,
    user: UserV2,
    type_filter: str | None,
    category_filter: str | None,
) -> QuestionFavoriteListV2:
    stmt = (
        select(QuestionFavoriteV2, QuestionV2)
        .join(QuestionV2, QuestionV2.id == QuestionFavoriteV2.question_id)
        .where(QuestionFavoriteV2.user_id == user.id)
        .order_by(QuestionFavoriteV2.created_at.desc(), QuestionFavoriteV2.id.desc())
    )
    if type_filter is not None:
        stmt = stmt.where(QuestionV2.subject_kind == type_filter)
    if category_filter is not None:
        stmt = stmt.where(QuestionV2.category_l1 == category_filter)
    rows = session.execute(stmt).all()
    items = [
        QuestionFavoriteItemV2(
            id=favorite.id,
            question_id=question.id,
            title=question.prompt,
            type=cast(Literal["xingce", "essay"], question.subject_kind),
            category_l1=question.category_l1,
            category_l2=question.category_l2,
            year=question.year,
            region=question.region,
            exam_type=question.exam_type,
            note=favorite.note,
            question_status="active" if question.is_active else "retired",
            href=None,
            created_at=favorite.created_at,
        )
        for favorite, question in rows
    ]
    return QuestionFavoriteListV2(
        items=items,
        total=len(items),
        page=1,
        page_size=max(len(items), 1),
    )


def count_question_favorites(
    session: Session,
    *,
    user: UserV2,
) -> QuestionFavoriteCountV2:
    count = int(
        session.scalar(
            select(func.count())
            .select_from(QuestionFavoriteV2)
            .where(QuestionFavoriteV2.user_id == user.id)
        )
        or 0
    )
    return QuestionFavoriteCountV2(count=count)
