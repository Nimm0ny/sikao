from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import DailyPracticeV2, PracticeSessionV2
from sikao_api.modules.session_lifecycle.application.transition_support import apply_transition
from sikao_api.modules.system.application.errors import ConflictError


def cleanup_stale_sessions(session: Session, *, now: datetime | None = None) -> dict[str, int]:
    current_time = now or datetime.now(UTC).replace(tzinfo=None)
    counts = {"paused": 0, "abandoned": 0, "draft_abandoned": 0}
    heartbeat_cutoff = current_time - timedelta(minutes=30)
    abandoned_cutoff = current_time - timedelta(hours=24)
    draft_cutoff = current_time - timedelta(hours=2)
    in_progress_ids = list(
        session.scalars(
            select(PracticeSessionV2.id).where(
                PracticeSessionV2.status == "in_progress",
                PracticeSessionV2.exam_mode.is_(False),
            )
        )
    )
    for session_id in in_progress_ids:
        row = _lock_session(session, session_id=session_id)
        if row is None:
            continue
        timeout_anchor = _latest_timestamp(
            row.last_heartbeat_at,
            row.last_activity_at,
            row.started_at,
        )
        if timeout_anchor is None or timeout_anchor >= heartbeat_cutoff:
            continue
        timeout_ts = timeout_anchor + timedelta(minutes=30)
        try:
            apply_transition(
                session,
                practice_session=row,
                trigger="heartbeat_timeout",
                actor="cron",
                actor_id="session_lifecycle.cleanup",
                request_id=None,
                transition_ts=timeout_ts,
            )
        except ConflictError:
            continue
        counts["paused"] += 1

    paused_ids = list(
        session.scalars(
            select(PracticeSessionV2.id).where(
                PracticeSessionV2.status == "paused",
            )
        )
    )
    for session_id in paused_ids:
        row = _lock_session(session, session_id=session_id)
        if row is None:
            continue
        paused_anchor = _latest_timestamp(
            row.last_heartbeat_at,
            row.paused_at,
            row.last_activity_at,
            row.started_at,
        )
        if paused_anchor is None or paused_anchor >= abandoned_cutoff:
            continue
        try:
            apply_transition(
                session,
                practice_session=row,
                trigger="no_activity_24h",
                actor="cron",
                actor_id="session_lifecycle.cleanup",
                request_id=None,
                reason="no_activity_24h",
                transition_ts=current_time,
            )
        except ConflictError:
            continue
        counts["abandoned"] += 1

    draft_ids = list(
        session.scalars(
            select(PracticeSessionV2.id).where(
                PracticeSessionV2.status == "draft",
            )
        )
    )
    for session_id in draft_ids:
        row = _lock_session(session, session_id=session_id)
        if row is None:
            continue
        if row.source_mode == "daily" and row.expires_at is not None:
            continue
        draft_anchor = row.started_at
        if draft_anchor is None or draft_anchor >= draft_cutoff:
            continue
        try:
            apply_transition(
                session,
                practice_session=row,
                trigger="no_activity_draft_2h",
                actor="cron",
                actor_id="session_lifecycle.cleanup",
                request_id=None,
                reason="no_activity_draft_2h",
                transition_ts=current_time,
            )
        except ConflictError:
            continue
        counts["draft_abandoned"] += 1
    session.flush()
    return counts


def expire_daily_sessions(session: Session, *, now: datetime | None = None) -> int:
    current_time = now or datetime.now(UTC).replace(tzinfo=None)
    session_ids = list(
        session.scalars(
            select(PracticeSessionV2.id).where(
                PracticeSessionV2.source_mode == "daily",
                PracticeSessionV2.status.in_(("draft", "in_progress", "paused")),
                PracticeSessionV2.expires_at.is_not(None),
                PracticeSessionV2.expires_at <= current_time,
            )
        )
    )
    expired = 0
    for session_id in session_ids:
        row = _lock_session(session, session_id=session_id)
        if row is None or row.expires_at is None or row.expires_at > current_time:
            continue
        daily_id = row.config_snapshot.get("daily_practice_id") if isinstance(row.config_snapshot, dict) else None
        try:
            apply_transition(
                session,
                practice_session=row,
                trigger="daily_expire_cron",
                actor="cron",
                actor_id="session_lifecycle.expire_daily",
                request_id=None,
                transition_ts=current_time,
            )
        except ConflictError:
            continue
        if isinstance(daily_id, int):
            daily = session.get(DailyPracticeV2, daily_id)
            if daily is not None:
                daily.status = "expired"
                session.add(daily)
        expired += 1
    session.flush()
    return expired


def _latest_timestamp(*values: datetime | None) -> datetime | None:
    present = [value for value in values if value is not None]
    if not present:
        return None
    return max(present)


def _lock_session(session: Session, *, session_id: int) -> PracticeSessionV2 | None:
    return session.scalar(
        select(PracticeSessionV2)
        .where(PracticeSessionV2.id == session_id)
        .with_for_update()
    )
