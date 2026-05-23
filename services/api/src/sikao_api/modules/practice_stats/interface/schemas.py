from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import Field

from sikao_api.core.schemas import CamelModel, UtcDatetime


PracticeTypeV2 = Literal["xingce", "essay"]
PeriodV2 = Literal["7d", "30d", "90d"]
DifficultyBucketV2 = Literal["easy", "medium", "hard", "unknown"]


class PracticeStatsTrendPointV2(CamelModel):
    date: date
    session_id: int
    accuracy: float
    count: int
    average_score: float | None = None


class PracticeStatsCellV2(CamelModel):
    category_key: str | None = None
    label: str
    total_questions: int
    correct_count: int
    accuracy: float
    total_sessions: int
    total_minutes: int
    recent_trend: list[PracticeStatsTrendPointV2] = Field(default_factory=list)
    percentile_rank: float | None = None
    last_practiced_at: UtcDatetime | None = None
    average_score: float | None = None


class PracticeStatsResponseV2(CamelModel):
    type: PracticeTypeV2
    overall: PracticeStatsCellV2
    by_category_l1: list[PracticeStatsCellV2] = Field(default_factory=list)
    by_category_l2: list[PracticeStatsCellV2] = Field(default_factory=list)


class PracticeStatsTrendResponseV2(CamelModel):
    type: PracticeTypeV2
    category: str | None = None
    period: PeriodV2
    points: list[PracticeStatsTrendPointV2] = Field(default_factory=list)


class PracticeStatsPercentileResponseV2(CamelModel):
    type: PracticeTypeV2
    category: str | None = None
    percentile_rank: float | None = None
    percentile_updated_at: UtcDatetime | None = None


class PracticeStatsCrossItemV2(CamelModel):
    category_key: str
    label: str
    difficulty: DifficultyBucketV2
    total_questions: int
    correct_count: int
    accuracy: float
    total_sessions: int
    total_minutes: int
    average_score: float | None = None


class PracticeStatsCrossResponseV2(CamelModel):
    type: PracticeTypeV2
    category: str | None = None
    items: list[PracticeStatsCrossItemV2] = Field(default_factory=list)
