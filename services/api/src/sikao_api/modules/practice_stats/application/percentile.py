from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal, cast

from sqlalchemy import select

from sikao_api.db.models_v2 import PracticeStatsSnapshotV2
from sikao_api.modules.practice_stats.interface.schemas import PracticeStatsPercentileResponseV2


def build_stats_percentile(session, *, user, type_name: str, category: str | None) -> PracticeStatsPercentileResponseV2:
    scope = "overall" if category is None else "category_l2" if ":" in category else "category_l1"
    row = session.scalar(
        select(PracticeStatsSnapshotV2).where(
            PracticeStatsSnapshotV2.user_id == user.id,
            PracticeStatsSnapshotV2.type == type_name,
            PracticeStatsSnapshotV2.scope == scope,
            PracticeStatsSnapshotV2.category_key == category,
        )
    )
    if row is None or row.total_questions <= 0:
        return PracticeStatsPercentileResponseV2(
            type=cast(Literal["xingce", "essay"], type_name),
            category=category,
        )
    if row.percentile_rank is not None:
        return PracticeStatsPercentileResponseV2(
            type=cast(Literal["xingce", "essay"], type_name),
            category=category,
            percentile_rank=row.percentile_rank,
            percentile_updated_at=row.percentile_updated_at,
        )
    peers = list(
        session.scalars(
            select(PracticeStatsSnapshotV2.accuracy).where(
                PracticeStatsSnapshotV2.type == type_name,
                PracticeStatsSnapshotV2.scope == scope,
                PracticeStatsSnapshotV2.category_key == category,
                PracticeStatsSnapshotV2.total_questions > 0,
            )
        )
    )
    if not peers:
        return PracticeStatsPercentileResponseV2(
            type=cast(Literal["xingce", "essay"], type_name),
            category=category,
        )
    rank = sum(1 for value in peers if value <= row.accuracy) / len(peers)
    return PracticeStatsPercentileResponseV2(
        type=cast(Literal["xingce", "essay"], type_name),
        category=category,
        percentile_rank=round(rank, 4),
        percentile_updated_at=datetime.now(UTC).replace(tzinfo=None),
    )
