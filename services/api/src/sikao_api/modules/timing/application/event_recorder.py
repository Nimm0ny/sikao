from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeSessionAnswerV2, PracticeSessionV2, UserV2
from sikao_api.modules.system.application.errors import ConflictError, NotFoundError, ServiceError, ValidationError
from sikao_api.modules.timing.interface.schemas import TimingEventBatchAckV2, TimingEventBatchRequestV2, TimingEventV2

_TIMING_STATE_KEY = "_timing_state"
_OPEN_INTERVALS_KEY = "open_intervals"
_MAX_BATCH_EVENTS = 200
_STALE_EVENT_GRACE_SECONDS = 60
_MAX_ACTIVE_INTERVAL_MS = 60_000


def record_events(
    session: Session,
    *,
    user: UserV2,
    session_id: int,
    payload: TimingEventBatchRequestV2,
) -> TimingEventBatchAckV2:
    if len(payload.events) > _MAX_BATCH_EVENTS:
        raise ServiceError(
            "timing event batch exceeds limit",
            status_code=400,
            code="PAYLOAD_TOO_LARGE",
        )
    _ensure_events_sorted(payload.events)

    practice_session = session.scalar(
        select(PracticeSessionV2).where(
            PracticeSessionV2.id == session_id,
            PracticeSessionV2.user_id == user.id,
        )
    )
    if practice_session is None:
        raise NotFoundError("practice session not found", code="practice_session_not_found")
    if practice_session.status not in {"in_progress", "paused"}:
        raise ConflictError(
            "practice session is not writable",
            code="SESSION_NOT_WRITABLE",
        )
    events = _normalize_events(practice_session=practice_session, events=payload.events)
    _ensure_events_sorted(events)

    answers = {
        answer.id: answer
        for answer in session.scalars(
            select(PracticeSessionAnswerV2).where(
                PracticeSessionAnswerV2.session_id == practice_session.id
            )
        )
    }
    timing_state = _load_timing_state(practice_session)
    open_intervals = timing_state.setdefault(_OPEN_INTERVALS_KEY, {})
    batch_max_ts: datetime | None = None
    first_question_ts: datetime | None = None

    for event in events:
        answer = answers.get(event.answer_id)
        if answer is None:
            raise NotFoundError(
                "practice session answer not found",
                code="practice_session_answer_not_found",
            )
        _ensure_not_stale(answer=answer, event=event)
        batch_max_ts = event.ts if batch_max_ts is None else max(batch_max_ts, event.ts)
        if event.type == "question_enter":
            if first_question_ts is None:
                first_question_ts = event.ts
            _handle_question_enter(answer=answer, event=event, open_intervals=open_intervals)
        elif event.type == "question_leave":
            _handle_question_leave(answer=answer, event=event, open_intervals=open_intervals)
        else:
            _handle_answer_change(answer=answer, event=event)
        session.add(answer)

    practice_session.payload_json = {
        **practice_session.payload_json,
        _TIMING_STATE_KEY: timing_state,
    }
    if first_question_ts is not None and practice_session.first_question_at is None:
        practice_session.first_question_at = first_question_ts
    if batch_max_ts is not None:
        practice_session.last_activity_at = batch_max_ts
    session.add(practice_session)
    session.flush()
    practice_session.total_active_seconds = _compute_total_active_seconds(session, practice_session.id)
    session.add(practice_session)
    session.flush()
    return TimingEventBatchAckV2(
        accepted=len(events),
        rejected=0,
        last_ack_event_idx=len(events) - 1 if events else -1,
    )


def _ensure_events_sorted(events: list[TimingEventV2]) -> None:
    for index in range(1, len(events)):
        if events[index].ts < events[index - 1].ts:
            raise ValidationError(
                "timing events must be sorted by ts",
                code="EVENT_ORDER_VIOLATION",
            )


def _ensure_not_stale(*, answer: PracticeSessionAnswerV2, event: TimingEventV2) -> None:
    if answer.last_modified_at is None:
        return
    if event.ts < answer.last_modified_at - timedelta(seconds=_STALE_EVENT_GRACE_SECONDS):
        raise ValidationError("timing event is stale", code="STALE_EVENT")


def _normalize_events(
    *,
    practice_session: PracticeSessionV2,
    events: list[TimingEventV2],
) -> list[TimingEventV2]:
    if not practice_session.exam_mode or practice_session.auto_submit_at is None:
        return events
    deadline = practice_session.auto_submit_at
    return [
        event.model_copy(update={"ts": min(event.ts, deadline)})
        for event in events
    ]


def _load_timing_state(practice_session: PracticeSessionV2) -> dict[str, Any]:
    raw = practice_session.payload_json.get(_TIMING_STATE_KEY)
    if isinstance(raw, dict):
        return dict(raw)
    return {_OPEN_INTERVALS_KEY: {}}


def _handle_question_enter(
    *,
    answer: PracticeSessionAnswerV2,
    event: TimingEventV2,
    open_intervals: dict[str, str],
) -> int:
    added_ms = 0
    existing_open = _parse_open_ts(open_intervals.get(str(answer.id)))
    if existing_open is not None and event.ts > existing_open:
        added_ms += _clamped_duration_ms(existing_open, event.ts)
        answer.time_spent_ms += added_ms
    open_intervals[str(answer.id)] = event.ts.isoformat()
    answer.visit_count += 1
    if answer.first_seen_at is None:
        answer.first_seen_at = event.ts
    return added_ms


def _handle_question_leave(
    *,
    answer: PracticeSessionAnswerV2,
    event: TimingEventV2,
    open_intervals: dict[str, str],
) -> int:
    existing_open = _parse_open_ts(open_intervals.get(str(answer.id)))
    if existing_open is None or event.ts <= existing_open:
        return 0
    open_intervals.pop(str(answer.id), None)
    added_ms = _clamped_duration_ms(existing_open, event.ts)
    answer.time_spent_ms += added_ms
    return added_ms


def _handle_answer_change(*, answer: PracticeSessionAnswerV2, event: TimingEventV2) -> None:
    if event.from_value != event.to_value and event.from_value is not None:
        answer.answer_change_count += 1
    if answer.first_answered_at is None and event.to_value is not None:
        answer.first_answered_at = event.ts
    answer.last_modified_at = event.ts


def _parse_open_ts(value: str | None) -> datetime | None:
    if value is None:
        return None
    return datetime.fromisoformat(value)


def _duration_ms(start: datetime, end: datetime) -> int:
    return max(0, int((end - start).total_seconds() * 1000))


def _clamped_duration_ms(start: datetime, end: datetime) -> int:
    return min(_duration_ms(start, end), _MAX_ACTIVE_INTERVAL_MS)


def _compute_total_active_seconds(session: Session, session_id: int) -> int:
    total_ms = sum(
        value or 0
        for value in session.scalars(
            select(PracticeSessionAnswerV2.time_spent_ms).where(
                PracticeSessionAnswerV2.session_id == session_id
            )
        )
    )
    return total_ms // 1000
