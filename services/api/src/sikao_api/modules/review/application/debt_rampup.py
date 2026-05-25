from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from datetime import timedelta

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from sikao_api.db.enums_v2 import DebtStatus, RampupPhase, ReviewAttemptOutcome
from sikao_api.db.models_v2 import ProfileInfoV2, ReviewItemV2
from sikao_api.modules.review.application.debt_preferences import (
    ReviewRampupRuntime,
    write_review_rampup_runtime,
)
from sikao_api.modules.review.application.debt_redistribution import fetch_overdue_items
from sikao_api.modules.review.application.queue_items import record_review_attempt
from sikao_api.modules.review.application.srs_core import get_today_end, utc_now
from sikao_api.modules.review.application.srs_types import ensure_metadata

_PHASE_ORDER = [
    RampupPhase.DAY_1,
    RampupPhase.DAY_2,
    RampupPhase.DAY_3,
    RampupPhase.DAY_4,
    RampupPhase.DAY_5,
]


@dataclass(frozen=True)
class RampupApplyResult:
    phase: RampupPhase
    protected_count: int
    active_today_count: int


def should_trigger_rampup(*, days_since_last_attempt: int | None) -> bool:
    return days_since_last_attempt is not None and days_since_last_attempt >= 7


def current_phase_limit(*, phase: RampupPhase, daily_limit: int) -> int:
    phase_limit_map = {
        RampupPhase.DAY_1: 10,
        RampupPhase.DAY_2: 15,
        RampupPhase.DAY_3: 20,
        RampupPhase.DAY_4: 25,
        RampupPhase.DAY_5: daily_limit,
    }
    return min(phase_limit_map[phase], daily_limit)


def start_rampup(
    session: Session,
    *,
    user_id: int,
    info: ProfileInfoV2,
    user_tz: str,
    daily_limit: int,
) -> RampupApplyResult:
    started_at = utc_now()
    unlock_at = get_today_end(user_tz) + timedelta(days=5)
    result = _apply_rampup_phase(
        session,
        user_id=user_id,
        phase=RampupPhase.DAY_1,
        started_at=started_at,
        unlock_at=unlock_at,
        user_tz=user_tz,
        daily_limit=daily_limit,
        initial=True,
    )
    write_review_rampup_runtime(
        info,
        phase=RampupPhase.DAY_1,
        started_at=started_at,
        unlock_at=unlock_at,
        last_transition_on=_today_local(user_tz),
    )
    session.add(info)
    return result


def advance_rampup(
    session: Session,
    *,
    user_id: int,
    info: ProfileInfoV2,
    runtime: ReviewRampupRuntime,
    user_tz: str,
    daily_limit: int,
) -> RampupApplyResult | None:
    if not runtime.active or runtime.phase is None:
        return None
    if runtime.phase == RampupPhase.DAY_5:
        return None
    next_phase = _PHASE_ORDER[_PHASE_ORDER.index(runtime.phase) + 1]
    unlock_at = get_today_end(user_tz) + timedelta(days=max(1, 5 - _PHASE_ORDER.index(next_phase)))
    result = _apply_rampup_phase(
        session,
        user_id=user_id,
        phase=next_phase,
        started_at=runtime.started_at or utc_now(),
        unlock_at=unlock_at,
        user_tz=user_tz,
        daily_limit=daily_limit,
        initial=False,
    )
    write_review_rampup_runtime(
        info,
        phase=next_phase,
        started_at=runtime.started_at or utc_now(),
        unlock_at=unlock_at,
        last_transition_on=_today_local(user_tz),
    )
    session.add(info)
    return result


