from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.core.deps import get_app_settings
from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import (
    OperationAckV2,
    RecommendationAcceptRequestV2,
    RecommendationAcceptResponseV2,
    RecommendationListResponseV2,
    RecommendationRejectRequestV2,
)
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import get_current_user_v2, verify_csrf_v2
from sikao_api.modules.recommendations.application.service import RecommendationServiceV2

router = APIRouter(prefix="/api/v2/recommendations", tags=["recommendations"])


@router.get("/today", response_model=RecommendationListResponseV2)
def get_recommendations_today(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> RecommendationListResponseV2:
    return RecommendationServiceV2(session).list_today(user=user)


@router.post("/refresh", response_model=RecommendationListResponseV2, dependencies=[Depends(verify_csrf_v2)])
async def refresh_recommendations(
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> RecommendationListResponseV2:
    service = RecommendationServiceV2(session)
    body = await request.json() if request.headers.get("content-length") not in {None, "0"} else {}
    payload = body if isinstance(body, dict) else {}
    request_hash = service.build_request_hash(payload=payload)
    validated_key = idempotency_key or ""
    result = await service.refresh(
        user=user,
        settings=settings,
        idempotency_key=validated_key,
        request_hash=request_hash,
        request_id=getattr(request.state, "request_id", None),
        ip=request.client.host if request.client else None,
    )
    session.commit()
    return result


@router.post("/{recommendation_id}/accept", response_model=RecommendationAcceptResponseV2, dependencies=[Depends(verify_csrf_v2)])
def accept_recommendation(
    recommendation_id: int,
    payload: RecommendationAcceptRequestV2,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> RecommendationAcceptResponseV2:
    result = RecommendationServiceV2(session).accept(
        user=user,
        recommendation_id=recommendation_id,
        payload=payload,
        request_id=getattr(request.state, "request_id", None),
        ip=request.client.host if request.client else None,
    )
    session.commit()
    return result


@router.post("/{recommendation_id}/reject", response_model=OperationAckV2, dependencies=[Depends(verify_csrf_v2)])
def reject_recommendation(
    recommendation_id: int,
    payload: RecommendationRejectRequestV2,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OperationAckV2:
    RecommendationServiceV2(session).reject(
        user=user,
        recommendation_id=recommendation_id,
        payload=payload,
        request_id=getattr(request.state, "request_id", None),
        ip=request.client.host if request.client else None,
    )
    session.commit()
    return OperationAckV2(ok=True, status="rejected")


@router.get("/history", response_model=RecommendationListResponseV2)
def get_recommendation_history(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    from_date: date | None = None,
    to_date: date | None = None,
) -> RecommendationListResponseV2:
    return RecommendationServiceV2(session).history(user=user, from_date=from_date, to_date=to_date)
