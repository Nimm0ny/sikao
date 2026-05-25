from __future__ import annotations

from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from sikao_api.db.enums_v2 import ReviewAttemptOutcome, ReviewItemStatus
from sikao_api.db.models_v2 import ReviewAttemptV2, ReviewItemV2
from sikao_api.modules.review.application.queue_items import record_review_attempt
from sikao_api.modules.review.application.srs_core import get_today_end, utc_now
from sikao_api.modules.review.application.srs_types import AttemptEvent, coerce_int, ensure_metadata


def maybe_mark_hard_from_thresholds(
    session: Session,
    *,
    item: ReviewItemV2,
    trigger_condition: str,
) -> bool:
    metadata = dict(ensure_metadata(item))
    if bool(metadata.get("is_hard", False)):
        return False
    total_wrong_count = _total_wrong_count(session, item_id=item.id)
    metadata["is_hard"] = True
    metadata["hard_marked_at"] = utc_now().isoformat()
    item.metadata_json = metadata
    flag_modified(item, "metadata_json")
    session.add(item)
    record_review_attempt(
        session,
        item_id=item.id,
        outcome=ReviewAttemptOutcome.HARD_MARKED.value,
        notes_json={
            "trigger_condition": trigger_condition,
            "re_fail_count": coerce_int(metadata.get("re_fail_count"), default=0),
            "total_wrong_count": total_wrong_count,
        },
    )
    return True


def detect_hard_trigger(session: Session, *, item: ReviewItemV2) -> str | None:
    metadata = dict(ensure_metadata(item))
    if bool(metadata.get("is_hard", False)):
        return None
    if coerce_int(metadata.get("re_fail_count"), default=0) >= 3:
        return "re_fail_threshold"
    if coerce_int(metadata.get("confidence_mismatch_count"), default=0) >= 2:
        return "confidence_mismatch_threshold"
    total_wrong_count = _total_wrong_count(session, item_id=item.id)
    accuracy = _accuracy_ratio(session, item_id=item.id)
    if total_wrong_count >= 5 and accuracy < 0.3:
        return "total_wrong_accuracy_threshold"
    average_answer_seconds = metadata.get("average_answer_seconds")
    user_average_answer_seconds = metadata.get("user_average_answer_seconds")
    if (
        isinstance(average_answer_seconds, (int, float))
        and isinstance(user_average_answer_seconds, (int, float))
        and user_average_answer_seconds > 0
        and average_answer_seconds > user_average_answer_seconds * 2
        and total_wrong_count >= 2
    ):
        return "average_time_threshold"
    return None


def build_hard_cleared_attempt(
    item: ReviewItemV2,
    *,
    cleared_by: Literal["user_manual", "auto_4_correct_streak"],
    user_tz: str,
) -> AttemptEvent | None:
    metadata = ensure_metadata(item)
    if not bool(metadata.get("is_hard", False)):
        return None
    metadata["is_hard"] = False
    metadata["hard_cleared_at"] = utc_now().isoformat()
    item.metadata_json = metadata
    flag_modified(item, "metadata_json")
    if cleared_by == "user_manual":
        item.correct_streak = 0
        item.status = ReviewItemStatus.PENDING.value
        item.next_review_at = get_today_end(user_tz)
    return AttemptEvent(
        outcome=ReviewAttemptOutcome.HARD_CLEARED.value,
        notes_json={"cleared_by": cleared_by},
    )


def _total_wrong_count(session: Session, *, item_id: int) -> int:
    attempts = list(
        session.scalars(
            select(ReviewAttemptV2.outcome).where(ReviewAttemptV2.review_item_id == item_id)
        )
    )
    return sum(outcome in {"incorrect", "probation_failed"} for outcome in attempts)


def _accuracy_ratio(session: Session, *, item_id: int) -> float:
    attempts = list(
        session.scalars(
            select(ReviewAttemptV2.outcome).where(ReviewAttemptV2.review_item_id == item_id)
        )
    )
    wrong = sum(outcome in {"incorrect", "probation_failed"} for outcome in attempts)
    correct = sum(outcome in {"correct", "graduated"} for outcome in attempts)
    total = wrong + correct
    if total <= 0:
        return 1.0
    return correct / total
