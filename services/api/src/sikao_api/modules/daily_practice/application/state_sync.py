from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import DailyPracticeV2, PracticeSessionV2


def sync_daily_completion(
    session: Session,
    *,
    practice_session: PracticeSessionV2,
) -> None:
    if practice_session.source_mode != "daily":
        return
    daily_id = practice_session.config_snapshot.get("daily_practice_id")
    if not isinstance(daily_id, int):
        return
    row = session.scalar(select(DailyPracticeV2).where(DailyPracticeV2.id == daily_id))
    if row is None:
        return
    row.status = "completed"
    row.completed_session_id = practice_session.id
    if row.started_at is None:
        row.started_at = practice_session.started_at
    session.add(row)