def complete_rampup(
    session: Session,
    *,
    user_id: int,
    info: ProfileInfoV2,
) -> int:
    rows = list(
        session.query(ReviewItemV2)
        .filter(ReviewItemV2.user_id == user_id)
        .all()
    )
    cleared = 0
    for row in rows:
        metadata = dict(ensure_metadata(row))
        if metadata.get("debt_status") != DebtStatus.RAMP_UP_PROTECTED.value:
            continue
        started_at = metadata.get("ramp_up_started_at")
        metadata.pop("debt_status", None)
        metadata.pop("ramp_up_phase", None)
        metadata.pop("ramp_up_started_at", None)
        metadata.pop("ramp_up_unlock_at", None)
        row.metadata_json = metadata
        flag_modified(row, "metadata_json")
        session.add(row)
        record_review_attempt(
            session,
            item_id=row.id,
            outcome=ReviewAttemptOutcome.RAMPUP_COMPLETED.value,
            notes_json={
                "started_at": started_at,
                "completed_at": utc_now().isoformat(),
            },
        )
        cleared += 1
    write_review_rampup_runtime(info, phase=None, started_at=None, unlock_at=None)
    session.add(info)
    return cleared


def _apply_rampup_phase(
    session: Session,
    *,
    user_id: int,
    phase: RampupPhase,
    started_at,
    unlock_at,
    user_tz: str,
    daily_limit: int,
    initial: bool,
) -> RampupApplyResult:
    overdue_items = fetch_overdue_items(session, user_id=user_id, user_tz=user_tz)
    selected_limit = current_phase_limit(phase=phase, daily_limit=daily_limit)
    prioritized = _prioritize_for_phase(overdue_items, phase=phase)
    active_today_ids = {row.id for row in prioritized[:selected_limit]}
    protected_count = 0
    for row in prioritized:
        metadata = dict(ensure_metadata(row))
        if row.id in active_today_ids:
            if metadata.get("debt_status") == DebtStatus.RAMP_UP_PROTECTED.value:
                metadata.pop("debt_status", None)
                metadata.pop("ramp_up_phase", None)
                metadata.pop("ramp_up_started_at", None)
                metadata.pop("ramp_up_unlock_at", None)
                row.metadata_json = metadata
                flag_modified(row, "metadata_json")
                session.add(row)
            continue
        previous_phase = metadata.get("ramp_up_phase")
        metadata["debt_status"] = DebtStatus.RAMP_UP_PROTECTED.value
        metadata["ramp_up_phase"] = phase.value
        metadata["ramp_up_started_at"] = started_at.isoformat()
        metadata["ramp_up_unlock_at"] = unlock_at.isoformat()
        row.metadata_json = metadata
        flag_modified(row, "metadata_json")
        session.add(row)
        record_review_attempt(
            session,
            item_id=row.id,
            outcome=(
                ReviewAttemptOutcome.RAMPUP_STARTED.value
                if initial or previous_phase is None
                else ReviewAttemptOutcome.RAMPUP_PHASE_CHANGED.value
            ),
            notes_json={
                "started_at": started_at.isoformat(),
                "unlock_at": unlock_at.isoformat(),
                "from_phase": previous_phase,
                "to_phase": phase.value,
            },
        )
        protected_count += 1
    return RampupApplyResult(
        phase=phase,
        protected_count=protected_count,
        active_today_count=min(len(prioritized), selected_limit),
    )


def _prioritize_for_phase(items: list[ReviewItemV2], *, phase: RampupPhase) -> list[ReviewItemV2]:
    source_priority_day_1 = {"re_failed": 0, "manual_add": 1, "wrong_answer": 2, "flagged_persistent": 3}
    source_priority_day_2 = {"re_failed": 0, "manual_add": 1, "wrong_answer": 1, "flagged_persistent": 2}
    source_priority = source_priority_day_1 if phase == RampupPhase.DAY_1 else source_priority_day_2
    return sorted(
        items,
        key=lambda row: (
            source_priority.get(row.source_kind, 9),
            row.next_review_at or get_today_end("Asia/Shanghai"),
            row.updated_at,
            row.id,
        ),
    )


def _today_local(user_tz: str) -> date:
    return get_today_end(user_tz).date()
