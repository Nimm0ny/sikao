from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from sikao_api.db.models_v2 import ReviewItemV2
from sikao_api.modules.review.application.srs_engine import (
    AlreadyProbationaryError,
    advance_on_correct,
    execute_probation_check,
    is_due_today,
    mark_resolved,
    regress_on_incorrect,
)


def _item(
    *,
    status: str = "pending",
    streak: int = 0,
    version: int = 1,
    next_review_at: datetime | None = None,
    metadata: dict[str, object] | None = None,
) -> ReviewItemV2:
    return ReviewItemV2(
        user_id=1,
        source_kind="wrong_answer",
        source_id=101,
        title="review item",
        status=status,
        question_id=11,
        metadata_json=metadata or {},
        correct_streak=streak,
        next_review_at=next_review_at,
        version=version,
        reason="wrong_answer",
    )


def test_srs_likely_correct_advances_pending_to_in_progress() -> None:
    item = _item(status="pending", streak=0)
    result = advance_on_correct(item, confidence="likely", used_recall=False, user_tz="Asia/Shanghai")
    assert result.new_status == "in_progress"
    assert result.new_streak == 1
    assert result.next_review_at is not None
    assert item.version == 2


def test_srs_guess_correct_does_not_increment_streak() -> None:
    item = _item(status="pending", streak=0)
    result = advance_on_correct(item, confidence="guess", used_recall=False, user_tz="Asia/Shanghai")
    assert result.advance_skipped is True
    assert result.new_streak == 0
    assert result.new_status == "in_progress"
    assert result.attempts[0].outcome == "correct"


def test_srs_standard_graduation_enters_probationary() -> None:
    item = _item(status="in_progress", streak=3)
    result = advance_on_correct(item, confidence="likely", used_recall=False, user_tz="Asia/Shanghai")
    assert result.probationary is True
    assert result.new_status == "probationary"
    assert result.new_streak == 4
    assert result.next_review_at is not None


def test_srs_certain_with_recall_enters_early_probationary() -> None:
    item = _item(status="in_progress", streak=2)
    result = advance_on_correct(item, confidence="certain", used_recall=True, user_tz="Asia/Shanghai")
    assert result.probationary is True
    assert result.early_graduated is True
    assert result.new_status == "probationary"
    assert result.new_streak == 3


def test_srs_unsure_blocks_graduation() -> None:
    item = _item(status="in_progress", streak=3)
    result = advance_on_correct(item, confidence="unsure", used_recall=False, user_tz="Asia/Shanghai")
    assert result.probationary is False
    assert result.new_streak == 3
    assert item.metadata_json["unsure_blocked_graduation"] is True


def test_srs_null_confidence_correct_increments_skip_count_and_defaults_likely() -> None:
    item = _item(status="in_progress", streak=2)
    result = advance_on_correct(item, confidence=None, used_recall=False, user_tz="Asia/Shanghai")
    assert result.new_streak == 3
    assert item.metadata_json["confidence_skipped_count"] == 1
    assert item.metadata_json["last_confidence"] == "likely"


def test_srs_hard_item_caps_positive_multiplier() -> None:
    item = _item(status="in_progress", streak=1, metadata={"is_hard": True})
    result = advance_on_correct(item, confidence="certain", used_recall=True, user_tz="Asia/Shanghai")
    assert result.next_review_at is not None
    assert result.new_streak == 2


def test_srs_certain_incorrect_sets_mismatch_and_forced_analysis() -> None:
    item = _item(status="in_progress", streak=2)
    result = regress_on_incorrect(item, confidence="certain", user_tz="Asia/Shanghai")
    assert result.confidence_mismatch is True
    assert result.new_streak == 1
    assert item.metadata_json["confidence_mismatch_count"] == 1
    assert item.metadata_json["forced_cause_analysis_pending"] is True


def test_srs_second_mismatch_marks_hard() -> None:
    item = _item(status="in_progress", streak=2, metadata={"confidence_mismatch_count": 1})
    result = regress_on_incorrect(item, confidence="certain", user_tz="Asia/Shanghai")
    assert result.is_hard_now is True
    assert item.metadata_json["is_hard"] is True
    assert {event.outcome for event in result.attempts} >= {"hard_marked", "confidence_mismatch", "incorrect"}


def test_srs_null_confidence_incorrect_increments_skip_count() -> None:
    item = _item(status="in_progress", streak=2)
    result = regress_on_incorrect(item, confidence=None, user_tz="Asia/Shanghai")
    assert result.new_streak == 1
    assert item.metadata_json["confidence_skipped_count"] == 1
    assert item.metadata_json["last_confidence"] == "likely"


def test_srs_probation_correct_finishes_graduated() -> None:
    item = _item(status="probationary", streak=4, next_review_at=datetime.now(UTC).replace(tzinfo=None))
    result = execute_probation_check(item, is_correct=True, user_id=1, user_tz="Asia/Shanghai")
    assert result.passed is True
    assert result.new_status == "graduated"
    assert item.next_review_at is None


def test_srs_probation_incorrect_returns_re_failed_payload() -> None:
    item = _item(status="probationary", streak=4, next_review_at=datetime.now(UTC).replace(tzinfo=None))
    result = execute_probation_check(item, is_correct=False, user_id=1, user_tz="Asia/Shanghai")
    assert result.passed is False
    assert result.re_failed_payload is not None
    assert result.re_failed_payload.source_kind == "re_failed"
    assert item.status == "probationary"
    assert item.next_review_at is None


def test_srs_mark_resolved_enters_probationary() -> None:
    item = _item(status="in_progress", streak=1)
    result = mark_resolved(item, user_tz="Asia/Shanghai")
    assert result.new_status == "probationary"
    assert result.new_streak == 4
    assert result.attempts[0].outcome == "mark_resolved"


def test_srs_mark_resolved_rejects_existing_probationary() -> None:
    item = _item(status="probationary", streak=4)
    with pytest.raises(AlreadyProbationaryError):
        mark_resolved(item, user_tz="Asia/Shanghai")


def test_srs_due_today_uses_local_day_end() -> None:
    item = _item(
        status="in_progress",
        streak=1,
        next_review_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=2),
    )
    assert is_due_today(item, user_tz="Asia/Shanghai") is True
