from __future__ import annotations

from typing import Literal, cast

from sikao_api.modules.session_lifecycle.domain.types import TransitionAttempt, TransitionResult

_TRANSITIONS: dict[tuple[str, str], str] = {
    ("draft", "first_answer"): "in_progress",
    ("draft", "first_heartbeat"): "in_progress",
    ("in_progress", "user_pause"): "paused",
    ("in_progress", "heartbeat_timeout"): "paused",
    ("paused", "user_resume"): "in_progress",
    ("paused", "new_heartbeat"): "in_progress",
    ("paused", "answer_during_paused"): "in_progress",
    ("in_progress", "user_submit"): "submitted",
    ("paused", "user_submit"): "submitted",
    ("in_progress", "force_submit"): "submitted",
    ("paused", "force_submit"): "submitted",
    ("in_progress", "no_activity_24h"): "abandoned",
    ("paused", "no_activity_24h"): "abandoned",
    ("in_progress", "user_discard"): "abandoned",
    ("paused", "user_discard"): "abandoned",
    ("in_progress", "daily_expire_cron"): "expired",
    ("paused", "daily_expire_cron"): "expired",
    ("draft", "no_activity_draft_2h"): "abandoned",
}
_TERMINAL = {"submitted", "abandoned", "expired"}


def evaluate_transition(attempt: TransitionAttempt) -> TransitionResult:
    if attempt.from_status is None:
        if attempt.trigger == "session_create":
            return TransitionResult(ok=True, new_status="draft", error_code=None)
        return TransitionResult(ok=False, new_status=None, error_code="INVALID_TRANSITION")
    if attempt.from_status in _TERMINAL:
        return TransitionResult(ok=False, new_status=None, error_code="IMMUTABLE_TERMINAL_STATE")
    new_status = _TRANSITIONS.get((attempt.from_status, attempt.trigger))
    if new_status is None:
        return TransitionResult(ok=False, new_status=None, error_code="INVALID_TRANSITION")
    return TransitionResult(
        ok=True,
        new_status=cast(Literal["draft", "in_progress", "paused", "submitted", "abandoned", "expired"], new_status),
        error_code=None,
    )
