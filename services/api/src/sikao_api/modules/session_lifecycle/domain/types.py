from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, NamedTuple


SessionStatus = Literal["draft", "in_progress", "paused", "submitted", "abandoned", "expired"]
SessionTrigger = Literal[
    "session_create",
    "user_start",
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
]
SessionActor = Literal["user", "system", "cron", "admin"]


@dataclass(frozen=True)
class TransitionAttempt:
    from_status: SessionStatus | None
    trigger: SessionTrigger
    actor: SessionActor


class TransitionResult(NamedTuple):
    ok: bool
    new_status: SessionStatus | None
    error_code: str | None
