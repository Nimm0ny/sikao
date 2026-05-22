from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session
from typing import Literal, cast

from sikao_api.db.models_v2 import PracticeStatsSnapshotV2, UserV2
from sikao_api.modules.practice_stats.application.cells import build_stats_response
from sikao_api.modules.practice_stats.application.loaders import load_practice_facts
from sikao_api.modules.practice_stats.application.snapshot_writer import recompute_user_stats
from sikao_api.modules.practice_stats.interface.schemas import (
    PracticeStatsCellV2,
    PracticeStatsResponseV2,
    PracticeStatsTrendPointV2,
)


def build_snapshot_stats(session: Session, *, user: UserV2, type_name: str) -> PracticeStatsResponseV2:
    rows = list(
        session.scalars(
            select(PracticeStatsSnapshotV2)
            .where(PracticeStatsSnapshotV2.user_id == user.id, PracticeStatsSnapshotV2.type == type_name)
            .order_by(PracticeStatsSnapshotV2.scope.asc(), PracticeStatsSnapshotV2.category_key.asc())
        )
    )
    if not rows:
        recompute_user_stats(session, user_id=user.id)
        rows = list(
            session.scalars(
                select(PracticeStatsSnapshotV2)
                .where(PracticeStatsSnapshotV2.user_id == user.id, PracticeStatsSnapshotV2.type == type_name)
                .order_by(PracticeStatsSnapshotV2.scope.asc(), PracticeStatsSnapshotV2.category_key.asc())
            )
        )
        session.commit()
    if not rows:
        return build_stats_response(type_name=type_name, facts=load_practice_facts(session, user_id=user.id, type_name=type_name))
    return PracticeStatsResponseV2(
        type=cast(Literal["xingce", "essay"], type_name),
        overall=_to_cell(next((row for row in rows if row.scope == "overall"), None), "overall"),
        by_category_l1=[_to_cell(row, row.category_key or "") for row in rows if row.scope == "category_l1"],
        by_category_l2=[_to_cell(row, (row.category_key or "").split(":", 1)[-1]) for row in rows if row.scope == "category_l2"],
    )


def _to_cell(row: PracticeStatsSnapshotV2 | None, label: str) -> PracticeStatsCellV2:
    if row is None:
        return PracticeStatsCellV2(label=label, total_questions=0, correct_count=0, accuracy=0.0, total_sessions=0, total_minutes=0)
    return PracticeStatsCellV2(
        category_key=row.category_key,
        label=label,
        total_questions=row.total_questions,
        correct_count=row.correct_count,
        accuracy=row.accuracy,
        total_sessions=row.total_sessions,
        total_minutes=row.total_minutes,
        recent_trend=[PracticeStatsTrendPointV2.model_validate(point) for point in row.recent_trend],
        percentile_rank=row.percentile_rank,
        last_practiced_at=row.last_practiced_at,
        average_score=row.average_score,
    )
