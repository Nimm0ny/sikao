from __future__ import annotations

import json
from datetime import date
from collections.abc import AsyncIterator
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Header, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.core.deps import get_app_settings
from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import (
    EventConflictsRequestV2,
    EventConflictsResponseV2,
    EventWindowResponseV2,
    OperationAckV2,
    PlanAdjustmentListResponseV2,
    PlanAdjustmentReadV2,
    PlanAdjustmentRejectRequestV2,
    PlanAutoGenerateRequestV2,
    PlanCreateRequestV2,
    PlanEventBulkDeleteRequestV2,
    PlanEventBulkDeleteResponseV2,
    PlanEventCreateRequestV2,
    PlanEventReadV2,
    PlanRegenerateRangeRequestV2,
    PlanEventUpdateRequestV2,
    PlanListResponseV2,
    PlanReadV2,
    PlanUpdateRequestV2,
)
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import get_current_user_v2, verify_csrf_v2
from sikao_api.modules.llm.application.plan_generator import PlanGenerateParams, RegenerateRangeParams
from sikao_api.modules.llm.application.service import HomeLlmService, HomeLlmStreamFrame
from sikao_api.modules.plans.application.adjustment_service import AdjustmentServiceV2
from sikao_api.modules.plans.application.event_command_service import EventCommandServiceV2
from sikao_api.modules.plans.application.event_delete_service import EventDeleteServiceV2
from sikao_api.modules.plans.application.event_query_service import EventQueryServiceV2
from sikao_api.modules.plans.application.plan_service import PlanServiceV2
from sikao_api.modules.system.application.errors import ServiceError

router = APIRouter(prefix="/api/v2/plans", tags=["plans"])


