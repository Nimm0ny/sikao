from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Callable
from zoneinfo import ZoneInfo

from sikao_api.db.enums_v2 import ReviewAttemptOutcome, ReviewItemStatus
from sikao_api.db.models_v2 import ReviewItemV2
from sikao_api.modules.review.application.confidence import (
    compute_confidence_recall_multiplier,
    is_certain_with_recall_early_graduate,
    is_unsure_blocking_graduation,
)
from sikao_api.modules.review.application.srs_constants import (
    ALGORITHM_VERSION_SIMPLE,
    DEFAULT_TIMEZONE,
    GRADUATION_THRESHOLD,
    INTERVALS,
    ConfidenceLevel,
)
from sikao_api.modules.review.application.srs_types import (
    AttemptEvent,
    SRSAdvanceResult,
    SRSRegressResult,
    SRSStateError,
    coerce_int,
    ensure_metadata,
)


def utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def get_today_end(user_timezone: str | None) -> datetime:
    tz = ZoneInfo(user_timezone or DEFAULT_TIMEZONE)
    now_local = datetime.now(tz)
    return now_local.replace(hour=23, minute=59, second=59, microsecond=0).astimezone(UTC).replace(tzinfo=None)


def ensure_simple_algorithm(item: ReviewItemV2) -> None:
    algorithm_version = ensure_metadata(item).get("algorithm_version", ALGORITHM_VERSION_SIMPLE)
    if algorithm_version != ALGORITHM_VERSION_SIMPLE:
        raise SRSStateError(f"unsupported algorithm_version: {algorithm_version}")


def bump_version(item: ReviewItemV2) -> None:
    current = int(item.version or 1)
    if current < 1:
        current = 1
    item.version = current + 1


def compute_next_review(
    streak_after: int,
    *,
    confidence: ConfidenceLevel | None,
    used_recall: bool,
    is_hard: bool,
    user_tz: str,
) -> datetime:
    if streak_after >= GRADUATION_THRESHOLD:
        raise ValueError("streak_after >= GRADUATION_THRESHOLD; use transition_to_probationary")
    effective_confidence: ConfidenceLevel = confidence or "likely"
    base_interval = INTERVALS[min(streak_after, len(INTERVALS) - 1)]
    multiplier = compute_confidence_recall_multiplier(effective_confidence, used_recall)
    if is_hard:
        multiplier = min(1.0, multiplier)
    final_interval = max(1, int(base_interval * multiplier))
    return get_today_end(user_tz) + timedelta(days=final_interval)


def is_due_today(
    item: ReviewItemV2,
    *,
    user_tz: str,
    respect_debt: bool = True,
) -> bool:
    if item.status not in {
        ReviewItemStatus.PENDING.value,
        ReviewItemStatus.IN_PROGRESS.value,
        ReviewItemStatus.PROBATIONARY.value,
    }:
        return False
    metadata = ensure_metadata(item)
    if respect_debt and metadata.get("debt_status") == "ramp_up_protected":
        return False
    if item.next_review_at is None:
        return False
    return item.next_review_at <= get_today_end(user_tz)


