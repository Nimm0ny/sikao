from __future__ import annotations

from enum import StrEnum


class ReviewSourceKind(StrEnum):
    WRONG_ANSWER = "wrong_answer"
    FLAGGED_PERSISTENT = "flagged_persistent"
    RE_FAILED = "re_failed"
    MANUAL_ADD = "manual_add"
    NOTE_CARD = "note_card"


class ReviewItemStatus(StrEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    PROBATIONARY = "probationary"
    GRADUATED = "graduated"
    ARCHIVED = "archived"


class ReviewAttemptOutcome(StrEnum):
    CREATED = "created"
    ATTEMPTED = "attempted"
    CORRECT = "correct"
    INCORRECT = "incorrect"
    PROBATION_ENTERED = "probation_entered"
    GRADUATED = "graduated"
    ARCHIVED = "archived"
    RESTORED = "restored"
    RECALL_FILLED = "recall_filled"
    CONFIDENCE_MISMATCH = "confidence_mismatch"


class CauseAnalysisScope(StrEnum):
    SINGLE = "single"
    GROUP = "group"