@router.get("", response_model=PlanListResponseV2)
def list_plans(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PlanListResponseV2:
    return PlanServiceV2(session).list_plans(user=user)


@router.post("", response_model=PlanReadV2, dependencies=[Depends(verify_csrf_v2)])
def create_plan(
    payload: PlanCreateRequestV2,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PlanReadV2:
    result = PlanServiceV2(session).create_plan(
        user=user,
        payload=payload,
        request_id=getattr(request.state, "request_id", None),
        ip=request.client.host if request.client else None,
    )
    session.commit()
    return result


@router.post("/auto-generate", dependencies=[Depends(verify_csrf_v2)])
async def auto_generate_plan(
    payload: PlanAutoGenerateRequestV2,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> StreamingResponse:
    service = HomeLlmService(session, settings)
    params = PlanGenerateParams(
        name=payload.name,
        target_exam_id=payload.target_exam_id,
        target_exam_date=payload.target_exam_date,
        daily_minutes_target=payload.daily_minutes_target,
        style=payload.style,
        baseline=payload.baseline,
        focus_subjects=payload.focus_subjects,
        user_notes=payload.user_notes,
    )
    return StreamingResponse(
        _stream_home_llm_frames(
            request=request,
            session=session,
            frames=service.generate_plan_stream(
                user=user,
                params=params,
                idempotency_key=idempotency_key or "",
                request_id=getattr(request.state, "request_id", None),
                ip=request.client.host if request.client else None,
            ),
        ),
        media_type="text/event-stream",
    )


@router.get("/events", response_model=EventWindowResponseV2)
def list_events(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    from_date: Annotated[date, Query(alias="from")],
    to_date: Annotated[date, Query(alias="to")],
    include_practice_blocks: bool = False,
    tz: str = "Asia/Shanghai",
) -> EventWindowResponseV2:
    return EventQueryServiceV2(session).list_events(
        user=user,
        from_date=from_date,
        to_date=to_date,
        include_practice_blocks=include_practice_blocks,
        tz=tz,
    )


@router.post("/events", response_model=PlanEventReadV2, dependencies=[Depends(verify_csrf_v2)])
def create_event(
    payload: PlanEventCreateRequestV2,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PlanEventReadV2:
    result = EventCommandServiceV2(session).create_event(
        user=user,
        payload=payload,
        request_id=getattr(request.state, "request_id", None),
        ip=request.client.host if request.client else None,
    )
    session.commit()
    return result


@router.get("/events/{event_id}", response_model=PlanEventReadV2)
def get_event(
    event_id: str,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PlanEventReadV2:
    return EventQueryServiceV2(session).get_event(user=user, event_id=event_id)


@router.patch("/events/{event_id}", response_model=PlanEventReadV2, dependencies=[Depends(verify_csrf_v2)])
def update_event(
    event_id: str,
    payload: PlanEventUpdateRequestV2,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    scope: str | None = None,
) -> PlanEventReadV2:
    result = EventCommandServiceV2(session).update_event(
        user=user,
        event_id=event_id,
        payload=payload,
        scope=scope,
        request_id=getattr(request.state, "request_id", None),
        ip=request.client.host if request.client else None,
    )
    session.commit()
    return result


@router.delete("/events/{event_id}", response_model=OperationAckV2, dependencies=[Depends(verify_csrf_v2)])
def delete_event(
    event_id: str,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    scope: str | None = None,
) -> OperationAckV2:
    EventDeleteServiceV2(session).soft_delete_event(
        user=user,
        event_id=event_id,
        scope=scope,
        request_id=getattr(request.state, "request_id", None),
        ip=request.client.host if request.client else None,
    )
    session.commit()
    return OperationAckV2(ok=True, status="deleted")


@router.post("/events/bulk-delete", response_model=PlanEventBulkDeleteResponseV2, dependencies=[Depends(verify_csrf_v2)])
def bulk_delete_events(
    payload: PlanEventBulkDeleteRequestV2,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PlanEventBulkDeleteResponseV2:
    matched_ids = EventDeleteServiceV2(session).bulk_delete(
        user=user,
        plan_id=payload.plan_id,
        from_date=payload.from_date,
        to_date=payload.to,
        source=payload.source,
        dry_run=payload.dry_run,
        request_id=getattr(request.state, "request_id", None),
        ip=request.client.host if request.client else None,
    )
    if not payload.dry_run:
        session.commit()
    return PlanEventBulkDeleteResponseV2(
        ok=True,
        status="dry_run" if payload.dry_run else "deleted",
        matched_ids=matched_ids,
    )


@router.post("/events/conflicts", response_model=EventConflictsResponseV2, dependencies=[Depends(verify_csrf_v2)])
def detect_event_conflicts(
    payload: EventConflictsRequestV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> EventConflictsResponseV2:
    return EventQueryServiceV2(session).detect_conflicts(user=user, payload=payload)


@router.post("/events/regenerate-range", dependencies=[Depends(verify_csrf_v2)])
async def regenerate_event_range(
    payload: PlanRegenerateRangeRequestV2,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> StreamingResponse:
    service = HomeLlmService(session, settings)
    params = RegenerateRangeParams(
        plan_id=payload.plan_id,
        from_date=payload.from_date,
        to_date=payload.to,
        user_notes=payload.user_notes,
    )
    return StreamingResponse(
        _stream_home_llm_frames(
            request=request,
            session=session,
            frames=service.regenerate_range_stream(
                user=user,
                params=params,
                idempotency_key=idempotency_key or "",
                request_id=getattr(request.state, "request_id", None),
                ip=request.client.host if request.client else None,
            ),
        ),
        media_type="text/event-stream",
    )


@router.post("/events/{event_id}/restore", response_model=PlanEventReadV2, dependencies=[Depends(verify_csrf_v2)])
def restore_event(
    event_id: int,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PlanEventReadV2:
    result = EventDeleteServiceV2(session).restore_event(
        user=user,
        event_id=event_id,
        request_id=getattr(request.state, "request_id", None),
        ip=request.client.host if request.client else None,
    )
    session.commit()
    return result


@router.get("/adjustments", response_model=PlanAdjustmentListResponseV2)
def list_adjustments(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    status: str | None = None,
) -> PlanAdjustmentListResponseV2:
    return AdjustmentServiceV2(session).list_adjustments(user=user, status=status)


@router.get("/adjustments/{adjustment_id}", response_model=PlanAdjustmentReadV2)
def get_adjustment(
    adjustment_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PlanAdjustmentReadV2:
    return AdjustmentServiceV2(session).get_adjustment(user=user, adjustment_id=adjustment_id)


@router.post("/adjustments/{adjustment_id}/accept", response_model=OperationAckV2, dependencies=[Depends(verify_csrf_v2)])
def accept_adjustment(
    adjustment_id: int,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OperationAckV2:
    AdjustmentServiceV2(session).accept_adjustment(
        user=user,
        adjustment_id=adjustment_id,
        request_id=getattr(request.state, "request_id", None),
        ip=request.client.host if request.client else None,
    )
    session.commit()
    return OperationAckV2(ok=True, status="accepted")


@router.post("/adjustments/{adjustment_id}/reject", response_model=OperationAckV2, dependencies=[Depends(verify_csrf_v2)])
def reject_adjustment(
    adjustment_id: int,
    payload: PlanAdjustmentRejectRequestV2,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OperationAckV2:
    AdjustmentServiceV2(session).reject_adjustment(
        user=user,
        adjustment_id=adjustment_id,
        reason=payload.reason,
        request_id=getattr(request.state, "request_id", None),
        ip=request.client.host if request.client else None,
    )
    session.commit()
    return OperationAckV2(ok=True, status="rejected")


@router.get("/{plan_id}", response_model=PlanReadV2)
def get_plan(
    plan_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PlanReadV2:
    return PlanServiceV2(session).get_plan(user=user, plan_id=plan_id)


@router.put("/{plan_id}", response_model=PlanReadV2, dependencies=[Depends(verify_csrf_v2)])
def update_plan(
    plan_id: int,
    payload: PlanUpdateRequestV2,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PlanReadV2:
    result = PlanServiceV2(session).update_plan(
        user=user,
        plan_id=plan_id,
        payload=payload,
        request_id=getattr(request.state, "request_id", None),
        ip=request.client.host if request.client else None,
    )
    session.commit()
    return result


@router.delete("/{plan_id}", response_model=OperationAckV2, dependencies=[Depends(verify_csrf_v2)])
def delete_plan(
    plan_id: int,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OperationAckV2:
    PlanServiceV2(session).soft_delete_plan(
        user=user,
        plan_id=plan_id,
        request_id=getattr(request.state, "request_id", None),
        ip=request.client.host if request.client else None,
    )
    session.commit()
    return OperationAckV2(ok=True, status="deleted")


@router.post("/{plan_id}/archive", response_model=PlanReadV2, dependencies=[Depends(verify_csrf_v2)])
def archive_plan(
    plan_id: int,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PlanReadV2:
    result = PlanServiceV2(session).archive_plan(
        user=user,
        plan_id=plan_id,
        request_id=getattr(request.state, "request_id", None),
        ip=request.client.host if request.client else None,
    )
    session.commit()
    return result


@router.post("/{plan_id}/activate", response_model=PlanReadV2, dependencies=[Depends(verify_csrf_v2)])
def activate_plan(
    plan_id: int,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PlanReadV2:
    result = PlanServiceV2(session).activate_plan(
        user=user,
        plan_id=plan_id,
        request_id=getattr(request.state, "request_id", None),
        ip=request.client.host if request.client else None,
    )
    session.commit()
    return result


@router.post("/{plan_id}/pause", response_model=PlanReadV2, dependencies=[Depends(verify_csrf_v2)])
def pause_plan(
    plan_id: int,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PlanReadV2:
    result = PlanServiceV2(session).pause_plan(
        user=user,
        plan_id=plan_id,
        request_id=getattr(request.state, "request_id", None),
        ip=request.client.host if request.client else None,
    )
    session.commit()
    return result


async def _stream_home_llm_frames(
    *,
    request: Request,
    session: Session,
    frames: AsyncIterator[HomeLlmStreamFrame],
) -> AsyncIterator[bytes]:
    try:
        async for frame in frames:
            if await request.is_disconnected():
                session.rollback()
                return
            yield _sse_frame({"type": frame.type, **frame.payload})
        session.commit()
    except (httpx.HTTPStatusError, httpx.TimeoutException, httpx.RequestError) as exc:
        session.rollback()
        yield _sse_frame(
            {
                "type": "error",
                "code": "llm_upstream",
                "message": str(exc),
            }
        )
    except ServiceError as exc:
        session.rollback()
        yield _sse_frame(
            {
                "type": "error",
                "code": exc.code,
                "message": exc.message,
            }
        )
    finally:
        aclose = getattr(frames, "aclose", None)
        if callable(aclose):
            await aclose()


def _sse_frame(payload: dict[str, object]) -> bytes:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n".encode()
