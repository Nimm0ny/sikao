from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import ProgressSnapshotV2, WeaknessSnapshotV2
from sikao_api.modules.progress.application.aggregates import today_cn
from sikao_api.modules.progress.application.snapshot_store import write_progress_snapshot, write_weekly_weakness_snapshot


def refresh_daily_progress_snapshot(
    session: Session,
    *,
    user_id: int,
    snapshot_date: date | None = None,
) -> ProgressSnapshotV2:
    target_date = snapshot_date or today_cn()
    return write_progress_snapshot(session, user_id=user_id, snapshot_date=target_date)


def refresh_weekly_weakness_snapshot(
    session: Session,
    *,
    user_id: int,
    anchor_date: date | None = None,
) -> list[WeaknessSnapshotV2]:
    target_anchor = anchor_date or today_cn()
    return write_weekly_weakness_snapshot(session, user_id=user_id, anchor_date=target_anchor)


def refresh_progress_artifacts_for_user(session: Session, *, user_id: int) -> None:
    refresh_daily_progress_snapshot(session, user_id=user_id)
    refresh_weekly_weakness_snapshot(session, user_id=user_id)
