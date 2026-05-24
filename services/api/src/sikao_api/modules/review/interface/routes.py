from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request
from fastapi import Query

from sikao_api.db.schemas_v2 import (
    CauseAnalysisGroupRequestV2,
    CauseAnalysisRequestV2,
    CauseAnalysisResponseV2,
    CauseDimensionOverrideRequestV2,
    CauseTagListResponseV2,
    OperationAckV2,
    OverviewResponseV2,
    ReviewInsightsCausesResponseV2,
    ReviewInsightsRedoAccuracyResponseV2,
    ReviewInsightsTrendsResponseV2,
    ReviewAttemptSubmitV2,
    ReviewBatchActionResultV2,
    ReviewDetailResponseV2,
    ReviewItemBatchActionV2,
    ReviewItemCreateV2,
    ReviewItemV2,
    ReviewListResponseV2,
    ReviewWeeklySummaryResponseV2,
)
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import UserV2
from sikao_api.db.session import get_db_session
from sikao_api.modules.auth.application.security import (
    get_admin_principal,
    verify_csrf_token_if_cookie_auth,
)
from sikao_api.modules.identity.application.security_v2 import get_current_user_v2, verify_csrf_v2
from sikao_api.modules.question_reports.application.admin_actor import resolve_admin_actor
from sikao_api.modules.review.application.cause_analysis_cache import invalidate_cause_tag_cache
from sikao_api.modules.review.application.cause_analysis_queries import list_cause_tags_response
from sikao_api.modules.review.application.cause_analysis_result import serialize_analysis_row
from sikao_api.modules.review.application.cause_analysis_service import ReviewCauseAnalysisService
from sikao_api.modules.review.application.cause_override_service import CauseOverrideService
from sikao_api.modules.review.application.insights_service import (
    build_review_causes,
    build_review_redo_accuracy,
    build_review_trends,
)
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
    submit_review_attempt,
)
from sikao_api.modules.review.application.time_windows import iso_week_code_from_date, previous_week_start
from sikao_api.modules.review.application.weekly_service import load_weekly_summary_or_fallback
from sikao_api.modules.system.application.audit_v2 import add_audit_log

router = APIRouter(
    prefix="/api/v2/review",
    tags=["review-v2"],
    dependencies=[Depends(get_current_user_v2)],
)
admin_router = APIRouter(prefix="/api/v2/admin/review", tags=["review-admin-v2"])


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


@router.get("/weekly-summary", response_model=ReviewWeeklySummaryResponseV2)
def get_weekly_summary(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    week: str | None = Query(default=None),
) -> ReviewWeeklySummaryResponseV2:
    resolved_week = week or iso_week_code_from_date(previous_week_start())
    return load_weekly_summary_or_fallback(session, user_id=user.id, week=resolved_week)


