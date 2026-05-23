from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeStatsSnapshotV2


@dataclass(frozen=True)
class CategoryWeight:
    category_l1: str
    weight: float


def load_category_weights(
    session: Session,
    *,
    user_id: int,
    type_name: str,
) -> list[CategoryWeight]:
    rows = list(
        session.scalars(
            select(PracticeStatsSnapshotV2)
            .where(
                PracticeStatsSnapshotV2.user_id == user_id,
                PracticeStatsSnapshotV2.type == type_name,
                PracticeStatsSnapshotV2.scope == "category_l1",
            )
            .order_by(PracticeStatsSnapshotV2.category_key.asc())
        )
    )
    return [
        CategoryWeight(
            category_l1=row.category_key or "",
            weight=max(0.2, round(1.05 - row.accuracy, 4)),
        )
        for row in rows
        if row.category_key
    ]

