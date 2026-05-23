from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeSessionAnswerV2, PracticeSessionV2, QuestionTimingBaselineV2
from sikao_api.modules.system.application.audit_v2 import add_audit_log

_TIMING_STATE_KEY = "_timing_state"
_OPEN_INTERVALS_KEY = "open_intervals"
_MIN_SAMPLES = 30
_MAX_INTERVAL_MS = 60_000
_WALL_CLOCK_TOLERANCE_SECONDS = 5


def apply_submit_timing_summary(
    session: Session,
    *,
    practice_session: PracticeSessionV2,
    submitted_at: datetime,
) -> None:
    answers = list(
        session.scalars(
            select(PracticeSessionAnswerV2).where(
                PracticeSessionAnswerV2.session_id == practice_session.id
            )
            .order_by(PracticeSessionAnswerV2.display_order.asc(), PracticeSessionAnswerV2.id.asc())
        )
    )
    answers_by_id = {answer.id: answer for answer in answers}
    payload_json = dict(practice_session.payload_json)
    timing_state = payload_json.get(_TIMING_STATE_KEY)
    open_intervals = _load_open_intervals(timing_state)
    clamped_intervals = 0
    active_end = (
        practice_session.paused_at
        if practice_session.status == "paused" and practice_session.paused_at is not None
        else submitted_at
    )
    max_active_seconds = _max_active_seconds(
        started_at=practice_session.started_at,
        ended_at=submitted_at,
        paused_total_seconds=practice_session.paused_total_seconds,
    )
    max_active_ms = max_active_seconds * 1000
    remaining_budget_ms = max(0, max_active_ms - sum(answer.time_spent_ms for answer in answers))

    for answer_id, opened_at in open_intervals.items():
        answer = answers_by_id.get(answer_id)
        effective_start = max(opened_at, practice_session.started_at)
        if answer is None or active_end <= effective_start:
            continue
        raw_ms = _duration_ms(effective_start, active_end)
        clamped_ms = min(raw_ms, _MAX_INTERVAL_MS)
        added_ms = min(clamped_ms, remaining_budget_ms)
        answer.time_spent_ms += added_ms
        remaining_budget_ms = max(0, remaining_budget_ms - added_ms)
        if added_ms < clamped_ms or raw_ms > _MAX_INTERVAL_MS:
            clamped_intervals += 1
        session.add(answer)

    baselines = {
        baseline.question_id: baseline
        for baseline in session.scalars(
            select(QuestionTimingBaselineV2).where(
                QuestionTimingBaselineV2.question_id.in_(
                    [answer.question_id for answer in answers if answer.question_id is not None]
                )
            )
        )
    }
    total_ms = sum(answer.time_spent_ms for answer in answers)

    raw_total_active_seconds = total_ms // 1000
    adjusted_total_active_seconds = min(raw_total_active_seconds, max_active_seconds)
    if adjusted_total_active_seconds != raw_total_active_seconds:
        _reduce_answer_totals(answers, (raw_total_active_seconds - adjusted_total_active_seconds) * 1000)
        clamped_intervals += 1
        total_ms = sum(answer.time_spent_ms for answer in answers)

    for answer in answers:
        baseline = baselines.get(answer.question_id or -1)
        if baseline is not None and baseline.sample_size >= _MIN_SAMPLES:
            answer.is_overtime = answer.time_spent_ms > baseline.p95_ms * 1.2
        else:
            answer.is_overtime = False
        session.add(answer)

    payload_json[_TIMING_STATE_KEY] = {_OPEN_INTERVALS_KEY: {}}
    practice_session.payload_json = payload_json
    practice_session.total_active_seconds = adjusted_total_active_seconds
    session.add(practice_session)

    if clamped_intervals > 0:
        add_audit_log(
            session,
            user_id=practice_session.user_id,
            actor_type="system",
            actor_id="timing.submit_summary",
            action="timing.session_clamped_intervals",
            target_type="practice_session_v2",
            target_id=practice_session.id,
            metadata={
                "clamped_intervals": clamped_intervals,
                "raw_total_active_seconds": raw_total_active_seconds,
                "adjusted_total_active_seconds": adjusted_total_active_seconds,
            },
            request_id=None,
            ip=None,
        )


def _load_open_intervals(raw_state: Any) -> dict[int, datetime]:
    if not isinstance(raw_state, dict):
        return {}
    raw_open = raw_state.get(_OPEN_INTERVALS_KEY)
    if not isinstance(raw_open, dict):
        return {}
    parsed: dict[int, datetime] = {}
    for answer_id, ts in raw_open.items():
        if not isinstance(answer_id, str) or not isinstance(ts, str):
            continue
        if not answer_id.isdigit():
            continue
        parsed[int(answer_id)] = datetime.fromisoformat(ts)
    return parsed


def _duration_ms(start: datetime, end: datetime) -> int:
    return max(0, int((end - start).total_seconds() * 1000))


def _max_active_seconds(*, started_at: datetime, ended_at: datetime, paused_total_seconds: int) -> int:
    wall_clock_seconds = max(0, int((ended_at - started_at).total_seconds()))
    return max(
        0,
        min(
            wall_clock_seconds,
            wall_clock_seconds + _WALL_CLOCK_TOLERANCE_SECONDS - paused_total_seconds,
        ),
    )


def _reduce_answer_totals(answers: list[PracticeSessionAnswerV2], overflow_ms: int) -> None:
    remaining = overflow_ms
    for answer in reversed(answers):
        if remaining <= 0:
            break
        reducible = min(answer.time_spent_ms, remaining)
        answer.time_spent_ms -= reducible
        remaining -= reducible
