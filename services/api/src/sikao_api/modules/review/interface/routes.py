from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi import Query

from sikao_api.db.schemas_v2 import (
    OperationAckV2,
    OverviewResponseV2,
    ReviewBatchActionResultV2,
    ReviewDetailResponseV2,
    ReviewItemBatchActionV2,
    ReviewItemCreateV2,
    ReviewItemV2,
    ReviewListResponseV2,
)
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import UserV2
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import get_current_user_v2, verify_csrf_v2
from sikao_api.modules.review.application.service import (
    apply_review_batch_action,
    archive_review_item,
    build_redo_ack,
    build_review_detail,
    build_review_list,
    build_smart_review,
    create_review_item_manual,
    graduate_review_item,
    restore_review_item,
)

router = APIRouter(
    prefix="/api/v2/review",
    tags=["review-v2"],
    dependencies=[Depends(get_current_user_v2)],
)


@router.get("/items", response_model=ReviewListResponseV2)
def list_review_items(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    status: str | None = Query(default=None),
    source_kind: str | None = Query(default=None),
    question_id: int | None = Query(default=None),
    page: int = Query(default=1),
    page_size: int = Query(default=20),
    order_by: str = Query(default="created_at"),
    order_dir: str = Query(default="desc"),
) -> ReviewListResponseV2:
    return build_review_list(
        session,
        user=user,
        status=status,
        source_kind=source_kind,
        question_id=question_id,
        page=page,
        page_size=page_size,
        order_by=order_by,
        order_dir=order_dir,
    )


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


@router.post("/items", response_model=ReviewItemV2, dependencies=[Depends(verify_csrf_v2)])
def create_review_item(
    payload: ReviewItemCreateV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ReviewItemV2:
    item = create_review_item_manual(session, user=user, payload=payload)
    session.commit()
    return item


@router.patch("/items/{item_id}/graduate", response_model=ReviewItemV2, dependencies=[Depends(verify_csrf_v2)])
def graduate_item(
    item_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ReviewItemV2:
    item = graduate_review_item(session, user=user, item_id=item_id)
    session.commit()
    return item


@router.patch("/items/{item_id}/archive", response_model=ReviewItemV2, dependencies=[Depends(verify_csrf_v2)])
def archive_item(
    item_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ReviewItemV2:
    item = archive_review_item(session, user=user, item_id=item_id)
    session.commit()
    return item


@router.patch("/items/{item_id}/restore", response_model=ReviewItemV2, dependencies=[Depends(verify_csrf_v2)])
def restore_item(
    item_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ReviewItemV2:
    item = restore_review_item(session, user=user, item_id=item_id)
    session.commit()
    return item


@router.post("/items/batch", response_model=ReviewBatchActionResultV2, dependencies=[Depends(verify_csrf_v2)])
def batch_action(
    payload: ReviewItemBatchActionV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ReviewBatchActionResultV2:
    result = apply_review_batch_action(session, user=user, payload=payload)
    session.commit()
    return result


@router.post("/items/{item_id}/redo", response_model=OperationAckV2, dependencies=[Depends(verify_csrf_v2)])
def redo_review_item(
    item_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OperationAckV2:
    return build_redo_ack(session, user=user, item_id=item_id)
