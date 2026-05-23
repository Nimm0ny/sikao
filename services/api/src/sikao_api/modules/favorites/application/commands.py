from __future__ import annotations

from typing import Literal, cast

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import QuestionFavoriteV2, QuestionV2, UserV2
from sikao_api.db.schemas_v2 import OperationAckV2
from sikao_api.modules.favorites.interface.schemas import (
    QuestionFavoriteCreateV2,
    QuestionFavoriteItemV2,
)
from sikao_api.modules.system.application.errors import NotFoundError


def create_question_favorite(
    session: Session,
    *,
    user: UserV2,
    question_id: int,
    payload: QuestionFavoriteCreateV2,
) -> QuestionFavoriteItemV2:
    question = _load_question_or_raise(session, question_id)
    favorite = session.scalar(
        select(QuestionFavoriteV2).where(
            QuestionFavoriteV2.user_id == user.id,
            QuestionFavoriteV2.question_id == question.id,
        )
    )
    if favorite is None:
        favorite = QuestionFavoriteV2(
            user_id=user.id,
            question_id=question.id,
            note=payload.note,
        )
        session.add(favorite)
        session.flush()
    else:
        favorite.note = payload.note
    session.commit()
    session.refresh(favorite)
    return QuestionFavoriteItemV2(
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


def delete_question_favorite(
    session: Session,
    *,
    user: UserV2,
    question_id: int,
) -> OperationAckV2:
    favorite = session.scalar(
        select(QuestionFavoriteV2).where(
            QuestionFavoriteV2.user_id == user.id,
            QuestionFavoriteV2.question_id == question_id,
        )
    )
    if favorite is None:
        raise NotFoundError("favorite not found", code="favorite_not_found")
    session.delete(favorite)
    session.commit()
    return OperationAckV2(ok=True, status="deleted")


def _load_question_or_raise(session: Session, question_id: int) -> QuestionV2:
    question = session.get(QuestionV2, question_id)
    if question is None:
        raise NotFoundError("question not found", code="question_not_found")
    return question
