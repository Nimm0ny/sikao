from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PlanEventV2, PlanV2, PracticeSessionV2
from sikao_api.db.schemas_v2 import PlanEventReadV2, PlanEventUpdateRequestV2
from sikao_api.modules.plans.application.helpers import now_utc, to_naive_utc
from sikao_api.modules.plans.domain.rrule_subset import (
    build_occurrence_ref,
    end_of_local_day,
    expand_occurrences,
    parse_occurrence_ref,
    start_of_local_day,
    truncate_rule_until,
    validate_rrule_subset,
)
from sikao_api.modules.system.application.errors import ConflictError, NotFoundError, ValidationError


class EventServiceSupport:
    def __init__(self, session: Session) -> None:
        self.session = session

    def _build_virtual_event_model(self, *, parent: PlanEventV2, occurrence_start: datetime) -> PlanEventReadV2:
        duration = parent.end_at - parent.start_at
        occurrence_ref = build_occurrence_ref(
            parent_id=parent.id,
            occurrence_start=occurrence_start,
            timezone=parent.timezone,
        )
        linked_session_id, status = self._resolve_runtime_status(
            stored_status=parent.status,
            event_start=occurrence_start,
            event_end=occurrence_start + duration,
            linked_sessions=self._list_linked_sessions(parent_id=parent.id, occurrence_ref=occurrence_ref),
        )
        return PlanEventReadV2(
            id=occurrence_ref,
            plan_id=parent.plan_id,
            title=parent.title,
            category=parent.category,
            notes=parent.notes,
            start_at=occurrence_start,
            end_at=occurrence_start + duration,
            timezone=parent.timezone,
            status=status,
            source=parent.source,
            parent_id=parent.id,
            recurring_rule=parent.recurring_rule,
            recurring_parent_id=parent.recurring_parent_id,
            recurring_exception_dates=parent.recurring_exception_dates,
            linked_session_id=linked_session_id,
            target_id=parent.target_id,
            deleted_at=parent.deleted_at,
            is_recurring_instance=True,
        )

    def _build_concrete_event_model(self, event: PlanEventV2) -> PlanEventReadV2:
        linked_session_id, status = self._resolve_runtime_status(
            stored_status=event.status,
            event_start=event.start_at,
            event_end=event.end_at,
            linked_sessions=self._list_linked_sessions(
                parent_id=event.id,
                occurrence_ref=None,
            ),
        )
        return PlanEventReadV2(
            id=str(event.id),
            plan_id=event.plan_id,
            title=event.title,
            category=event.category,
            notes=event.notes,
            start_at=event.start_at,
            end_at=event.end_at,
            timezone=event.timezone,
            status=status,
            source=event.source,
            parent_id=event.recurring_parent_id,
            recurring_rule=event.recurring_rule,
            recurring_parent_id=event.recurring_parent_id,
            recurring_exception_dates=event.recurring_exception_dates,
            linked_session_id=linked_session_id,
            target_id=event.target_id,
            deleted_at=event.deleted_at,
            is_recurring_instance=False,
        )

    def _apply_payload_to_event(
        self,
        event: PlanEventV2,
        payload: PlanEventUpdateRequestV2,
        *,
        allow_recurring_rule: bool,
    ) -> None:
        if payload.title is not None:
            event.title = payload.title
        if payload.category is not None:
            event.category = payload.category
        if payload.notes is not None:
            event.notes = payload.notes
        if payload.start_at is not None:
            event.start_at = to_naive_utc(payload.start_at)
        if payload.end_at is not None:
            event.end_at = to_naive_utc(payload.end_at)
        if payload.timezone is not None:
            event.timezone = payload.timezone
        if payload.status is not None:
            event.status = payload.status
        if payload.target_id is not None:
            event.target_id = payload.target_id
        if payload.recurring_rule is not None:
            if not allow_recurring_rule:
                raise ValidationError("recurring_rule cannot be updated on concrete override", code="invalid_event_update")
            validate_rrule_subset(payload.recurring_rule)
            event.recurring_rule = payload.recurring_rule
        self._validate_event_window(event.start_at, event.end_at)

    def _resolve_event_reference(
        self,
        *,
        user_id: int,
        event_id: str,
        include_deleted: bool = False,
    ) -> dict[str, object]:
        if ":" in event_id:
            parent_id, occurrence_day = parse_occurrence_ref(event_id)
            parent = self._get_event_row(user_id=user_id, event_id=parent_id, include_deleted=include_deleted)
            if parent.recurring_rule is None:
                raise NotFoundError("recurring event not found", code="event_not_found")
            occurrence_start = self._find_occurrence_start(parent=parent, occurrence_day=occurrence_day)
            return {"kind": "virtual", "parent": parent, "occurrence_start": occurrence_start}
        return {"kind": "concrete", "event": self._get_event_row(user_id=user_id, event_id=int(event_id), include_deleted=include_deleted)}

    def _find_occurrence_start(self, *, parent: PlanEventV2, occurrence_day: date) -> datetime:
        if parent.recurring_rule is None:
            raise NotFoundError("recurring event not found", code="event_not_found")
        range_start = start_of_local_day(occurrence_day, timezone=parent.timezone)
        range_end = end_of_local_day(occurrence_day, timezone=parent.timezone)
        occurrences = expand_occurrences(
            rule=parent.recurring_rule,
            dtstart=parent.start_at,
            range_start=range_start,
            range_end=range_end,
        )
        for occurrence_start in occurrences:
            occurrence_ref = build_occurrence_ref(
                parent_id=parent.id,
                occurrence_start=occurrence_start,
                timezone=parent.timezone,
            )
            if occurrence_ref.endswith(occurrence_day.isoformat()) and occurrence_day.isoformat() not in parent.recurring_exception_dates:
                return occurrence_start
        raise NotFoundError("recurring event occurrence not found", code="event_not_found")

    def _get_event_row(self, *, user_id: int, event_id: int, include_deleted: bool) -> PlanEventV2:
        event = self.session.scalar(
            select(PlanEventV2).where(PlanEventV2.id == event_id, PlanEventV2.user_id == user_id)
        )
        if event is None or (event.deleted_at is not None and not include_deleted):
            raise NotFoundError("event not found", code="event_not_found")
        return event

    def _get_plan_for_write(self, *, user_id: int, plan_id: int) -> PlanV2:
        plan = self.session.scalar(
            select(PlanV2).where(
                PlanV2.id == plan_id,
                PlanV2.user_id == user_id,
                PlanV2.deleted_at.is_(None),
            )
        )
        if plan is None:
            raise NotFoundError("plan not found", code="plan_not_found")
        if plan.status != "active":
            raise ConflictError("plan must be active before editing events", code="active_plan_required")
        return plan

    def _append_exception(self, *, parent: PlanEventV2, occurrence_start: datetime) -> None:
        occurrence_ref = build_occurrence_ref(
            parent_id=parent.id,
            occurrence_start=occurrence_start,
            timezone=parent.timezone,
        )
        occurrence_day = occurrence_ref.split(":", 1)[1]
        if occurrence_day not in parent.recurring_exception_dates:
            parent.recurring_exception_dates = [*parent.recurring_exception_dates, occurrence_day]

    def _soft_delete_future_detached_rows(self, *, parent_id: int, cutoff: datetime) -> None:
        detached_rows = list(
            self.session.scalars(
                select(PlanEventV2).where(
                    PlanEventV2.recurring_parent_id == parent_id,
                    PlanEventV2.recurring_rule.is_(None),
                    PlanEventV2.deleted_at.is_(None),
                    PlanEventV2.start_at >= cutoff,
                )
            )
        )
        for row in detached_rows:
            row.deleted_at = now_utc()
            self.session.add(row)

    def _lookup_occurrence_session_id(self, *, parent_id: int, occurrence_ref: str) -> int | None:
        session_row = self.session.scalar(
            select(PracticeSessionV2)
            .where(
                PracticeSessionV2.linked_plan_event_id == parent_id,
                PracticeSessionV2.linked_plan_event_occurrence_ref == occurrence_ref,
            )
            .order_by(PracticeSessionV2.started_at.desc(), PracticeSessionV2.id.desc())
        )
        return session_row.id if session_row is not None else None

    def _list_linked_sessions(
        self,
        *,
        parent_id: int,
        occurrence_ref: str | None,
    ) -> list[PracticeSessionV2]:
        query = select(PracticeSessionV2).where(PracticeSessionV2.linked_plan_event_id == parent_id)
        if occurrence_ref is None:
            query = query.where(PracticeSessionV2.linked_plan_event_occurrence_ref.is_(None))
        else:
            query = query.where(PracticeSessionV2.linked_plan_event_occurrence_ref == occurrence_ref)
        return list(self.session.scalars(query.order_by(PracticeSessionV2.started_at.desc(), PracticeSessionV2.id.desc())))

    def _resolve_runtime_status(
        self,
        *,
        stored_status: str,
        event_start: datetime,
        event_end: datetime,
        linked_sessions: list[PracticeSessionV2],
    ) -> tuple[int | None, str]:
        linked_session_id = linked_sessions[0].id if linked_sessions else None
        has_submitted_session = any(
            row.status == "submitted" or row.submitted_at is not None for row in linked_sessions
        )
        current_time = now_utc()
        if stored_status == "done":
            return linked_session_id, "done"
        if stored_status == "skipped" and not linked_sessions:
            return linked_session_id, "skipped"
        if has_submitted_session and current_time >= event_end:
            return linked_session_id, "done"
        if linked_sessions:
            return linked_session_id, "in_progress"
        if current_time >= event_start and current_time < event_end:
            return linked_session_id, "in_progress"
        if current_time >= event_end:
            return linked_session_id, "skipped"
        return linked_session_id, "planned"

    def _build_utc_window(self, *, from_date: date, to_date: date, timezone: str) -> tuple[datetime, datetime]:
        if to_date < from_date:
            raise ValidationError("to must be >= from", code="invalid_event_window")
        zone = ZoneInfo(timezone)
        range_start = datetime.combine(from_date, datetime.min.time(), tzinfo=zone).astimezone(UTC)
        range_end = datetime.combine(to_date + timedelta(days=1), datetime.min.time(), tzinfo=zone).astimezone(UTC)
        return range_start.replace(tzinfo=None), range_end.replace(tzinfo=None)

    def _validate_window(self, *, range_start: datetime, range_end: datetime) -> None:
        if range_end <= range_start:
            raise ValidationError("event window is invalid", code="invalid_event_window")
        if range_end - range_start > timedelta(days=90):
            raise ValidationError("event window cannot exceed 90 days", code="invalid_event_window")

    def _validate_event_window(self, start_at: datetime, end_at: datetime) -> None:
        if end_at <= start_at:
            raise ValidationError("event end_at must be after start_at", code="invalid_event_time_window")

    def _expand_proposed_event(
        self,
        *,
        title: str,
        category: str,
        start_at: datetime,
        end_at: datetime,
        recurring_rule: str | None,
        range_start: datetime,
        range_end: datetime,
    ) -> list[tuple[datetime, datetime, str]]:
        if recurring_rule is None:
            return [(start_at, end_at, title)]
        duration = end_at - start_at
        return [
            (occurrence_start, occurrence_start + duration, f"{title} ({category})")
            for occurrence_start in expand_occurrences(
                rule=recurring_rule,
                dtstart=start_at,
                range_start=range_start,
                range_end=range_end,
            )
        ]

    def _windows_overlap(
        self,
        left_start: datetime,
        left_end: datetime,
        right_start: datetime,
        right_end: datetime,
    ) -> bool:
        return left_start < right_end and right_start < left_end

    def _truncate_rule_until(self, *, rule: str, cutoff: datetime) -> str:
        return truncate_rule_until(rule=rule, cutoff=cutoff)
