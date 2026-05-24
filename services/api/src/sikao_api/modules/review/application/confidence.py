from __future__ import annotations

from sikao_api.modules.review.application.srs_constants import (
    CONFIDENCE_RECALL_MULTIPLIER,
    GRADUATION_THRESHOLD,
    ConfidenceLevel,
)


def compute_confidence_recall_multiplier(
    confidence: ConfidenceLevel,
    used_recall: bool,
) -> float:
    return CONFIDENCE_RECALL_MULTIPLIER[(confidence, used_recall)]


def is_unsure_blocking_graduation(*, streak_after: int, confidence: ConfidenceLevel) -> bool:
    return confidence == "unsure" and streak_after >= GRADUATION_THRESHOLD


def is_certain_with_recall_early_graduate(
    *,
    streak_after: int,
    confidence: ConfidenceLevel,
    used_recall: bool,
) -> bool:
    return (
        confidence == "certain"
        and used_recall
        and streak_after >= GRADUATION_THRESHOLD - 1
    )
