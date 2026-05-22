from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import OperationAckV2
from sikao_api.db.session import get_db_session
from sikao_api.modules.favorites.application.commands import create_question_favorite, delete_question_favorite
from sikao_api.modules.favorites.application.queries import count_question_favorites, list_question_favorites
from sikao_api.modules.favorites.interface.schemas import (
    QuestionFavoriteCountV2,
    QuestionFavoriteCreateV2,
    QuestionFavoriteItemV2,
    QuestionFavoriteListV2,
)
from sikao_api.modules.identity.application.security_v2 import (
    get_current_user_v2,
    verify_csrf_v2,
)


router = APIRouter(prefix="/api/v2/practice", tags=["favorites-v2"])


@router.post(
    "/questions/{question_id}/favorite",
    response_model=QuestionFavoriteItemV2,
    dependencies=[Depends(get_current_user_v2), Depends(verify_csrf_v2)],
)
def post_question_favorite(
    question_id: int,
    payload: QuestionFavoriteCreateV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> QuestionFavoriteItemV2:
    return create_question_favorite(session, user=user, question_id=question_id, payload=payload)


@router.delete(
    "/questions/{question_id}/favorite",
    response_model=OperationAckV2,
    dependencies=[Depends(get_current_user_v2), Depends(verify_csrf_v2)],
)
def remove_question_favorite(
    question_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OperationAckV2:
    return delete_question_favorite(session, user=user, question_id=question_id)


@router.get(
    "/favorites",
    response_model=QuestionFavoriteListV2,
    dependencies=[Depends(get_current_user_v2)],
)
def get_question_favorites(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    type_filter: Annotated[Literal["xingce", "essay"] | None, Query(alias="type")] = None,
    category_filter: Annotated[str | None, Query(alias="category", max_length=64)] = None,
) -> QuestionFavoriteListV2:
    return list_question_favorites(
        session,
        user=user,
        type_filter=type_filter,
        category_filter=category_filter,
    )


@router.get(
    "/favorites/count",
    response_model=QuestionFavoriteCountV2,
    dependencies=[Depends(get_current_user_v2)],
)
def get_question_favorites_count(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> QuestionFavoriteCountV2:
    return count_question_favorites(session, user=user)
