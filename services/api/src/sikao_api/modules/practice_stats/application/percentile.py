from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal, cast

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeStatsSnapshotV2, UserV2
from sikao_api.modules.practice_stats.application.snapshot_writer import refresh_percentile_buckets
from sikao_api.modules.practice_stats.application.snapshot_writer import recompute_user_stats
from sikao_api.modules.practice_stats.interface.schemas import PracticeStatsPercentileResponseV2


def build_stats_percentile(
    session: Session,
    *,
    user: UserV2,
    type_name: str,
    category: str | None,
) -> PracticeStatsPercentileResponseV2:
    scope = "overall" if category is None else "category_l2" if ":" in category else "category_l1"
    row = _load_snapshot_row(
        session,
        user_id=user.id,
        type_name=type_name,
        scope=scope,
        category=category,
    )
    if row is None:
        recompute_user_stats(session, user_id=user.id)
        session.commit()
        row = _load_snapshot_row(
            session,
            user_id=user.id,
            type_name=type_name,
            scope=scope,
            category=category,
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
    refresh_percentile_buckets(
        session,
        bucket_keys={(type_name, scope, category)},
    )
    session.commit()
    row = _load_snapshot_row(
        session,
        user_id=user.id,
        type_name=type_name,
        scope=scope,
        category=category,
    )
    if row is None or row.percentile_rank is None or row.percentile_updated_at is None:
        rank = sum(1 for value in peers if value <= (row.accuracy if row is not None else 0.0)) / len(peers)
        updated_at = datetime.now(UTC).replace(tzinfo=None)
        return PracticeStatsPercentileResponseV2(
            type=cast(Literal["xingce", "essay"], type_name),
            category=category,
            percentile_rank=round(rank, 4),
            percentile_updated_at=updated_at,
        )
    return PracticeStatsPercentileResponseV2(
        type=cast(Literal["xingce", "essay"], type_name),
        category=category,
        percentile_rank=row.percentile_rank,
        percentile_updated_at=row.percentile_updated_at,
    )


def _load_snapshot_row(
    session: Session,
    *,
    user_id: int,
    type_name: str,
    scope: str,
    category: str | None,
) -> PracticeStatsSnapshotV2 | None:
    return cast(
        PracticeStatsSnapshotV2 | None,
        session.scalar(
        select(PracticeStatsSnapshotV2).where(
            PracticeStatsSnapshotV2.user_id == user_id,
            PracticeStatsSnapshotV2.type == type_name,
            PracticeStatsSnapshotV2.scope == scope,
            PracticeStatsSnapshotV2.category_key == category,
        )
    ),
    )
