from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from sikao_api.db.schemas_v2 import OperationAckV2, OverviewResponseV2, ReviewDetailResponseV2, ReviewListResponseV2
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import UserV2
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import get_current_user_v2, verify_csrf_v2
from sikao_api.modules.review.application.service import build_redo_ack, build_review_detail, build_review_list, build_smart_review

router = APIRouter(
    prefix="/api/v2/review",
    tags=["review-v2"],
    dependencies=[Depends(get_current_user_v2)],
)


@router.get("/items", response_model=ReviewListResponseV2)
def list_review_items(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ReviewListResponseV2:
    return build_review_list(session, user=user)


@router.get("/smart", response_model=OverviewResponseV2)
def get_smart_review(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OverviewResponseV2:
    return build_smart_review(session, user=user)


@router.get("/items/{item_id}", response_model=ReviewDetailResponseV2)
def get_review_item(
    item_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ReviewDetailResponseV2:
    return build_review_detail(session, user=user, item_id=item_id)


@router.post("/items/{item_id}/redo", response_model=OperationAckV2, dependencies=[Depends(verify_csrf_v2)])
def redo_review_item(
    item_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OperationAckV2:
    return build_redo_ack(session, user=user, item_id=item_id)