@router.get("/insights/trends", response_model=ReviewInsightsTrendsResponseV2)
def get_review_insights_trends(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ReviewInsightsTrendsResponseV2:
    return build_review_trends(session, user_id=user.id)


@router.get("/insights/causes", response_model=ReviewInsightsCausesResponseV2)
def get_review_insights_causes(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ReviewInsightsCausesResponseV2:
    return build_review_causes(session, user_id=user.id)


@router.get("/insights/redo-accuracy", response_model=ReviewInsightsRedoAccuracyResponseV2)
def get_review_insights_redo_accuracy(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ReviewInsightsRedoAccuracyResponseV2:
    return build_review_redo_accuracy(session, user_id=user.id)


@router.get("/items/{item_id}", response_model=ReviewDetailResponseV2)
def get_review_item(
    item_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ReviewDetailResponseV2:
    return build_review_detail(session, user=user, item_id=item_id)


@router.post(
    "/items/{item_id}/cause-analysis",
    response_model=CauseAnalysisResponseV2,
    dependencies=[Depends(verify_csrf_v2)],
)
async def create_cause_analysis_single(
    item_id: int,
    payload: CauseAnalysisRequestV2,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> CauseAnalysisResponseV2:
    service = ReviewCauseAnalysisService(session, request.app.state.settings)
    response = await service.analyze_single(
        user=user,
        item_id=item_id,
        payload=payload,
        idempotency_key=idempotency_key or "",
        request_id=getattr(request.state, "request_id", None),
    )
    session.commit()
    return response


@router.post(
    "/cause-analysis/group",
    response_model=CauseAnalysisResponseV2,
    dependencies=[Depends(verify_csrf_v2)],
)
async def create_cause_analysis_group(
    payload: CauseAnalysisGroupRequestV2,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> CauseAnalysisResponseV2:
    service = ReviewCauseAnalysisService(session, request.app.state.settings)
    response = await service.analyze_group(
        user=user,
        payload=payload,
        idempotency_key=idempotency_key or "",
        request_id=getattr(request.state, "request_id", None),
    )
    session.commit()
    return response


@router.patch(
    "/cause-analysis/{analysis_id}/dimensions/{dimension_index}",
    response_model=CauseAnalysisResponseV2,
    dependencies=[Depends(verify_csrf_v2)],
)
def patch_cause_analysis_dimension(
    analysis_id: int,
    dimension_index: int,
    payload: CauseDimensionOverrideRequestV2,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> CauseAnalysisResponseV2:
    analysis = CauseOverrideService(session).override_dimension(
        user=user,
        analysis_id=analysis_id,
        dimension_index=dimension_index,
        payload=payload,
        request_id=getattr(request.state, "request_id", None),
    )
    session.commit()
    return serialize_analysis_row(analysis, cached=False)


@router.get("/cause-tags", response_model=CauseTagListResponseV2)
def list_cause_tags(
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> CauseTagListResponseV2:
    _ = request, user
    return list_cause_tags_response(session)


@router.post("/items", response_model=ReviewItemV2, dependencies=[Depends(verify_csrf_v2)])
def create_review_item(
    payload: ReviewItemCreateV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ReviewItemV2:
    item = create_review_item_manual(session, user=user, payload=payload)
    session.commit()
    return item


@router.post("/items/{item_id}/attempt", response_model=ReviewDetailResponseV2, dependencies=[Depends(verify_csrf_v2)])
def attempt_review_item(
    item_id: int,
    payload: ReviewAttemptSubmitV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ReviewDetailResponseV2:
    detail = submit_review_attempt(session, user=user, item_id=item_id, payload=payload)
    session.commit()
    return detail


@router.patch("/items/{item_id}/graduate", response_model=ReviewItemV2, dependencies=[Depends(verify_csrf_v2)])
def graduate_item(
    item_id: int,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ReviewItemV2:
    item = graduate_review_item(
        session,
        user=user,
        item_id=item_id,
        request_id=getattr(request.state, "request_id", None),
    )
    session.commit()
    return item


@router.patch("/items/{item_id}/archive", response_model=ReviewItemV2, dependencies=[Depends(verify_csrf_v2)])
def archive_item(
    item_id: int,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ReviewItemV2:
    item = archive_review_item(
        session,
        user=user,
        item_id=item_id,
        request_id=getattr(request.state, "request_id", None),
    )
    session.commit()
    return item


@router.patch("/items/{item_id}/restore", response_model=ReviewItemV2, dependencies=[Depends(verify_csrf_v2)])
def restore_item(
    item_id: int,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ReviewItemV2:
    item = restore_review_item(
        session,
        user=user,
        item_id=item_id,
        request_id=getattr(request.state, "request_id", None),
    )
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


@admin_router.post(
    "/cause-tags/invalidate-cache",
    response_model=OperationAckV2,
    dependencies=[Depends(verify_csrf_token_if_cookie_auth)],
)
def invalidate_cause_tag_registry(
    request: Request,
    admin_username: Annotated[str, Depends(get_admin_principal)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OperationAckV2:
    invalidate_cause_tag_cache()
    admin_user = resolve_admin_actor(session, admin_username=admin_username)
    add_audit_log(
        session,
        user_id=admin_user.id,
        actor_type="admin",
        actor_id=admin_username,
        action="review.cause_tag_cache_invalidated",
        target_type="cause_tag_v2",
        target_id=None,
        request_id=getattr(request.state, "request_id", None),
    )
    session.commit()
    return OperationAckV2(ok=True, status="invalidated")
