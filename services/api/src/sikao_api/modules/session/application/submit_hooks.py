from __future__ import annotations

from sqlalchemy.orm import Session

from sikao_api.modules.practice_stats.application.snapshot_writer import incremental_update, recompute_user_stats
from sikao_api.modules.progress.application.snapshot_writer import (
    refresh_daily_progress_snapshot,
    refresh_weekly_weakness_snapshot,
)


def run_progress_submit_hooks(session: Session, *, user_id: int, session_id: int | None = None) -> None:
    if session_id is None:
        recompute_user_stats(session, user_id=user_id)
    else:
        incremental_update(session, user_id=user_id, session_id=session_id)
    refresh_daily_progress_snapshot(session, user_id=user_id)
    refresh_weekly_weakness_snapshot(session, user_id=user_id)
