from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import PlanEventV2, PracticeSessionV2
from sikao_api.modules.plans.application.event_service import EventServiceSupport
from sikao_api.modules.plans.application.helpers import append_change_log, now_utc, serialize_event
from sikao_api.modules.plans.domain.rrule_subset import build_occurrence_ref, expand_occurrences
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.scheduler.jobs._shared import (
    HOME_SCHEDULER_ACTOR_ID,
    HOME_SCHEDULER_ACTOR_TYPE,
    build_request_id,
    run_sync_job,
    run_with_session,
)
from sikao_api.scheduler.registry import HomeSchedulerContext, HomeSchedulerJob

JOB_ID = "home.event_status_tick"


@dataclass(frozen=True, slots=True)
class EventStatusTickResult:
    updated_events: int
    materialized_occurrences: int


class _EventStatusTickSupport(EventServiceSupport):
    pass


def build_event_status_tick_job(settings: Settings) -> HomeSchedulerJob:
    return HomeSchedulerJob(
        job_id=JOB_ID,
        name=JOB_ID,
        trigger=IntervalTrigger(
            minutes=settings.home_event_status_tick_interval_minutes,
            timezone=settings.home_scheduler_timezone,
        ),
        func=run_event_status_tick_job,
    )


async def run_event_status_tick_job(context: HomeSchedulerContext) -> EventStatusTickResult:
    return await run_sync_job(context, sync_run_event_status_tick_job)


def sync_run_event_status_tick_job(
    context: HomeSchedulerContext,
    *,
    current_time: datetime | None = None,
) -> EventStatusTickResult:
    now = current_time or now_utc()
    request_id = build_request_id(JOB_ID)

    def _tick(session: Session) -> EventStatusTickResult:
        support = _EventStatusTickSupport(session)
        rows = list(
            session.scalars(
                select(PlanEventV2)
                .where(
                    PlanEventV2.deleted_at.is_(None),
                    PlanEventV2.status.in_(("planned", "in_progress")),
                    PlanEventV2.end_at <= now,
                )
                .order_by(PlanEventV2.user_id.asc(), PlanEventV2.start_at.asc(), PlanEventV2.id.asc())
            )
        )
        updated_events = 0
        materialized_occurrences = 0
        for row in rows:
            if row.recurring_rule is not None and row.recurring_parent_id is None:
                materialized_occurrences += _materialize_terminal_occurrences(
                    session=session,
                    support=support,
                    parent=row,
                    now=now,
                    request_id=request_id,
                )
                continue
            if _apply_terminal_status_to_event(
                session=session,
                support=support,
                event=row,
                now=now,
                request_id=request_id,
            ):
                updated_events += 1
        return EventStatusTickResult(
            updated_events=updated_events,
            materialized_occurrences=materialized_occurrences,
        )

    return run_with_session(context, _tick)


def _apply_terminal_status_to_event(
    *,
    session: Session,
    support: _EventStatusTickSupport,
    event: PlanEventV2,
    now: datetime,
    request_id: str,
) -> bool:
    linked_sessions = support._list_linked_sessions(parent_id=event.id, occurrence_ref=None)
    terminal_status = _determine_terminal_status(linked_sessions=linked_sessions)
    latest_linked_session_id = linked_sessions[0].id if linked_sessions else None
    before = serialize_event(event)
    changed = False
    if event.status != terminal_status:
        event.status = terminal_status
        changed = True
    if latest_linked_session_id is not None and event.linked_session_id != latest_linked_session_id:
        event.linked_session_id = latest_linked_session_id
        changed = True
    if not changed:
        return False
    event.change_log = append_change_log(
        event.change_log,
        change_type="status_tick",
        before=before,
        after=serialize_event(event),
        reason="event_status_tick",
        actor=HOME_SCHEDULER_ACTOR_ID,
    )
    session.add(event)
    add_audit_log(
        session,
        user_id=event.user_id,
        actor_type=HOME_SCHEDULER_ACTOR_TYPE,
        actor_id=HOME_SCHEDULER_ACTOR_ID,
        action="plan_event.status_tick",
        target_type="plan_event_v2",
        target_id=event.id,
        before=before,
        after=serialize_event(event),
        metadata={"job_id": JOB_ID, "evaluated_at": now.isoformat()},
        request_id=request_id,
    )
    return True


