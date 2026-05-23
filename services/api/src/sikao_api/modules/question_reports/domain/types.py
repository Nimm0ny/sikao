from __future__ import annotations

from enum import StrEnum


class QuestionReportCategory(StrEnum):
    STEM_TYPO = "stem_typo"
    OPTION_MISSING = "option_missing"
    ANSWER_DISPUTED = "answer_disputed"
    EXPLANATION_WRONG = "explanation_wrong"
    FORMATTING = "formatting"
    OTHER = "other"


class QuestionReportStatus(StrEnum):
    PENDING = "pending"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED_FIXED = "resolved_fixed"
    RESOLVED_INVALID = "resolved_invalid"
    RESOLVED_DUPLICATE = "resolved_duplicate"


class QuestionReportFixField(StrEnum):
    STEM = "stem"
    OPTIONS = "options"
    CORRECT_ANSWER = "correct_answer"
    EXPLANATION = "explanation"


QUESTION_REPORT_DESCRIPTION_MIN_LENGTH = 10
QUESTION_REPORT_DESCRIPTION_MAX_LENGTH = 1000
QUESTION_REPORT_DAILY_LIMIT = 20

ACTIVE_QUESTION_REPORT_STATUSES = frozenset(
    {
        QuestionReportStatus.PENDING.value,
        QuestionReportStatus.ACKNOWLEDGED.value,
    }
)
TERMINAL_QUESTION_REPORT_STATUSES = frozenset(
    {
        QuestionReportStatus.RESOLVED_FIXED.value,
        QuestionReportStatus.RESOLVED_INVALID.value,
        QuestionReportStatus.RESOLVED_DUPLICATE.value,
    }
)