def advance_on_correct(
    item: ReviewItemV2,
    *,
    confidence: ConfidenceLevel | None,
    used_recall: bool,
    user_tz: str,
    transition_to_probationary: Callable[..., None],
) -> SRSAdvanceResult:
    _require_status(item, {ReviewItemStatus.PENDING.value, ReviewItemStatus.IN_PROGRESS.value})
    ensure_simple_algorithm(item)
    metadata = ensure_metadata(item)
    effective_confidence: ConfidenceLevel = confidence or "likely"
    _record_confidence_skip(metadata, confidence=confidence)
    if item.status == ReviewItemStatus.PENDING.value:
        item.status = ReviewItemStatus.IN_PROGRESS.value

    if effective_confidence == "guess":
        item.next_review_at = compute_next_review(
            streak_after=item.correct_streak,
            confidence="guess",
            used_recall=False,
            is_hard=bool(metadata.get("is_hard", False)),
            user_tz=user_tz,
        )
        metadata["last_confidence"] = "guess"
        metadata["last_reviewed_at"] = utc_now().isoformat()
        bump_version(item)
        return SRSAdvanceResult(
            new_status=item.status,
            new_streak=item.correct_streak,
            next_review_at=item.next_review_at,
            graduated=False,
            probationary=False,
            advance_skipped=True,
            attempts=[
                AttemptEvent(
                    outcome=ReviewAttemptOutcome.CORRECT.value,
                    notes_json={
                        "beforeStreak": item.correct_streak,
                        "afterStreak": item.correct_streak,
                        "confidence": "guess",
                        "advanceSkippedDueToGuess": True,
                        "intervalMultiplierApplied": 1.0,
                    },
                )
            ],
        )

    before_streak = item.correct_streak
    item.correct_streak += 1
    metadata["last_confidence"] = effective_confidence
    metadata["last_reviewed_at"] = utc_now().isoformat()

    if is_unsure_blocking_graduation(streak_after=item.correct_streak, confidence=effective_confidence):
        item.correct_streak = GRADUATION_THRESHOLD - 1
        metadata["unsure_blocked_graduation"] = True
        item.next_review_at = compute_next_review(
            streak_after=item.correct_streak,
            confidence=effective_confidence,
            used_recall=used_recall,
            is_hard=bool(metadata.get("is_hard", False)),
            user_tz=user_tz,
        )
        bump_version(item)
        return SRSAdvanceResult(
            new_status=item.status,
            new_streak=item.correct_streak,
            next_review_at=item.next_review_at,
            graduated=False,
            probationary=False,
            attempts=[
                AttemptEvent(
                    outcome=ReviewAttemptOutcome.CORRECT.value,
                    notes_json={
                        "beforeStreak": before_streak,
                        "afterStreak": item.correct_streak,
                        "confidence": "unsure",
                        "unsureBlockedGraduation": True,
                    },
                )
            ],
        )

    if is_certain_with_recall_early_graduate(
        streak_after=item.correct_streak,
        confidence=effective_confidence,
        used_recall=used_recall,
    ) and not bool(metadata.get("is_hard", False)):
        transition_to_probationary(item, user_tz=user_tz)
        metadata["early_graduated"] = True
        bump_version(item)
        return SRSAdvanceResult(
            new_status=item.status,
            new_streak=item.correct_streak,
            next_review_at=item.next_review_at,
            graduated=False,
            probationary=True,
            early_graduated=True,
            attempts=[
                AttemptEvent(
                    outcome=ReviewAttemptOutcome.PROBATION_ENTERED.value,
                    notes_json={
                        "beforeStreak": before_streak,
                        "afterStreak": item.correct_streak,
                        "confidence": effective_confidence,
                        "usedRecall": True,
                        "earlyGraduated": True,
                    },
                )
            ],
        )

    if item.correct_streak >= GRADUATION_THRESHOLD:
        transition_to_probationary(item, user_tz=user_tz)
        bump_version(item)
        return SRSAdvanceResult(
            new_status=item.status,
            new_streak=item.correct_streak,
            next_review_at=item.next_review_at,
            graduated=False,
            probationary=True,
            attempts=[
                AttemptEvent(
                    outcome=ReviewAttemptOutcome.PROBATION_ENTERED.value,
                    notes_json={
                        "beforeStreak": before_streak,
                        "afterStreak": item.correct_streak,
                        "confidence": effective_confidence,
                        "usedRecall": used_recall,
                    },
                )
            ],
        )

    item.next_review_at = compute_next_review(
        streak_after=item.correct_streak,
        confidence=effective_confidence,
        used_recall=used_recall,
        is_hard=bool(metadata.get("is_hard", False)),
        user_tz=user_tz,
    )
    multiplier = compute_confidence_recall_multiplier(effective_confidence, used_recall)
    bump_version(item)
    return SRSAdvanceResult(
        new_status=item.status,
        new_streak=item.correct_streak,
        next_review_at=item.next_review_at,
        graduated=False,
        probationary=False,
        attempts=[
            AttemptEvent(
                outcome=ReviewAttemptOutcome.CORRECT.value,
                notes_json={
                    "beforeStreak": before_streak,
                    "afterStreak": item.correct_streak,
                    "confidence": effective_confidence,
                    "usedRecall": used_recall,
                    "intervalMultiplierApplied": multiplier,
                },
            )
        ],
    )


