from __future__ import annotations

from sqlalchemy.orm import Session

from sikao_api.modules.progress.application.snapshot_writer import (
    refresh_daily_progress_snapshot,
    refresh_weekly_weakness_snapshot,
)


def run_progress_submit_hooks(session: Session, *, user_id: int) -> None:
    refresh_daily_progress_snapshot(session, user_id=user_id)
    refresh_weekly_weakness_snapshot(session, user_id=user_id)
