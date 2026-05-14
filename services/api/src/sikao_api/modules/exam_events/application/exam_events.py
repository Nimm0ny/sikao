"""Exam events service — ARCH §7.3 P3 (KEY OBS #5).

CRUD over exam_events table for admin UI + public list endpoint.
"""

from __future__ import annotations

from datetime import date
from typing import cast

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from sikao_api.db import schemas
from sikao_api.db.models import ExamEvent
from sikao_api.modules.system.application.errors import ConflictError, NotFoundError, ValidationError


def _parse_iso_date(value: str | None, *, field: str) -> date | None:
    """ISO 'YYYY-MM-DD' → date. None passthrough. fail-fast on bad format."""
    if value is None or value == "":
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValidationError(f"{field} must be YYYY-MM-DD, got {value!r}") from exc


def _parse_required_iso_date(value: str, *, field: str) -> date:
    parsed = _parse_iso_date(value, field=field)
    if parsed is None:
        raise ValidationError(f"{field} must be YYYY-MM-DD, got {value!r}")
    return parsed


def _serialize(event: ExamEvent) -> schemas.ExamEventOutV2:
    category = cast("schemas.ExamEventCategory", event.category)
    precision = cast("schemas.ExamEventPrecision", event.precision)
    return schemas.ExamEventOutV2(
        id=event.id,
        slug=event.slug,
        name=event.name,
        category=category,
        exam_date=event.exam_date.isoformat(),
        registration_start=(
            event.registration_start.isoformat()
            if event.registration_start is not None
            else None
        ),
        registration_end=(
            event.registration_end.isoformat()
            if event.registration_end is not None
            else None
        ),
        precision=precision,
        notes=event.notes,
    )


class ExamEventService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_visible(self) -> list[schemas.ExamEventOutV2]:
        """Public list — visible=True only, sorted by exam_date asc."""
        rows = self.session.scalars(
            select(ExamEvent)
            .where(ExamEvent.visible.is_(True))
            .order_by(ExamEvent.exam_date.asc(), ExamEvent.id.asc())
        ).all()
        return [_serialize(e) for e in rows]

    def list_all(self) -> list[schemas.ExamEventOutV2]:
        """Admin list — includes hidden rows."""
        rows = self.session.scalars(
            select(ExamEvent).order_by(ExamEvent.exam_date.asc(), ExamEvent.id.asc())
        ).all()
        return [_serialize(e) for e in rows]

    def create(
        self, payload: schemas.ExamEventCreateRequest
    ) -> schemas.ExamEventOutV2:
        # B-review B3 修: 不在 service 层 self.session.rollback() — 那会破
        # 整个 request transaction (route 可能 begin 了 audit log / counter 等
        # 别的 write). 让 IntegrityError 抛 ConflictError, 由 get_db_session
        # dependency / route handler 决定是否 rollback. service 仅做 domain
        # error mapping. fail-fast: caller 拿到 ConflictError 自然知道整 batch
        # / request 失败, 自己处理 transaction 边界.
        event = ExamEvent(
            slug=payload.slug.strip(),
            name=payload.name.strip(),
            category=payload.category,
            exam_date=_parse_iso_date(payload.exam_date, field="examDate"),
            registration_start=_parse_iso_date(
                payload.registration_start, field="registrationStart"
            ),
            registration_end=_parse_iso_date(
                payload.registration_end, field="registrationEnd"
            ),
            precision=payload.precision,
            notes=payload.notes,
            visible=payload.visible,
        )
        self.session.add(event)
        try:
            self.session.flush()
        except IntegrityError as exc:
            raise ConflictError(
                f"slug already exists: {payload.slug!r}", code="exam_event_slug_taken"
            ) from exc
        return _serialize(event)

    def update(
        self, event_id: int, payload: schemas.ExamEventUpdateRequest
    ) -> schemas.ExamEventOutV2:
        event = self.session.get(ExamEvent, event_id)
        if event is None:
            raise NotFoundError(f"exam event {event_id} not found")
        # Patch — 仅覆盖非 None 字段.
        if payload.name is not None:
            event.name = payload.name.strip()
        if payload.category is not None:
            event.category = payload.category
        if payload.exam_date is not None:
            event.exam_date = _parse_required_iso_date(payload.exam_date, field="examDate")
        if payload.registration_start is not None:
            event.registration_start = _parse_iso_date(
                payload.registration_start, field="registrationStart"
            )
        if payload.registration_end is not None:
            event.registration_end = _parse_iso_date(
                payload.registration_end, field="registrationEnd"
            )
        if payload.precision is not None:
            event.precision = payload.precision
        if payload.notes is not None:
            event.notes = payload.notes
        if payload.visible is not None:
            event.visible = payload.visible
        self.session.flush()
        return _serialize(event)

    def delete(self, event_id: int) -> None:
        event = self.session.get(ExamEvent, event_id)
        if event is None:
            raise NotFoundError(f"exam event {event_id} not found")
        self.session.delete(event)
        self.session.flush()
