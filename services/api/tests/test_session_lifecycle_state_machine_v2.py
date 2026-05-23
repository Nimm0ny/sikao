from __future__ import annotations

from typing import Literal, cast

import pytest

from sikao_api.modules.session_lifecycle.application.state_machine import evaluate_transition
from sikao_api.modules.session_lifecycle.domain.types import TransitionAttempt


@pytest.mark.parametrize(
    ("from_status", "trigger", "expected"),
    [
        (None, "session_create", "draft"),
        ("draft", "first_answer", "in_progress"),
        ("in_progress", "user_pause", "paused"),
        ("in_progress", "heartbeat_timeout", "paused"),
        ("paused", "user_resume", "in_progress"),
        ("paused", "new_heartbeat", "in_progress"),
        ("paused", "answer_during_paused", "in_progress"),
        ("in_progress", "user_submit", "submitted"),
        ("paused", "user_submit", "submitted"),
        ("in_progress", "force_submit", "submitted"),
        ("paused", "force_submit", "submitted"),
        ("in_progress", "no_activity_24h", "abandoned"),
        ("paused", "no_activity_24h", "abandoned"),
        ("in_progress", "user_discard", "abandoned"),
        ("paused", "user_discard", "abandoned"),
        ("in_progress", "daily_expire_cron", "expired"),
        ("paused", "daily_expire_cron", "expired"),
        ("draft", "no_activity_draft_2h", "abandoned"),
    ],
)
def test_session_lifecycle_state_machine_valid_transitions(from_status: str | None, trigger: str, expected: str) -> None:
    result = evaluate_transition(
        TransitionAttempt(
            from_status=cast(Literal["draft", "in_progress", "paused", "submitted", "abandoned", "expired"] | None, from_status),
            trigger=cast(
                Literal[
                    "session_create",
                    "first_answer",
                    "user_pause",
                    "heartbeat_timeout",
                    "user_resume",
                    "new_heartbeat",
                    "answer_during_paused",
                    "user_submit",
                    "force_submit",
                    "no_activity_24h",
                    "user_discard",
                    "daily_expire_cron",
                    "no_activity_draft_2h",
                ],
                trigger,
            ),
            actor="user",
        )
    )
    assert result.ok is True
    assert result.new_status == expected
    assert result.error_code is None


@pytest.mark.parametrize("from_status", ["submitted", "abandoned", "expired"])
def test_session_lifecycle_state_machine_terminal_states_are_immutable(from_status: str) -> None:
    result = evaluate_transition(
        TransitionAttempt(
            from_status=cast(Literal["draft", "in_progress", "paused", "submitted", "abandoned", "expired"], from_status),
            trigger="user_resume",
            actor="user",
        )
    )
    assert result.ok is False
    assert result.new_status is None
    assert result.error_code == "IMMUTABLE_TERMINAL_STATE"


def test_session_lifecycle_state_machine_rejects_invalid_transition() -> None:
    result = evaluate_transition(
        TransitionAttempt(from_status="draft", trigger="user_pause", actor="user")
    )
    assert result.ok is False
    assert result.new_status is None
    assert result.error_code == "INVALID_TRANSITION"


def test_session_lifecycle_state_machine_rejects_non_create_without_previous_state() -> None:
    result = evaluate_transition(
        TransitionAttempt(from_status=None, trigger="user_submit", actor="user")
    )
    assert result.ok is False
    assert result.new_status is None
    assert result.error_code == "INVALID_TRANSITION"