def _materialize_terminal_occurrences(
    *,
    session: Session,
    support: _EventStatusTickSupport,
    parent: PlanEventV2,
    now: datetime,
    request_id: str,
) -> int:
    if parent.recurring_rule is None:
        return 0
    occurrence_starts = expand_occurrences(
        rule=parent.recurring_rule,
        dtstart=parent.start_at,
        range_start=parent.start_at,
        range_end=now,
    )
    if not occurrence_starts:
        return 0
    duration = parent.end_at - parent.start_at
    existing_detached = {
        build_occurrence_ref(parent_id=parent.id, occurrence_start=row.start_at, timezone=parent.timezone): row
        for row in session.scalars(
            select(PlanEventV2).where(
                PlanEventV2.recurring_parent_id == parent.id,
                PlanEventV2.recurring_rule.is_(None),
            )
        )
    }
    materialized = 0
    for occurrence_start in occurrence_starts:
        if occurrence_start + duration > now:
            continue
        occurrence_ref = build_occurrence_ref(
            parent_id=parent.id,
            occurrence_start=occurrence_start,
            timezone=parent.timezone,
        )
        occurrence_day = occurrence_ref.split(":", 1)[1]
        if occurrence_day in parent.recurring_exception_dates:
            continue
        existing = existing_detached.get(occurrence_ref)
        if existing is not None:
            parent.recurring_exception_dates = [*parent.recurring_exception_dates, occurrence_day]
            session.add(parent)
            continue
        linked_sessions = support._list_linked_sessions(parent_id=parent.id, occurrence_ref=occurrence_ref)
        terminal_status = _determine_terminal_status(linked_sessions=linked_sessions)
        latest_linked_session_id = linked_sessions[0].id if linked_sessions else None
        detached = PlanEventV2(
            plan_id=parent.plan_id,
            user_id=parent.user_id,
            title=parent.title,
            category=parent.category,
            notes=parent.notes,
            start_at=occurrence_start,
            end_at=occurrence_start + duration,
            timezone=parent.timezone,
            recurring_rule=None,
            recurring_parent_id=parent.id,
            recurring_exception_dates=[],
            status=terminal_status,
            source=parent.source,
            linked_session_id=latest_linked_session_id,
            target_id=parent.target_id,
            change_log=[],
        )
        session.add(detached)
        session.flush()
        after = serialize_event(detached)
        detached.change_log = append_change_log(
            detached.change_log,
            change_type="status_tick_materialize",
            before=None,
            after=after,
            reason="event_status_tick",
            actor=HOME_SCHEDULER_ACTOR_ID,
        )
        before_parent = serialize_event(parent)
        parent.recurring_exception_dates = [*parent.recurring_exception_dates, occurrence_day]
        parent.change_log = append_change_log(
            parent.change_log,
            change_type="status_tick_exception",
            before=before_parent,
            after=serialize_event(parent),
            reason="event_status_tick",
            actor=HOME_SCHEDULER_ACTOR_ID,
        )
        session.add_all([parent, detached])
        add_audit_log(
            session,
            user_id=parent.user_id,
            actor_type=HOME_SCHEDULER_ACTOR_TYPE,
            actor_id=HOME_SCHEDULER_ACTOR_ID,
            action="plan_event.status_tick_materialize",
            target_type="plan_event_v2",
            target_id=detached.id,
            before=None,
            after=after,
            metadata={
                "job_id": JOB_ID,
                "parent_id": parent.id,
                "occurrence_ref": occurrence_ref,
                "terminal_status": terminal_status,
            },
            request_id=request_id,
        )
        materialized += 1
    return materialized


def _determine_terminal_status(*, linked_sessions: list[PracticeSessionV2]) -> str:
    return "done" if any(row.status == "submitted" or row.submitted_at is not None for row in linked_sessions) else "skipped"
