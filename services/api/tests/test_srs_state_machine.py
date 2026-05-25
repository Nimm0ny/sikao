from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from sikao_api.db.models_v2 import ReviewItemV2
from sikao_api.modules.review.application.srs_engine import (
    AlreadyProbationaryError,
    advance_on_correct,
    execute_probation_check,
    get_today_end,
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


def _assert_days_from_today_end(value: datetime | None, *, days: int) -> None:
    assert value is not None
    expected = get_today_end("Asia/Shanghai") + timedelta(days=days)
    assert value.date() == expected.date()


def test_srs_likely_correct_advances_pending_to_in_progress_with_standard_interval() -> None:
    item = _item(status="pending", streak=0)
    result = advance_on_correct(item, confidence="likely", used_recall=False, user_tz="Asia/Shanghai")
    assert result.new_status == "in_progress"
    assert result.new_streak == 1
    assert item.version == 2
    _assert_days_from_today_end(result.next_review_at, days=3)


def test_srs_guess_correct_does_not_increment_or_reward_recall() -> None:
    item = _item(status="pending", streak=0)
    result = advance_on_correct(item, confidence="guess", used_recall=True, user_tz="Asia/Shanghai")
    assert result.advance_skipped is True
    assert result.new_streak == 0
    assert result.new_status == "in_progress"
    assert result.attempts[0].notes_json["intervalMultiplierApplied"] == 1.0
    _assert_days_from_today_end(result.next_review_at, days=1)


def test_srs_guess_incorrect_regresses_normally() -> None:
    item = _item(status="in_progress", streak=2)
    result = regress_on_incorrect(item, confidence="guess", user_tz="Asia/Shanghai")
    assert result.new_streak == 1
    assert result.confidence_mismatch is False
    _assert_days_from_today_end(result.next_review_at, days=3)


def test_srs_unsure_correct_halves_interval() -> None:
    item = _item(status="in_progress", streak=0)
    result = advance_on_correct(item, confidence="unsure", used_recall=False, user_tz="Asia/Shanghai")
    assert result.new_streak == 1
    _assert_days_from_today_end(result.next_review_at, days=1)


def test_srs_unsure_with_recall_cancels_penalty() -> None:
    item = _item(status="in_progress", streak=0)
    result = advance_on_correct(item, confidence="unsure", used_recall=True, user_tz="Asia/Shanghai")
    assert result.new_streak == 1
    _assert_days_from_today_end(result.next_review_at, days=3)


def test_srs_unsure_blocks_graduation_at_threshold() -> None:
    item = _item(status="in_progress", streak=3)
    result = advance_on_correct(item, confidence="unsure", used_recall=False, user_tz="Asia/Shanghai")
    assert result.probationary is False
    assert result.new_streak == 3
    assert item.metadata_json["unsure_blocked_graduation"] is True
    _assert_days_from_today_end(result.next_review_at, days=10)


def test_srs_likely_recall_applies_one_point_five_multiplier() -> None:
    item = _item(status="in_progress", streak=1)
    result = advance_on_correct(item, confidence="likely", used_recall=True, user_tz="Asia/Shanghai")
    assert result.new_streak == 2
    assert result.attempts[0].notes_json["intervalMultiplierApplied"] == 1.5
    _assert_days_from_today_end(result.next_review_at, days=10)


def test_srs_certain_with_recall_enters_early_probationary() -> None:
    item = _item(status="in_progress", streak=2)
    result = advance_on_correct(item, confidence="certain", used_recall=True, user_tz="Asia/Shanghai")
    assert result.probationary is True
    assert result.early_graduated is True
    assert result.new_status == "probationary"
    assert result.new_streak == 3


def test_srs_null_confidence_defaults_likely_and_tracks_skip_count() -> None:
    item = _item(status="in_progress", streak=1)
    result = advance_on_correct(item, confidence=None, used_recall=False, user_tz="Asia/Shanghai")
    assert result.new_streak == 2
    assert item.metadata_json["confidence_skipped_count"] == 1
    assert item.metadata_json["last_confidence"] == "likely"
    _assert_days_from_today_end(result.next_review_at, days=7)


def test_srs_hard_item_caps_positive_multiplier() -> None:
    item = _item(status="in_progress", streak=1, metadata={"is_hard": True})
    result = advance_on_correct(item, confidence="certain", used_recall=True, user_tz="Asia/Shanghai")
    assert result.new_streak == 2
    _assert_days_from_today_end(result.next_review_at, days=7)


def test_srs_certain_incorrect_sets_mismatch_and_forced_analysis() -> None:
    item = _item(status="in_progress", streak=2)
    result = regress_on_incorrect(item, confidence="certain", user_tz="Asia/Shanghai")
    outcomes = {event.outcome for event in result.attempts}
    assert result.confidence_mismatch is True
    assert item.metadata_json["confidence_mismatch_count"] == 1
    assert item.metadata_json["forced_cause_analysis_pending"] is True
    assert outcomes >= {"confidence_mismatch", "incorrect"}
    _assert_days_from_today_end(result.next_review_at, days=3)


def test_srs_second_mismatch_marks_hard() -> None:
    item = _item(status="in_progress", streak=2, metadata={"confidence_mismatch_count": 1})
    result = regress_on_incorrect(item, confidence="certain", user_tz="Asia/Shanghai")
    outcomes = {event.outcome for event in result.attempts}
    assert result.is_hard_now is True
    assert item.metadata_json["is_hard"] is True
    assert outcomes >= {"hard_marked", "confidence_mismatch", "incorrect"}


def test_srs_probation_paths_and_mark_resolved_state_machine() -> None:
    probationary = _item(
        status="probationary",
        streak=4,
        next_review_at=datetime.now(UTC).replace(tzinfo=None),
    )
    passed = execute_probation_check(probationary, is_correct=True, user_id=1, user_tz="Asia/Shanghai")
    assert passed.passed is True
    assert passed.new_status == "graduated"

    failed_item = _item(
        status="probationary",
        streak=4,
        next_review_at=datetime.now(UTC).replace(tzinfo=None),
    )
    failed = execute_probation_check(failed_item, is_correct=False, user_id=1, user_tz="Asia/Shanghai")
    assert failed.passed is False
    assert failed.re_failed_payload is not None

    in_progress = _item(status="in_progress", streak=1)
    resolved = mark_resolved(in_progress, user_tz="Asia/Shanghai")
    assert resolved.new_status == "probationary"
    with pytest.raises(AlreadyProbationaryError):
        mark_resolved(in_progress, user_tz="Asia/Shanghai")


def test_srs_due_today_uses_local_day_end() -> None:
    item = _item(
        status="in_progress",
        streak=1,
        next_review_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=2),
    )
    assert is_due_today(item, user_tz="Asia/Shanghai") is True
