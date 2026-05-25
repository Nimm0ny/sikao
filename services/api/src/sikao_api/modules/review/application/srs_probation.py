from __future__ import annotations

from datetime import timedelta

from sikao_api.db.enums_v2 import ReviewAttemptOutcome, ReviewItemStatus, ReviewSourceKind
from sikao_api.db.models_v2 import ReviewItemV2
from sikao_api.modules.review.application.debt_hard_question import build_hard_cleared_attempt
from sikao_api.modules.review.application.srs_constants import (
    GRADUATION_THRESHOLD,
    PROBATION_DURATION_DAYS,
)
from sikao_api.modules.review.application.srs_core import (
    bump_version,
    ensure_simple_algorithm,
    get_today_end,
    utc_now,
)
from sikao_api.modules.review.application.srs_types import (
    AlreadyProbationaryError,
    AttemptEvent,
    MarkResolvedResult,
    ProbationCheckResult,
    ReFailedPayload,
    SRSStateError,
    coerce_int,
    ensure_metadata,
)


def transition_to_probationary(item: ReviewItemV2, *, user_tz: str) -> None:
    _require_status(item, {ReviewItemStatus.PENDING.value, ReviewItemStatus.IN_PROGRESS.value})
    metadata = ensure_metadata(item)
    probation_check_at = get_today_end(user_tz) + timedelta(days=PROBATION_DURATION_DAYS)
    item.status = ReviewItemStatus.PROBATIONARY.value
    item.next_review_at = probation_check_at
    metadata["probation_started_at"] = utc_now().isoformat()
    metadata["probation_check_at"] = probation_check_at.isoformat()
    metadata["probation_attempts"] = metadata.get("probation_attempts", 0)


def execute_probation_check(
    item: ReviewItemV2,
    *,
    is_correct: bool,
    user_id: int,
    user_tz: str,
) -> ProbationCheckResult:
    del user_tz
    _require_status(item, {ReviewItemStatus.PROBATIONARY.value})
    ensure_simple_algorithm(item)
    metadata = ensure_metadata(item)
    metadata["probation_attempts"] = coerce_int(metadata.get("probation_attempts"), default=0) + 1

    if is_correct:
        item.status = ReviewItemStatus.GRADUATED.value
        item.next_review_at = None
        metadata["graduated_at"] = utc_now().isoformat()
        metadata["probation_passed"] = True
        bump_version(item)
        attempts = [
            AttemptEvent(
                outcome=ReviewAttemptOutcome.GRADUATED.value,
                notes_json={
                    "viaProbation": True,
                    "probationAttempts": metadata["probation_attempts"],
                },
            )
        ]
        hard_cleared = build_hard_cleared_attempt(
            item,
            cleared_by="auto_4_correct_streak",
            user_tz="Asia/Shanghai",
        )
        if hard_cleared is not None:
            attempts.append(hard_cleared)
        return ProbationCheckResult(
            passed=True,
            new_status=item.status,
            next_review_at=item.next_review_at,
            attempts=attempts,
        )

    item.next_review_at = None
    metadata["probation_failed_at"] = utc_now().isoformat()
    payload = ReFailedPayload(
        question_id=item.question_id,
        source_kind=ReviewSourceKind.RE_FAILED.value,
        status=ReviewItemStatus.PENDING.value,
        correct_streak=0,
        title=item.title,
        metadata_json={
            "originalReviewItemId": item.id,
            "fromProbationCheck": True,
            "firstSeenAt": utc_now().isoformat(),
            "sourceUserId": user_id,
        },
    )
    bump_version(item)
    return ProbationCheckResult(
        passed=False,
        new_status=item.status,
        next_review_at=item.next_review_at,
        attempts=[
            AttemptEvent(
                outcome=ReviewAttemptOutcome.PROBATION_FAILED.value,
                notes_json={
                    "probationAttempts": metadata["probation_attempts"],
                },
            )
        ],
        re_failed_payload=payload,
    )


def mark_resolved(item: ReviewItemV2, *, user_tz: str) -> MarkResolvedResult:
    ensure_simple_algorithm(item)
    if item.status == ReviewItemStatus.PROBATIONARY.value:
        raise AlreadyProbationaryError("review item already probationary")
    _require_status(item, {ReviewItemStatus.PENDING.value, ReviewItemStatus.IN_PROGRESS.value})
    metadata = ensure_metadata(item)
    metadata["mark_resolved_skipped_streak"] = item.correct_streak
    item.correct_streak = GRADUATION_THRESHOLD
    transition_to_probationary(item, user_tz=user_tz)
    bump_version(item)
    return MarkResolvedResult(
        new_status=item.status,
        new_streak=item.correct_streak,
        next_review_at=item.next_review_at,
        attempts=[
            AttemptEvent(
                outcome=ReviewAttemptOutcome.MARK_RESOLVED.value,
                notes_json={"skippedStreakToThreshold": True},
            )
        ],
    )


def _require_status(item: ReviewItemV2, statuses: set[str]) -> None:
    if item.status not in statuses:
        raise SRSStateError(f"invalid review item status for SRS operation: {item.status}")
