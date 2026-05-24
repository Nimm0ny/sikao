from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from sikao_api.db.models_v2 import ReviewItemV2


class SRSStateError(ValueError):
    pass


class AlreadyProbationaryError(SRSStateError):
    pass


@dataclass(frozen=True)
class AttemptEvent:
    outcome: str
    notes_json: dict[str, object]


@dataclass(frozen=True)
class SRSAdvanceResult:
    new_status: str
    new_streak: int
    next_review_at: datetime | None
    graduated: bool
    probationary: bool
    advance_skipped: bool = False
    early_graduated: bool = False
    attempts: list[AttemptEvent] = field(default_factory=list)


@dataclass(frozen=True)
class SRSRegressResult:
    new_status: str
    new_streak: int
    next_review_at: datetime | None
    confidence_mismatch: bool
    is_hard_now: bool
    attempts: list[AttemptEvent] = field(default_factory=list)


@dataclass(frozen=True)
class MarkResolvedResult:
    new_status: str
    new_streak: int
    next_review_at: datetime | None
    attempts: list[AttemptEvent] = field(default_factory=list)


@dataclass(frozen=True)
class ReFailedPayload:
    question_id: int | None
    source_kind: str
    status: str
    correct_streak: int
    title: str
    metadata_json: dict[str, object]


@dataclass(frozen=True)
class ProbationCheckResult:
    passed: bool
    new_status: str
    next_review_at: datetime | None
    attempts: list[AttemptEvent] = field(default_factory=list)
    re_failed_payload: ReFailedPayload | None = None


def ensure_metadata(item: ReviewItemV2) -> dict[str, object]:
    if not isinstance(item.metadata_json, dict):
        item.metadata_json = {}
    return item.metadata_json


def coerce_int(value: object, *, default: int) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            return default
    return default
