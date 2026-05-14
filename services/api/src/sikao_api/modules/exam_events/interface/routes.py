"""Public + admin endpoints for exam events (考试日历, ARCH §7.3 P3)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from sikao_api.db.session import get_db_session
from sikao_api.db import schemas
from sikao_api.modules.exam_events.application.exam_events import ExamEventService
from sikao_api.modules.auth.application.security import get_admin_principal

# Public router (no auth) — frontend ExamCalendar useQuery 拉.
public_router = APIRouter(prefix="/api/v2/exam-events", tags=["exam-events-v2"])

# Admin router — basic-auth admin only, CRUD 维护数据.
admin_router = APIRouter(
    prefix="/api/v2/admin/exam-events", tags=["exam-events-admin-v2"]
)


# ─── Public ──────────────────────────────────────────────────────────────


@public_router.get("", response_model=schemas.ExamEventListResponse)
def list_visible(
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.ExamEventListResponse:
    """List visible exam events, sorted by exam_date asc.

    Public — frontend ExamCalendar 用. visible=False 由 admin 隐藏的 entry
    不进 list (草稿 / 已废弃 entry 不显给 user).
    """
    items = ExamEventService(session).list_visible()
    return schemas.ExamEventListResponse(items=items)


# ─── Admin (require basic auth) ──────────────────────────────────────────


@admin_router.get("", response_model=schemas.ExamEventListResponse)
def admin_list(
    session: Annotated[Session, Depends(get_db_session)],
    _: Annotated[str, Depends(get_admin_principal)],
) -> schemas.ExamEventListResponse:
    """Admin list — 含 hidden rows."""
    items = ExamEventService(session).list_all()
    return schemas.ExamEventListResponse(items=items)


@admin_router.post(
    "", response_model=schemas.ExamEventOutV2, status_code=status.HTTP_201_CREATED
)
def admin_create(
    payload: schemas.ExamEventCreateRequest,
    session: Annotated[Session, Depends(get_db_session)],
    _: Annotated[str, Depends(get_admin_principal)],
) -> schemas.ExamEventOutV2:
    return ExamEventService(session).create(payload)


@admin_router.put("/{event_id}", response_model=schemas.ExamEventOutV2)
def admin_update(
    event_id: int,
    payload: schemas.ExamEventUpdateRequest,
    session: Annotated[Session, Depends(get_db_session)],
    _: Annotated[str, Depends(get_admin_principal)],
) -> schemas.ExamEventOutV2:
    return ExamEventService(session).update(event_id, payload)


@admin_router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete(
    event_id: int,
    session: Annotated[Session, Depends(get_db_session)],
    _: Annotated[str, Depends(get_admin_principal)],
) -> None:
    ExamEventService(session).delete(event_id)
