from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime


@dataclass(frozen=True)
class PracticeStatFact:
    type: str
    attempt_id: int
    practiced_at: datetime
    category_l1: str
    category_l2: str | None
    difficulty: str
    total_questions: int
    correct_count: int
    graded_count: int
    score_value: float | None
    total_minutes: float


def utc_now_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def difficulty_bucket_from_accuracy(accuracy: float | None) -> str:
    if accuracy is None:
        return "unknown"
    if accuracy >= 0.7:
        return "easy"
    if accuracy >= 0.4:
        return "medium"
    return "hard"


def normalize_category_key(category_l1: str, category_l2: str | None) -> str:
    return f"{category_l1}:{category_l2 or 'uncategorized'}"
