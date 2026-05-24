from __future__ import annotations

from sikao_api.db.models_v2 import ReviewItemV2
from sikao_api.modules.review.application.srs_core import (
    advance_on_correct as _advance_on_correct,
    bump_version,
    compute_next_review,
    ensure_simple_algorithm,
    get_today_end,
    is_due_today,
    regress_on_incorrect,
    utc_now,
)
from sikao_api.modules.review.application.srs_probation import (
    execute_probation_check,
    mark_resolved,
    transition_to_probationary,
)
from sikao_api.modules.review.application.srs_types import (
    AlreadyProbationaryError,
    AttemptEvent,
    MarkResolvedResult,
    ProbationCheckResult,
    ReFailedPayload,
    SRSAdvanceResult,
    SRSRegressResult,
    SRSStateError,
)
from sikao_api.modules.review.application.srs_constants import ConfidenceLevel


__all__ = [
    "AlreadyProbationaryError",
    "AttemptEvent",
    "MarkResolvedResult",
    "ProbationCheckResult",
    "ReFailedPayload",
    "SRSAdvanceResult",
    "SRSRegressResult",
    "SRSStateError",
    "advance_on_correct",
    "bump_version",
    "compute_next_review",
    "ensure_simple_algorithm",
    "execute_probation_check",
    "get_today_end",
    "is_due_today",
    "mark_resolved",
    "regress_on_incorrect",
    "transition_to_probationary",
    "utc_now",
]


def advance_on_correct(
    item: ReviewItemV2,
    *,
    confidence: ConfidenceLevel | None,
    used_recall: bool,
    user_tz: str,
) -> SRSAdvanceResult:
    return _advance_on_correct(
        item,
        confidence=confidence,
        used_recall=used_recall,
        user_tz=user_tz,
        transition_to_probationary=transition_to_probationary,
    )