def regress_on_incorrect(
    item: ReviewItemV2,
    *,
    confidence: ConfidenceLevel | None,
    user_tz: str,
) -> SRSRegressResult:
    _require_status(item, {ReviewItemStatus.PENDING.value, ReviewItemStatus.IN_PROGRESS.value})
    ensure_simple_algorithm(item)
    metadata = ensure_metadata(item)
    effective_confidence: ConfidenceLevel = confidence or "likely"
    _record_confidence_skip(metadata, confidence=confidence)
    before_streak = item.correct_streak
    if item.correct_streak > 0:
        item.correct_streak -= 1
    if item.status == ReviewItemStatus.PENDING.value:
        item.status = ReviewItemStatus.IN_PROGRESS.value

    confidence_mismatch = effective_confidence == "certain"
    attempt_events: list[AttemptEvent] = []
    if confidence_mismatch:
        mismatch_count = coerce_int(metadata.get("confidence_mismatch_count"), default=0) + 1
        metadata["confidence_mismatch_count"] = mismatch_count
        metadata["forced_cause_analysis_pending"] = True
        metadata["forced_reason"] = "confidence_mismatch"
        if mismatch_count >= 2 and not bool(metadata.get("is_hard", False)):
            metadata["is_hard"] = True
            metadata["hard_marked_at"] = utc_now().isoformat()
            attempt_events.append(
                AttemptEvent(
                    outcome=ReviewAttemptOutcome.HARD_MARKED.value,
                    notes_json={
                        "triggerCondition": "confidence_mismatch_threshold",
                        "mismatchCount": mismatch_count,
                    },
                )
            )
        attempt_events.append(
            AttemptEvent(
                outcome=ReviewAttemptOutcome.CONFIDENCE_MISMATCH.value,
                notes_json={
                    "confidence": "certain",
                    "isCorrect": False,
                    "mismatchCount": mismatch_count,
                },
            )
        )

    item.next_review_at = compute_next_review(
        streak_after=item.correct_streak,
        confidence=effective_confidence,
        used_recall=False,
        is_hard=bool(metadata.get("is_hard", False)),
        user_tz=user_tz,
    )
    metadata["last_confidence"] = effective_confidence
    metadata["last_reviewed_at"] = utc_now().isoformat()
    attempt_events.append(
        AttemptEvent(
            outcome=ReviewAttemptOutcome.INCORRECT.value,
            notes_json={
                "beforeStreak": before_streak,
                "afterStreak": item.correct_streak,
                "confidence": effective_confidence,
                "confidenceMismatch": confidence_mismatch,
            },
        )
    )
    bump_version(item)
    return SRSRegressResult(
        new_status=item.status,
        new_streak=item.correct_streak,
        next_review_at=item.next_review_at,
        confidence_mismatch=confidence_mismatch,
        is_hard_now=bool(metadata.get("is_hard", False)),
        attempts=attempt_events,
    )


def _require_status(item: ReviewItemV2, statuses: set[str]) -> None:
    if item.status not in statuses:
        raise SRSStateError(f"invalid review item status for SRS operation: {item.status}")


def _record_confidence_skip(
    metadata: dict[str, object],
    *,
    confidence: ConfidenceLevel | None,
) -> None:
    if confidence is None:
        metadata["confidence_skipped_count"] = coerce_int(
            metadata.get("confidence_skipped_count"),
            default=0,
        ) + 1
