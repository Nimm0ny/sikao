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
    DEBT_REDISTRIBUTED = "debt_redistributed"
    DEBT_DEFERRED = "debt_deferred"
    RAMPUP_STARTED = "rampup_started"
    RAMPUP_PHASE_CHANGED = "rampup_phase_changed"
    RAMPUP_COMPLETED = "rampup_completed"
    PROBATION_ENTERED = "probation_entered"
    PROBATION_FAILED = "probation_failed"
    GRADUATED = "graduated"
    ARCHIVED = "archived"
    RESTORED = "restored"
    RECALL_FILLED = "recall_filled"
    CONFIDENCE_MISMATCH = "confidence_mismatch"
    HARD_MARKED = "hard_marked"
    HARD_CLEARED = "hard_cleared"
    MARK_RESOLVED = "mark_resolved"
    CAUSE_TAG_OVERRIDDEN = "cause_tag_overridden"
    ALGORITHM_MIGRATED = "algorithm_migrated"


class DebtSeverity(StrEnum):
    NONE = "none"
    LIGHT = "light"
    MODERATE = "moderate"
    HEAVY = "heavy"
    CRITICAL = "critical"


class DebtStatus(StrEnum):
    DUE = "due"
    DEFERRED = "deferred"
    REDISTRIBUTED = "redistributed"
    RAMP_UP_PROTECTED = "ramp_up_protected"


class RampupPhase(StrEnum):
    DAY_1 = "day_1"
    DAY_2 = "day_2"
    DAY_3 = "day_3"
    DAY_4 = "day_4"
    DAY_5 = "day_5"


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
