from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeSessionV2
from sikao_api.modules.session_lifecycle.application.transition_support import apply_transition


def cleanup_stale_sessions(session: Session, *, now: datetime | None = None) -> dict[str, int]:
    current_time = now or datetime.now(UTC).replace(tzinfo=None)
    counts = {"paused": 0, "abandoned": 0, "draft_abandoned": 0}
    heartbeat_cutoff = current_time - timedelta(minutes=30)
    abandoned_cutoff = current_time - timedelta(hours=24)
    draft_cutoff = current_time - timedelta(hours=2)
    in_progress_rows = list(
        session.scalars(
            select(PracticeSessionV2).where(
                PracticeSessionV2.status == "in_progress",
                PracticeSessionV2.exam_mode.is_(False),
            )
        )
    )
    for row in in_progress_rows:
        timeout_anchor = _latest_timestamp(
            row.last_heartbeat_at,
            row.last_activity_at,
            row.started_at,
        )
        if timeout_anchor is None or timeout_anchor >= heartbeat_cutoff:
            continue
        timeout_ts = timeout_anchor + timedelta(minutes=30)
        apply_transition(
            session,
            practice_session=row,
            trigger="heartbeat_timeout",
            actor="cron",
            actor_id="session_lifecycle.cleanup",
            request_id=None,
            transition_ts=timeout_ts,
        )
        counts["paused"] += 1

    paused_rows = list(
        session.scalars(
            select(PracticeSessionV2).where(
                PracticeSessionV2.status == "paused",
            )
        )
    )
    for row in paused_rows:
        paused_anchor = _latest_timestamp(
            row.last_heartbeat_at,
            row.paused_at,
            row.last_activity_at,
            row.started_at,
        )
        if paused_anchor is None or paused_anchor >= abandoned_cutoff:
            continue
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
        counts["abandoned"] += 1

    draft_rows = list(
        session.scalars(
            select(PracticeSessionV2).where(
                PracticeSessionV2.status == "draft",
            )
        )
    )
    for row in draft_rows:
        draft_anchor = row.started_at
        if draft_anchor is None or draft_anchor >= draft_cutoff:
            continue
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
        counts["draft_abandoned"] += 1
    session.flush()
    return counts


def expire_daily_sessions(session: Session, *, now: datetime | None = None) -> int:
    current_time = now or datetime.now(UTC).replace(tzinfo=None)
    rows = list(
        session.scalars(
            select(PracticeSessionV2).where(
                PracticeSessionV2.source_mode == "daily",
                PracticeSessionV2.status.in_(("draft", "in_progress", "paused")),
                PracticeSessionV2.expires_at.is_not(None),
                PracticeSessionV2.expires_at <= current_time,
            )
        )
    )
    for row in rows:
        apply_transition(
            session,
            practice_session=row,
            trigger="daily_expire_cron",
            actor="cron",
            actor_id="session_lifecycle.expire_daily",
            request_id=None,
            transition_ts=current_time,
        )
    session.flush()
    return len(rows)


def _latest_timestamp(*values: datetime | None) -> datetime | None:
    present = [value for value in values if value is not None]
    if not present:
        return None
    return max(present)
