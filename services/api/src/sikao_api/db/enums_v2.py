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
    PROBATION_FAILED = "probation_failed"
    GRADUATED = "graduated"
    ARCHIVED = "archived"
    RESTORED = "restored"
    RECALL_FILLED = "recall_filled"
    CONFIDENCE_MISMATCH = "confidence_mismatch"
    HARD_MARKED = "hard_marked"
    MARK_RESOLVED = "mark_resolved"
    CAUSE_TAG_OVERRIDDEN = "cause_tag_overridden"
    ALGORITHM_MIGRATED = "algorithm_migrated"


class CauseAnalysisScope(StrEnum):
    SINGLE = "single"
    GROUP = "group"


class TaxonomyCategory(StrEnum):
    KNOWLEDGE = "knowledge"
    REASONING = "reasoning"
    STATE = "state"
    OTHER = "other"


class CauseTagSeverity(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
