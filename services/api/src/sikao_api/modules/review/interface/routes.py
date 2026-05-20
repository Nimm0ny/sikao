from __future__ import annotations

from fastapi import APIRouter

from sikao_api.db.schemas_v2 import OperationAckV2, OverviewResponseV2, ReviewDetailResponseV2, ReviewListResponseV2
from sikao_api.modules.review.application.service import build_redo_ack, build_review_detail, build_review_list, build_smart_review

router = APIRouter(prefix="/api/v2/review", tags=["review-v2"])


@router.get("/items", response_model=ReviewListResponseV2)
def list_review_items() -> ReviewListResponseV2:
    return build_review_list()


@router.get("/smart", response_model=OverviewResponseV2)
def get_smart_review() -> OverviewResponseV2:
    return build_smart_review()


@router.get("/items/{item_id}", response_model=ReviewDetailResponseV2)
def get_review_item(item_id: int) -> ReviewDetailResponseV2:
    return build_review_detail(item_id)


@router.post("/items/{item_id}/redo", response_model=OperationAckV2)
def redo_review_item(item_id: int) -> OperationAckV2:
    return build_redo_ack()
