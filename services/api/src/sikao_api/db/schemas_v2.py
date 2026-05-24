from __future__ import annotations

import json
import re
from datetime import date
from decimal import Decimal
from typing import Any, Literal

from pydantic import Field, field_validator

from sikao_api.core.schemas import CamelModel, UtcDatetime
from sikao_api.modules.question_reports.domain.types import (
    QUESTION_REPORT_DESCRIPTION_MAX_LENGTH,
    QUESTION_REPORT_DESCRIPTION_MIN_LENGTH,
    QuestionReportCategory,
    QuestionReportFixField,
    QuestionReportStatus,
)


_ABILITY_DIMENSIONS = {
    "comprehension",
    "reasoning",
    "calculation",
    "memory",
    "application",
}
_KEY_BINDING_PATTERN = re.compile(r"^(?:Ctrl\+|Shift\+|Alt\+)?[A-Za-z0-9_]+$")
_TIME_PATTERN = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
_KNOWLEDGE_TAG_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")


class ActionLinkV2(CamelModel):
    key: str
    label: str
    href: str
    enabled: bool = True


class SectionCardV2(CamelModel):
    key: str
    title: str
    description: str
    status: str
    href: str


class SummaryMetricV2(CamelModel):
    key: str
    label: str
    value: str
    tone: str = "neutral"


class OverviewResponseV2(CamelModel):
    summary: list[SummaryMetricV2]
    sections: list[SectionCardV2]
    actions: list[ActionLinkV2]


class AuthUserV2(CamelModel):
    id: int
    public_id: str
    display_name: str
    email: str | None = None
    phone: str | None = None
    is_active: bool
    created_at: UtcDatetime


class AuthSessionV2(CamelModel):
    id: int
    issued_at: UtcDatetime
    expires_at: UtcDatetime


class AuthSessionResponseV2(CamelModel):
    user: AuthUserV2
    session: AuthSessionV2


class AuthSessionStateResponseV2(CamelModel):
    authenticated: bool
    user: AuthUserV2
    session: AuthSessionV2


class AuthAckV2(CamelModel):
    ok: bool
    message: str


class LoginRequestV2(CamelModel):
    identifier: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=6, max_length=255)


class RegisterEmailRequestV2(CamelModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=6, max_length=255)
    display_name: str = Field(min_length=1, max_length=255, default="New User")


class RegisterPhoneRequestV2(CamelModel):
    phone: str = Field(min_length=6, max_length=32)
    sms_code: str = Field(min_length=4, max_length=16)
    password: str = Field(min_length=6, max_length=255)
    display_name: str = Field(min_length=1, max_length=255, default="New User")


class SendCodeRequestV2(CamelModel):
    target_kind: Literal["email", "phone"]
    target_value: str = Field(min_length=3, max_length=255)
    purpose: Literal["register", "reset_password", "login"]


class SendCodeResponseV2(CamelModel):
    ok: bool
    purpose: str
    delivery: str


class VerifyCodeRequestV2(CamelModel):
    target_kind: Literal["email", "phone"]
    target_value: str = Field(min_length=3, max_length=255)
    purpose: Literal["register", "reset_password", "login"]
    code: str = Field(min_length=4, max_length=16)


class VerifyCodeResponseV2(CamelModel):
    verified: bool
    message: str


class ResetPasswordRequestV2(CamelModel):
    identifier: str = Field(min_length=3, max_length=255)
    code: str = Field(min_length=4, max_length=16)
    new_password: str = Field(min_length=6, max_length=255)


class CatalogItemV2(CamelModel):
    id: str
    title: str
    subtitle: str | None = None
    status: str
    href: str
    count: int | None = None
    category_l1: str | None = None
    category_l2: str | None = None
    paper_code: str | None = None
    year: int | None = None
    region: str | None = None
    exam_type: str | None = None
    question_count: int | None = None
    difficulty: str | None = None
    is_completed: bool = False
    best_score: float | None = None
    last_attempt_at: UtcDatetime | None = None


class CatalogListResponseV2(CamelModel):
    items: list[CatalogItemV2]
    total: int
    page: int
    page_size: int


class PracticeCenterResponseV2(CamelModel):
    summary: list[SummaryMetricV2]
    sections: list[SectionCardV2]
    actions: list[ActionLinkV2]


class PracticeSessionCreateRequestV2(CamelModel):
    track: Literal["xingce", "essay"]
    entry_kind: str = Field(min_length=1, max_length=64)
    mode: str | None = None
    practice_mode: Literal["per_question", "full_set"] = "full_set"
    paper_code: str | None = None
    question_ids: list[int] = Field(default_factory=list)
    payload: dict[str, Any] = Field(default_factory=dict)
    config: dict[str, Any] = Field(default_factory=dict)
    linked_plan_event_id: int | None = None
    linked_plan_event_occurrence_ref: str | None = Field(default=None, max_length=64)
    linked_recommendation_id: int | None = None


class QuestionMetadataPreviewV2(CamelModel):
    ability_dimensions: list[str] = Field(default_factory=list)
    complexity_level: int | None = None
    knowledge_tags: list[str] = Field(default_factory=list)
    heat_score: float = 0.0

    @field_validator("ability_dimensions")
    @classmethod
    def validate_ability_dimensions(cls, values: list[str]) -> list[str]:
        invalid = sorted({value for value in values if value not in _ABILITY_DIMENSIONS})
        if invalid:
            raise ValueError(
                "ability_dimensions contains unsupported values: "
                + ", ".join(invalid)
            )
        return values

    @field_validator("complexity_level")
    @classmethod
    def validate_complexity_level(cls, value: int | None) -> int | None:
        if value is None:
            return value
        if not 1 <= value <= 5:
            raise ValueError("complexity_level must be between 1 and 5")
        return value

    @field_validator("knowledge_tags")
    @classmethod
    def validate_knowledge_tags(cls, values: list[str]) -> list[str]:
        invalid = sorted({value for value in values if not _KNOWLEDGE_TAG_PATTERN.match(value)})
        if invalid:
            raise ValueError(
                "knowledge_tags must be snake_case: " + ", ".join(invalid)
            )
        return values


class QuestionEnvelopeV2(CamelModel):
    id: int
    question_key: str
    prompt: str
    answer_kind: str
    status: str
    content: dict[str, Any] = Field(default_factory=dict)
    metadata_preview: QuestionMetadataPreviewV2 | None = None


class PracticeSessionItemV2(CamelModel):
    id: str
    question_key: str
    prompt: str
    answer_kind: str
    status: str
    selected_answer_keys: list[str] = Field(default_factory=list)
    answer_text: str | None = None
    flagged: bool = False
    viewed_solution: bool = False
    has_user_notes: bool = False
    is_favorited: bool = False
    has_persistent_flag: bool = False
    time_spent_ms: int = 0
    answer_change_count: int = 0
    visit_count: int = 0
    is_overtime: bool = False


class PracticeSessionEnvelopeV2(CamelModel):
    id: int
    track: str
    entry_kind: str
    status: str
    items: list[PracticeSessionItemV2]
    actions: list[ActionLinkV2]
    started_at: UtcDatetime
    practice_mode: str = "full_set"
    source_mode: str = "paper"
    config_snapshot: dict[str, Any] = Field(default_factory=dict)
    paused_at: UtcDatetime | None = None
    paused_count: int = 0
    last_heartbeat_at: UtcDatetime | None = None
    expires_at: UtcDatetime | None = None
    force_submitted: bool = False
    force_submitted_reason: str | None = None
    total_active_seconds: int = 0
    paused_total_seconds: int = 0
    first_question_at: UtcDatetime | None = None
    last_activity_at: UtcDatetime | None = None
    exam_mode: bool = False
    time_limit_minutes: int | None = None
    auto_submit_at: UtcDatetime | None = None
    delayed_review_until: UtcDatetime | None = None
    submitted_at: UtcDatetime | None = None


class PracticeAnswerPayloadV2(CamelModel):
    question_key: str = Field(min_length=1, max_length=64)
    answer: dict[str, Any] = Field(default_factory=dict)
    duration_seconds: int | None = None


class PracticeAnswerUpsertRequestV2(CamelModel):
    answers: list[PracticeAnswerPayloadV2] = Field(default_factory=list)


class PracticeAnswerFlagRequestV2(CamelModel):
    flagged: bool


class PracticePersistentFlagRequestV2(CamelModel):
    question_id: int
    reason: Literal["uncertain", "revisit_later", "needs_review"]


class OperationAckV2(CamelModel):
    ok: bool
    status: str


class PracticeSessionResultResponseV2(CamelModel):
    summary: list[SummaryMetricV2]
    sections: list[SectionCardV2]
    actions: list[ActionLinkV2]


class ReviewItemV2(CamelModel):
    id: int
    kind: str
    title: str
    status: str
    href: str
    created_at: UtcDatetime
    correct_streak: int = 0
    next_review_at: UtcDatetime | None = None
    question_id: int | None = None
    has_user_notes: bool = False
    has_cause_analysis: bool = False
    updated_at: UtcDatetime | None = None


class ReviewListResponseV2(CamelModel):
    items: list[ReviewItemV2]
    total: int
    page: int
    page_size: int


class ReviewAttemptOutV2(CamelModel):
    id: int
    outcome: str
    attempted_at: UtcDatetime
    notes_json: dict[str, Any] = Field(default_factory=dict)


class SrsStateV2(CamelModel):
    algorithm_version: str = "simple_v1"
    correct_streak: int = 0
    next_review_at: UtcDatetime | None = None
    interval_days: int | None = None
    is_due_today: bool = False
    days_overdue: int = 0


class ReviewDetailResponseV2(CamelModel):
    item: ReviewItemV2
    history: list[ReviewAttemptOutV2]
    actions: list[ActionLinkV2]
    srs_state: SrsStateV2 | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ReviewItemCreateV2(CamelModel):
    question_id: int
    title: str | None = None


class ReviewAttemptSubmitV2(CamelModel):
    is_correct: bool
    user_answer: str = Field(min_length=1, max_length=4096)
    confidence: Literal["guess", "unsure", "likely", "certain"] | None = None
    recall_text: str | None = Field(default=None, max_length=4096)

    @field_validator("user_answer")
    @classmethod
    def _validate_user_answer(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("user_answer cannot be blank")
        return stripped

    @field_validator("recall_text")
    @classmethod
    def _normalize_recall_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class ReviewItemBatchActionV2(CamelModel):
    item_ids: list[int] = Field(default_factory=list)
    action: Literal["archive", "restore", "graduate"]


class ReviewBatchActionResultV2(CamelModel):
    ok: bool
    status: str
    affected_count: int


class CauseAnalysisComparisonJudgmentV2(CamelModel):
    improved_dimensions: list[str] = Field(default_factory=list)
    persisted_dimensions: list[str] = Field(default_factory=list)
    newly_emerged_dimensions: list[str] = Field(default_factory=list)
    actions_likely_completed: list[bool] = Field(default_factory=list)
    overall_trend: Literal["improved", "partial_improvement", "stagnant", "regressed"]


class CauseAnalysisDimensionOverrideV2(CamelModel):
    slug_original: str
    slug_overridden: str
    severity_overridden: str | None = None
    user_note: str | None = None
    overridden_at: UtcDatetime


class CauseAnalysisDimensionV2(CamelModel):
    slug: str
    name_display: str
    severity: Literal["high", "medium", "low"]
    suggestion: str
    user_override: CauseAnalysisDimensionOverrideV2 | None = None
    llm_original: dict[str, Any] | None = Field(
        default=None,
        alias="_llm_original",
        serialization_alias="_llm_original",
    )
    llm_original_slug: str | None = Field(
        default=None,
        alias="_llm_original_slug",
        serialization_alias="_llm_original_slug",
    )


class CauseAnalysisEvolutionContextV2(CamelModel):
    previous_analysis_id: int | None = None
    previous_analyzed_at: UtcDatetime | None = None
    previous_dimensions: list[CauseAnalysisDimensionV2] = Field(default_factory=list)
    previous_suggested_actions: list[str] = Field(default_factory=list)
    previous_confidence: str | None = None
    comparison_judgment: CauseAnalysisComparisonJudgmentV2


class CauseAnalysisResultV2(CamelModel):
    mode: Literal["single", "forced", "group"]
    summary: str
    dimensions: list[CauseAnalysisDimensionV2] = Field(default_factory=list)
    suggested_actions: list[str] = Field(default_factory=list)
    related_questions: list[int] = Field(default_factory=list)
    evolution_context: CauseAnalysisEvolutionContextV2 | None = None
    meta: dict[str, Any] = Field(default_factory=dict, alias="_meta", serialization_alias="_meta")


class CauseAnalysisResponseV2(CamelModel):
    analysis_id: int
    scope: Literal["single", "group"]
    mode: Literal["single", "forced", "group"]
    version: int
    cached: bool
    expires_at: UtcDatetime
    llm_call_id: int
    warning_code: str | None = None
    result: CauseAnalysisResultV2


class CauseAnalysisRequestV2(CamelModel):
    mode: Literal["single", "forced"] = "single"


class CauseAnalysisGroupRequestV2(CamelModel):
    item_ids: list[int] = Field(min_length=2, max_length=20)

    @field_validator("item_ids")
    @classmethod
    def _validate_distinct_item_ids(cls, value: list[int]) -> list[int]:
        if len(set(value)) != len(value):
            raise ValueError("item_ids must be distinct")
        return value


class CauseDimensionOverrideRequestV2(CamelModel):
    slug: str = Field(min_length=1, max_length=64)
    user_severity: Literal["high", "medium", "low"] | None = None
    user_note: str | None = Field(default=None, max_length=500)
    expected_version: int = Field(ge=1)

    @field_validator("slug")
    @classmethod
    def _normalize_slug(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("slug cannot be blank")
        return normalized

    @field_validator("user_note")
    @classmethod
    def _normalize_user_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class CauseTagItemV2(CamelModel):
    id: int
    slug: str
    name: str
    category: str
    severity_default: str
    description: str
    display_order: int
    is_active: bool
    taxonomy_version: str


class CauseTagListResponseV2(CamelModel):
    items: list[CauseTagItemV2]
    total: int


class ReviewInsightsDayPointV2(CamelModel):
    date: date
    new_incorrect: int
    graduated: int
    net_accumulation: int


class ReviewInsightsTrendsResponseV2(CamelModel):
    days: list[ReviewInsightsDayPointV2] = Field(default_factory=list)


class ReviewCauseFrequencyV2(CamelModel):
    slug: str
    name: str
    count: int
    severity_distribution: dict[str, int] = Field(default_factory=dict)


class ReviewInsightsCausesResponseV2(CamelModel):
    causes: list[ReviewCauseFrequencyV2] = Field(default_factory=list)


class ReviewWeekAccuracyPointV2(CamelModel):
    week: str
    total_attempts: int
    correct_count: int
    accuracy_pct: float


class ReviewInsightsRedoAccuracyResponseV2(CamelModel):
    weeks: list[ReviewWeekAccuracyPointV2] = Field(default_factory=list)


class ReviewWeeklyProgressHighlightV2(CamelModel):
    question_id: int | None = None
    title: str
    summary: str
    from_confidence: str | None = None
    to_confidence: str | None = None


class ReviewWeeklyConcernHighlightV2(CamelModel):
    slug: str | None = None
    label: str
    summary: str


class ReviewWeeklySummaryResponseV2(CamelModel):
    week: str
    items_reviewed: int
    redo_accuracy_pct: float
    new_notes_count: int
    new_graduated_count: int
    generated_note_id: int | None = None
    biggest_progress: ReviewWeeklyProgressHighlightV2 | None = None
    biggest_concern: ReviewWeeklyConcernHighlightV2 | None = None
    next_week_focus: str | None = None


class NoteItemV2(CamelModel):
    id: int
    title: str
    excerpt: str
    status: str
    linked_question_id: int | None = None
    visibility: str = "private"
    created_at: UtcDatetime
    updated_at: UtcDatetime


class NoteListResponseV2(CamelModel):
    items: list[NoteItemV2]
    total: int
    page: int
    page_size: int


class NoteDetailV2(CamelModel):
    id: int
    title: str
    body: str
    status: str
    linked_question_id: int | None = None
    visibility: str = "private"
    created_at: UtcDatetime
    updated_at: UtcDatetime


class NoteCreateRequestV2(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    body: str = Field(default="")
    linked_question_id: int | None = None
    visibility: str = "private"


class NoteUpdateRequestV2(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    body: str = Field(default="")
    status: str = Field(default="active")
    linked_question_id: int | None = None
    visibility: str | None = None


class TrendPointV2(CamelModel):
    date: date
    session_id: int
    accuracy: float
    count: int


class PracticeStatsCellV2(CamelModel):
    category_key: str | None = None
    label: str
    total_questions: int
    correct_count: int
    accuracy: float
    total_sessions: int
    total_minutes: int
    recent_trend: list[TrendPointV2] = Field(default_factory=list)
    percentile_rank: float | None = None
    last_practiced_at: UtcDatetime | None = None


class PracticeStatsResponseV2(CamelModel):
    type: Literal["xingce", "essay"]
    overall: PracticeStatsCellV2
    by_category_l1: list[PracticeStatsCellV2] = Field(default_factory=list)
    by_category_l2: list[PracticeStatsCellV2] = Field(default_factory=list)


class QuestionTimingItemV2(CamelModel):
    answer_id: int
    question_id: int
    time_spent_ms: int
    baseline_p50_ms: int | None = None
    baseline_p95_ms: int | None = None
    is_overtime: bool
    answer_change_count: int
    visit_count: int


class TimingSummaryV2(CamelModel):
    overtime_count: int
    fastest_answer_id: int | None = None
    slowest_answer_id: int | None = None
    most_changed_answer_id: int | None = None


class SessionTimingReportV2(CamelModel):
    total_active_seconds: int
    total_wall_seconds: int
    paused_total_seconds: int
    questions: list[QuestionTimingItemV2] = Field(default_factory=list)
    summary: TimingSummaryV2


class TimingOverall(CamelModel):
    total_minutes: int
    avg_seconds_per_question: float
    vs_baseline_ratio: float


class TimingByCategory(CamelModel):
    category: str
    avg_seconds: float
    vs_baseline_ratio: float
    sample_count: int


class TimingByDifficulty(CamelModel):
    difficulty_bucket: str
    avg_seconds: float
    vs_baseline_ratio: float


class TimingOvertimeBucket(CamelModel):
    count: int
    top_5_question_ids: list[int] = Field(default_factory=list)


class PracticeStatsTimingResponseV2(CamelModel):
    overall: TimingOverall
    by_category_l1: list[TimingByCategory] = Field(default_factory=list)
    by_difficulty: list[TimingByDifficulty] = Field(default_factory=list)
    overtime_questions: TimingOvertimeBucket
    pacing_pattern: Literal["steady", "fast_start_slow_end", "slow_start_fast_end", "irregular"]


class LifecycleTransition(CamelModel):
    from_status: str
    to_status: str
    trigger: str
    actor: Literal["user", "system", "cron", "admin"]
    ts: UtcDatetime
    reason: str | None = None


class SessionLifecycleResponseV2(CamelModel):
    status: str
    first_question_at: UtcDatetime | None = None
    last_activity_at: UtcDatetime | None = None
    paused_at: UtcDatetime | None = None
    paused_count: int = 0
    paused_total_seconds: int = 0
    last_heartbeat_at: UtcDatetime | None = None
    expires_at: UtcDatetime | None = None
    abandoned_at: UtcDatetime | None = None
    abandoned_reason: str | None = None
    force_submitted: bool = False
    force_submitted_reason: str | None = None
    transitions: list[LifecycleTransition] = Field(default_factory=list)


class SessionDiscardRequestV2(CamelModel):
    reason: str | None = Field(default=None, max_length=64)


class SessionHeartbeatRequestV2(CamelModel):
    client_ts: UtcDatetime | None = None
    current_question_id: int | None = None


class SessionHeartbeatResponseV2(CamelModel):
    server_ts: UtcDatetime
    status: str


class ActiveSessionProgress(CamelModel):
    answered: int
    total: int


class ActiveSessionV2(CamelModel):
    id: int
    type: Literal["xingce", "essay"]
    source_mode: str
    practice_mode: str
    status: str
    started_at: UtcDatetime
    last_activity_at: UtcDatetime | None = None
    paused_at: UtcDatetime | None = None
    progress: ActiveSessionProgress
    paper_code: str | None = None
    category: str | None = None
    exam_mode: bool = False


class ActiveSessionsResponseV2(CamelModel):
    sessions: list[ActiveSessionV2] = Field(default_factory=list)
    count: int


class MockExamCreateRequestV2(CamelModel):
    paper_code: str = Field(min_length=1, max_length=64)
    time_limit_minutes: int | None = Field(default=None, ge=10, le=360)
    delayed_review_minutes: int = Field(default=0, ge=0, le=1440)


class MockExamCreateResponseV2(CamelModel):
    session_id: int
    paper_code: str
    time_limit_minutes: int
    auto_submit_at: UtcDatetime | None = None
    expires_at: UtcDatetime | None = None
    status: str


class MockExamCountdownResponseV2(CamelModel):
    server_now: UtcDatetime
    auto_submit_at: UtcDatetime
    remaining_seconds: int
    status: str
    elapsed_seconds: int


class MockExamHistoryItem(CamelModel):
    session_id: int
    paper_code: str
    completed_at: UtcDatetime
    time_limit_minutes: int
    actual_active_seconds: int
    accuracy: float
    total_score: float | None = None
    is_force_submitted: bool
    rank_in_self: int | None = None


class MockExamAggregate(CamelModel):
    total_count: int
    best_accuracy: float
    best_session_id: int | None = None
    avg_accuracy: float
    improvement_trend: float


class MockExamHistoryResponseV2(CamelModel):
    sessions: list[MockExamHistoryItem] = Field(default_factory=list)
    aggregate: MockExamAggregate


class MockExamComparisonResponseV2(CamelModel):
    self: MockExamHistoryItem
    self_history: list[MockExamHistoryItem] = Field(default_factory=list)
    paper_baseline: dict[str, float | int | None] = Field(default_factory=dict)


class UiPreferences(CamelModel):
    font_size: Literal["sm", "base", "lg", "xl"] = "base"
    line_height: Literal["compact", "comfortable", "spacious"] = "comfortable"
    theme_preference: Literal["system", "light", "dark"] = "system"
    show_question_index: bool = True
    show_timing_indicator: bool = True
    show_overtime_warning: bool = True
    answer_panel_position: Literal["right", "bottom"] = "right"


class PacingPreferences(CamelModel):
    default_practice_mode: Literal["per_question", "full_set"] = "full_set"
    auto_advance_after_answer: bool = False
    auto_advance_delay_seconds: int = 1
    confirm_before_submit: bool = True
    confirm_when_unanswered_count_gte: int = 1

    @field_validator("auto_advance_delay_seconds")
    @classmethod
    def validate_auto_advance_delay_seconds(cls, value: int) -> int:
        if not 0 <= value <= 10:
            raise ValueError("auto_advance_delay_seconds must be between 0 and 10")
        return value

    @field_validator("confirm_when_unanswered_count_gte")
    @classmethod
    def validate_confirm_unanswered_threshold(cls, value: int) -> int:
        if value < 0:
            raise ValueError("confirm_when_unanswered_count_gte must be >= 0")
        return value


class AutoSavePreferences(CamelModel):
    enabled: bool = True
    interval_seconds: int = 30
    save_to_local_storage: bool = True

    @field_validator("interval_seconds")
    @classmethod
    def validate_interval_seconds(cls, value: int) -> int:
        if not 10 <= value <= 300:
            raise ValueError("interval_seconds must be between 10 and 300")
        return value


class KeyBindings(CamelModel):
    select_a: str = "a"
    select_b: str = "b"
    select_c: str = "c"
    select_d: str = "d"
    next_question: str = "ArrowRight"
    prev_question: str = "ArrowLeft"
    flag_uncertain: str = "f"
    favorite: str = "s"
    note: str = "n"
    submit: str = "Ctrl+Enter"

    @field_validator("*")
    @classmethod
    def validate_binding_shape(cls, value: str) -> str:
        if not _KEY_BINDING_PATTERN.match(value):
            raise ValueError("invalid key binding format")
        return value


class KeyboardPreferences(CamelModel):
    enabled: bool = True
    bindings: KeyBindings = Field(default_factory=KeyBindings)

    @field_validator("bindings")
    @classmethod
    def validate_unique_bindings(cls, value: KeyBindings) -> KeyBindings:
        keys = list(value.model_dump().values())
        if len(set(keys)) != len(keys):
            raise ValueError("KeyBindings must be unique across all actions")
        return value


class ReminderPreferences(CamelModel):
    daily_practice_reminder_enabled: bool = False
    daily_practice_reminder_time: str = "20:00"
    weekly_summary_reminder_enabled: bool = False
    overtime_threshold_seconds: int = 0
    long_session_break_reminder_minutes: int = 0

    @field_validator("daily_practice_reminder_time")
    @classmethod
    def validate_daily_practice_time(cls, value: str) -> str:
        if not _TIME_PATTERN.match(value):
            raise ValueError("daily_practice_reminder_time must be HH:MM")
        return value

    @field_validator("overtime_threshold_seconds")
    @classmethod
    def validate_overtime_threshold_seconds(cls, value: int) -> int:
        if value < 0:
            raise ValueError("overtime_threshold_seconds must be >= 0")
        return value

    @field_validator("long_session_break_reminder_minutes")
    @classmethod
    def validate_break_reminder_minutes(cls, value: int) -> int:
        if value < 0:
            raise ValueError("long_session_break_reminder_minutes must be >= 0")
        return value


class CustomPracticeDefaults(CamelModel):
    last_used_source_mode: Literal["real_exam", "ai_generated"] = "real_exam"
    last_used_year_range: Literal["all", "recent_3", "recent_5", "recent_10"] = "recent_3"
    last_used_difficulty_range: tuple[float, float] = (0.0, 1.0)
    last_used_count: Literal[5, 10, 15, 20, 30] = 10
    last_used_practice_mode: Literal["per_question", "full_set"] = "full_set"
    last_used_exclude_done: bool = True
    last_used_only_wrong: bool = False

    @field_validator("last_used_difficulty_range")
    @classmethod
    def validate_difficulty_range(cls, value: tuple[float, float]) -> tuple[float, float]:
        if len(value) != 2 or value[0] < 0.0 or value[1] > 1.0 or value[0] > value[1]:
            raise ValueError("last_used_difficulty_range must stay within [0.0, 1.0]")
        return value


class PracticePreferencesPayloadV1(CamelModel):
    ui: UiPreferences = Field(default_factory=UiPreferences)
    pacing: PacingPreferences = Field(default_factory=PacingPreferences)
    auto_save: AutoSavePreferences = Field(default_factory=AutoSavePreferences)
    keyboard: KeyboardPreferences = Field(default_factory=KeyboardPreferences)
    reminders: ReminderPreferences = Field(default_factory=ReminderPreferences)
    custom_practice: CustomPracticeDefaults = Field(default_factory=CustomPracticeDefaults)


class PracticePreferencesResponseV2(CamelModel):
    schema_version: int
    payload: PracticePreferencesPayloadV1
    is_default: bool
    updated_at: UtcDatetime | None = None


class PracticePreferencesPatchV2(CamelModel):
    path: str = Field(min_length=1, max_length=128)
    value: Any


class PracticePreferencesResetRequestV2(CamelModel):
    sections: list[str] = Field(default_factory=list)


class QuestionReportCreateRequestV2(CamelModel):
    category: QuestionReportCategory
    description: str = Field(
        min_length=QUESTION_REPORT_DESCRIPTION_MIN_LENGTH,
        max_length=QUESTION_REPORT_DESCRIPTION_MAX_LENGTH,
    )
    source_session_id: int | None = None
    selected_answer_at_report: Any | None = None


class QuestionReportUpdateRequestV2(CamelModel):
    description: str = Field(
        min_length=QUESTION_REPORT_DESCRIPTION_MIN_LENGTH,
        max_length=QUESTION_REPORT_DESCRIPTION_MAX_LENGTH,
    )


class QuestionReportEnvelopeV2(CamelModel):
    id: int
    question_id: int
    category: QuestionReportCategory
    description: str
    status: QuestionReportStatus
    admin_response: str | None = None
    duplicate_of_report_id: int | None = None
    applied_fix: dict[str, Any] | None = None
    source_session_id: int | None = None
    selected_answer_at_report: Any | None = None
    created_at: UtcDatetime
    updated_at: UtcDatetime
    handled_at: UtcDatetime | None = None


class QuestionReportListResponseV2(CamelModel):
    items: list[QuestionReportEnvelopeV2]
    total: int
    page: int
    page_size: int


class QuestionReportOptionFixEntryV2(CamelModel):
    key: str = Field(min_length=1, max_length=16)
    text: str = Field(min_length=1, max_length=2000)


class QuestionReportAdminUpdateRequestV2(CamelModel):
    status: Literal[
        QuestionReportStatus.ACKNOWLEDGED,
        QuestionReportStatus.RESOLVED_INVALID,
        QuestionReportStatus.RESOLVED_DUPLICATE,
    ]
    admin_response: str | None = Field(default=None, min_length=1, max_length=1000)
    duplicate_of_report_id: int | None = None


class QuestionReportApplyFixRequestV2(CamelModel):
    field: QuestionReportFixField
    admin_response: str = Field(min_length=1, max_length=1000)
    text_after: str | None = Field(default=None, min_length=1, max_length=4000)
    options_after: list[QuestionReportOptionFixEntryV2] = Field(default_factory=list)

    @field_validator("options_after")
    @classmethod
    def validate_options_after(
        cls,
        values: list[QuestionReportOptionFixEntryV2],
    ) -> list[QuestionReportOptionFixEntryV2]:
        seen: set[str] = set()
        for item in values:
            if item.key in seen:
                raise ValueError("options_after must not repeat option keys")
            seen.add(item.key)
        return values


class QuestionReportAdminItemV2(CamelModel):
    id: int
    question_id: int
    category: QuestionReportCategory
    description: str
    status: QuestionReportStatus
    reporter_user_id: int
    reporter_display_name: str | None = None
    question_prompt: str
    question_source: str
    question_is_active: bool
    active_report_count: int
    admin_response: str | None = None
    duplicate_of_report_id: int | None = None
    applied_fix: dict[str, Any] | None = None
    source_session_id: int | None = None
    selected_answer_at_report: Any | None = None
    created_at: UtcDatetime
    updated_at: UtcDatetime
    handled_at: UtcDatetime | None = None


class QuestionReportAdminListResponseV2(CamelModel):
    items: list[QuestionReportAdminItemV2]
    total: int
    pending_count: int
    page: int
    page_size: int


class EssayReferenceAnswerEnvelopeV2(CamelModel):
    id: int
    question_id: int
    content: str
    source: str
    likes_count: int
    favorites_count: int
    report_count: int
    quality_score: float
    status: str
    published_at: UtcDatetime | None = None


class GradingDimensionV2(CamelModel):
    name: str
    score: float | None = None
    full_score: float | None = None
    comment: str | None = None


class EssayReportEnvelopeV2(CamelModel):
    total_score: float
    dimensions: list[GradingDimensionV2] = Field(default_factory=list)
    highlights: list[str] = Field(default_factory=list)
    issues: list[str] = Field(default_factory=list)
    overall_comment: str
    improvement_suggestions: list[str] = Field(default_factory=list)
    graded_at: UtcDatetime
    llm_call_id: int


class EssayGradingResponseV2(CamelModel):
    submission_id: int
    status: str
    report: EssayReportEnvelopeV2 | None = None
    reference_answers: list[EssayReferenceAnswerEnvelopeV2] = Field(default_factory=list)
    error_message: str | None = None


class AiQuestionsGenerateResponseV2(CamelModel):
    request_id: int
    question_ids: list[int] = Field(default_factory=list)
    status: str
    duration_ms: int
    pool_count: int
    llm_generated_count: int


class DailyPracticeResponseV2(CamelModel):
    id: int
    date: date
    type: Literal["xingce", "essay"]
    question_count: int
    status: str
    completed_session_id: int | None = None
    completed_accuracy: float | None = None


class ProfileOverviewResponseV2(CamelModel):
    summary: list[SummaryMetricV2]
    sections: list[SectionCardV2]
    actions: list[ActionLinkV2]


class ProfileSecurityResponseV2(CamelModel):
    password_set: bool
    email_bound: bool
    phone_bound: bool
    active_sessions: int


class ProfileSecurityUpdateRequestV2(CamelModel):
    current_password: str = Field(min_length=6, max_length=255)
    new_password: str = Field(min_length=6, max_length=255)


class ExamTargetV2(CamelModel):
    exam_id: str = Field(min_length=1, max_length=64)
    exam_name: str = Field(min_length=1, max_length=120)
    exam_date: date
    subjects: list[str] = Field(default_factory=list)


class ProfileGoalsResponseV2(CamelModel):
    target_exam: str | None = None
    target_score: Decimal | None = None
    weekly_target_hours: int | None = None
    exam_targets: list[ExamTargetV2] = Field(default_factory=list)


class ProfileGoalsUpdateRequestV2(CamelModel):
    target_exam: str | None = None
    target_score: Decimal | None = None
    weekly_target_hours: int | None = None
    exam_targets: list[ExamTargetV2] | None = None


class OnboardingStatusV2(CamelModel):
    has_goal: bool
    has_exam: bool
    is_onboarded: bool


class ProfileInfoResponseV2(CamelModel):
    display_name: str
    real_name: str | None = None
    region: str | None = None
    bio: str | None = None
    ai_adjust_enabled: bool = True
    dashboard_preferences: dict[str, Any] = Field(default_factory=dict)
    recommender_preferences: dict[str, Any] = Field(default_factory=dict)


class ProfileInfoUpdateRequestV2(CamelModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=255)
    real_name: str | None = Field(default=None, max_length=255)
    region: str | None = Field(default=None, max_length=128)
    bio: str | None = Field(default=None, max_length=2000)
    ai_adjust_enabled: bool | None = None
    dashboard_preferences: dict[str, Any] | None = None
    recommender_preferences: dict[str, Any] | None = None


class PlanReadV2(CamelModel):
    id: int
    name: str
    target_exam_id: str
    target_exam_date: date
    daily_minutes_target: int
    style: str
    baseline: dict[str, Any] = Field(default_factory=dict)
    focus_subjects: list[str] = Field(default_factory=list)
    status: str
    source: str
    change_log: list[dict[str, Any]] = Field(default_factory=list)
    deleted_at: UtcDatetime | None = None
    archived_at: UtcDatetime | None = None
    created_at: UtcDatetime
    updated_at: UtcDatetime


class PlanListResponseV2(CamelModel):
    items: list[PlanReadV2]
    total: int


class PlanCreateRequestV2(CamelModel):
    name: str = Field(min_length=1, max_length=120)
    target_exam_id: str = Field(min_length=1, max_length=64)
    target_exam_date: date
    daily_minutes_target: int = Field(ge=60, le=720)
    style: str = Field(min_length=1, max_length=32)
    baseline: dict[str, Any] = Field(default_factory=dict)
    focus_subjects: list[str] = Field(default_factory=list)


class PlanUpdateRequestV2(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    target_exam_date: date | None = None
    daily_minutes_target: int | None = Field(default=None, ge=60, le=720)
    style: str | None = Field(default=None, min_length=1, max_length=32)
    focus_subjects: list[str] | None = None


class PlanAutoGenerateRequestV2(CamelModel):
    name: str = Field(min_length=1, max_length=120)
    target_exam_id: str = Field(min_length=1, max_length=64)
    target_exam_date: date
    daily_minutes_target: int = Field(ge=60, le=720)
    style: str = Field(min_length=1, max_length=32)
    baseline: dict[str, Any] = Field(default_factory=dict)
    focus_subjects: list[str] = Field(default_factory=list)
    user_notes: str = Field(default="", max_length=4000)


class PlanRegenerateRangeRequestV2(CamelModel):
    plan_id: int
    from_date: date = Field(alias="from")
    to: date
    user_notes: str = Field(default="", max_length=4000)


class PlanEventReadV2(CamelModel):
    id: str
    plan_id: int
    title: str
    category: str
    notes: str = ""
    start_at: UtcDatetime
    end_at: UtcDatetime
    timezone: str
    status: str
    source: str
    parent_id: int | None = None
    recurring_rule: str | None = None
    recurring_parent_id: int | None = None
    recurring_exception_dates: list[str] = Field(default_factory=list)
    linked_session_id: int | None = None
    target_id: int | None = None
    deleted_at: UtcDatetime | None = None
    is_recurring_instance: bool = False


class PracticeBlockV2(CamelModel):
    id: str
    session_id: int
    start_at: UtcDatetime
    end_at: UtcDatetime
    items_count: int
    accuracy: Decimal | None = None
    category: str
    subject: str | None = None
    is_in_progress: bool


class EventWindowDataV2(CamelModel):
    events: list[PlanEventReadV2]
    practice_blocks: list[PracticeBlockV2] = Field(default_factory=list)


class EventWindowMetaV2(CamelModel):
    from_date: date = Field(alias="from")
    to: date
    include_practice_blocks: bool
    tz: str


class EventWindowResponseV2(CamelModel):
    data: EventWindowDataV2
    meta: EventWindowMetaV2


class PlanEventCreateRequestV2(CamelModel):
    plan_id: int
    title: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=32)
    notes: str = ""
    start_at: UtcDatetime
    end_at: UtcDatetime
    timezone: str = Field(default="Asia/Shanghai", min_length=1, max_length=64)
    recurring_rule: str | None = None
    source: str = Field(default="user_manual", min_length=1, max_length=32)
    target_id: int | None = None


class PlanEventUpdateRequestV2(CamelModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    category: str | None = Field(default=None, min_length=1, max_length=32)
    notes: str | None = None
    start_at: UtcDatetime | None = None
    end_at: UtcDatetime | None = None
    timezone: str | None = Field(default=None, min_length=1, max_length=64)
    status: Literal["planned", "in_progress", "done", "skipped"] | None = None
    recurring_rule: str | None = None
    target_id: int | None = None


class PlanEventBulkDeleteRequestV2(CamelModel):
    plan_id: int | None = None
    from_date: date | None = Field(default=None, alias="from")
    to: date | None = None
    source: str | None = None
    dry_run: bool = False


class PlanEventBulkDeleteResponseV2(CamelModel):
    ok: bool
    status: str
    matched_ids: list[str] = Field(default_factory=list)


class ProposedPlanEventV2(CamelModel):
    title: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=32)
    start_at: UtcDatetime
    end_at: UtcDatetime
    recurring_rule: str | None = None
    timezone: str = Field(default="Asia/Shanghai", min_length=1, max_length=64)


class ExistingWindowV2(CamelModel):
    from_date: date = Field(alias="from")
    to: date


class EventConflictsRequestV2(CamelModel):
    events: list[ProposedPlanEventV2] = Field(default_factory=list)
    existing_window: ExistingWindowV2 | None = None


class EventConflictItemV2(CamelModel):
    kind: str
    source_id: str
    start_at: UtcDatetime
    end_at: UtcDatetime
    title: str


class EventConflictsResponseV2(CamelModel):
    conflicts: list[EventConflictItemV2] = Field(default_factory=list)


class PlanAdjustmentReadV2(CamelModel):
    id: int
    plan_id: int
    user_id: int
    proposed_at: UtcDatetime
    expires_at: UtcDatetime
    decided_at: UtcDatetime | None = None
    reason: str
    changes: list[dict[str, Any]] = Field(default_factory=list)
    status: str
    source: str
    user_reject_reason: str | None = None
    llm_call_id: int | None = None


class PlanAdjustmentListResponseV2(CamelModel):
    items: list[PlanAdjustmentReadV2]
    total: int


class PlanAdjustmentRejectRequestV2(CamelModel):
    reason: str | None = Field(default=None, max_length=500)


class RecommendationReadV2(CamelModel):
    id: int
    title: str
    reason: str
    estimated_minutes: int
    cta: str
    action_type: str
    payload: dict[str, Any] = Field(default_factory=dict)
    generated_at: UtcDatetime
    expires_at: UtcDatetime
    served_count: int
    status: str
    accepted_at: UtcDatetime | None = None
    rejected_at: UtcDatetime | None = None
    source_signals: dict[str, Any] = Field(default_factory=dict)
    llm_call_id: int | None = None


class RecommendationListResponseV2(CamelModel):
    items: list[RecommendationReadV2]
    total: int


class RecommendationAcceptRequestV2(CamelModel):
    action: Literal["session", "plan"]
    target_date: date | None = None


class RecommendationAcceptResponseV2(CamelModel):
    recommendation_id: int
    status: str
    session_id: int | None = None
    event_id: int | None = None
    redirect_url: str | None = None


class RecommendationRejectRequestV2(CamelModel):
    reason: str = Field(min_length=1, max_length=40)
    note: str | None = Field(default=None, max_length=500)


class LearningRecordItemV2(CamelModel):
    id: str
    kind: str
    title: str
    status: str
    href: str
    score: Decimal | None = None
    occurred_at: UtcDatetime


class LearningRecordListResponseV2(CamelModel):
    items: list[LearningRecordItemV2]
    total: int
    page: int
    page_size: int


class LearningRecordSummaryV2(CamelModel):
    total_attempts: int
    xingce_attempts: int
    essay_attempts: int
    completed_attempts: int
    avg_xingce_accuracy: Decimal | None = None
    avg_essay_score: Decimal | None = None


class DashboardRecordsResponseV2(CamelModel):
    summary: LearningRecordSummaryV2
    sections: list[SectionCardV2]
    actions: list[ActionLinkV2]
    items: list[LearningRecordItemV2]
    total: int
    page: int
    page_size: int


class ProfileSettingsResponseV2(CamelModel):
    ai_adjust_enabled: bool
    llm_enabled: bool


class ProfileSettingsUpdateRequestV2(CamelModel):
    ai_adjust_enabled: bool


class ProfilePreferencesResponseV2(CamelModel):
    dashboard_preferences: dict[str, Any]


class ProfilePreferencesUpdateRequestV2(CamelModel):
    dashboard_preferences: dict[str, Any]

    @field_validator("dashboard_preferences")
    @classmethod
    def validate_preferences_size(cls, v: dict[str, Any]) -> dict[str, Any]:
        serialized = json.dumps(v)
        if len(serialized) > 65536:
            raise ValueError("dashboard_preferences must be <= 64KB when serialized")
        return v


class DeletionReason(str):
    NOT_USEFUL = "not_useful"
    FOUND_ALTERNATIVE = "alternative"
    PRIVACY_CONCERN = "privacy"
    TOO_EXPENSIVE = "too_expensive"
    OTHER = "other"


class AccountDeletionRequestV2(CamelModel):
    reason: str = Field(default="other", max_length=32)
    confirmation: str = Field(min_length=1, max_length=20)


class AccountDeletionResponseV2(CamelModel):
    message: str
    hard_delete_at: UtcDatetime


class BindPhoneRequestV2(CamelModel):
    phone: str = Field(pattern=r"^1[3-9]\d{9}$")
    verification_code: str = Field(min_length=4, max_length=6)


class BindPhoneResponseV2(CamelModel):
    phone_bound: bool
    masked_phone: str


class SubjectAccuracyV2(CamelModel):
    subject_key: str
    subject_label: str
    answered: int
    correct: int
    accuracy: Decimal | None = None


class WeaknessItemV2(CamelModel):
    subject_key: str
    subject_label: str
    answered: int
    correct: int
    accuracy: Decimal | None = None
    severity: str
    trend: str


class ProgressMetricBucketV2(CamelModel):
    minutes_practiced: int
    items_answered: int
    accuracy: Decimal | None = None
    sessions_count: int


class ProgressPlanSliceV2(CamelModel):
    plan_id: int | None = None
    range_from: date | None = None
    range_to: date | None = None
    events_in_window_total: int
    events_done: int
    events_skipped: int
    minutes_target_in_window: int
    minutes_practiced_in_window: int


class ExamCountdownV2(CamelModel):
    exam_id: str
    exam_name: str
    exam_date: date
    days_until: int


class DashboardProgressSummaryV2(CamelModel):
    today: ProgressMetricBucketV2
    week: ProgressMetricBucketV2
    all_time: ProgressMetricBucketV2
    plan_slice: ProgressPlanSliceV2


class DashboardProgressResponseV2(CamelModel):
    summary: DashboardProgressSummaryV2
    weakness_top3: list[WeaknessItemV2] = Field(default_factory=list)
    subject_accuracies: list[SubjectAccuracyV2] = Field(default_factory=list)
    nearest_exam_target: ExamCountdownV2 | None = None


class ProgressTimeseriesPointV2(CamelModel):
    bucket_start: date
    bucket_end: date
    minutes_practiced: int
    items_answered: int
    accuracy: Decimal | None = None
    sessions_count: int


class ProgressTimeseriesResponseV2(CamelModel):
    from_date: date = Field(alias="from")
    to: date
    granularity: Literal["day", "week"]
    points: list[ProgressTimeseriesPointV2] = Field(default_factory=list)


class ProgressWeaknessResponseV2(CamelModel):
    items: list[WeaknessItemV2] = Field(default_factory=list)


class ProgressDiagnosisResponseV2(CamelModel):
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    generated_at: UtcDatetime


class DashboardPlanWindowSummaryV2(CamelModel):
    total_events: int
    planned_count: int
    in_progress_count: int
    done_count: int
    skipped_count: int
    event_minutes_total: int
    practice_minutes_total: int
    completion_rate: Decimal | None = None


class DashboardTodayResponseV2(CamelModel):
    date: date
    plan_id: int | None = None
    summary: DashboardPlanWindowSummaryV2
    events: list[PlanEventReadV2] = Field(default_factory=list)
    practice_blocks: list[PracticeBlockV2] = Field(default_factory=list)
    nearest_exam_target: ExamCountdownV2 | None = None


class DashboardContinueResponseV2(CamelModel):
    has_active_session: bool
    session_id: int | None = None
    track: str | None = None
    entry_kind: str | None = None
    status: str | None = None
    started_at: UtcDatetime | None = None
    href: str | None = None


class DashboardReviewResponseV2(CamelModel):
    items: list[ReviewItemV2] = Field(default_factory=list)
    total: int


class DashboardWeeklyPlanResponseV2(CamelModel):
    week_start: date
    week_end: date
    plan_id: int | None = None
    summary: DashboardPlanWindowSummaryV2
    events: list[PlanEventReadV2] = Field(default_factory=list)
    practice_blocks: list[PracticeBlockV2] = Field(default_factory=list)
    nearest_exam_target: ExamCountdownV2 | None = None


class DashboardTodayCompletionResponseV2(CamelModel):
    date: date
    total_events: int
    done_events: int
    completion_rate: Decimal | None = None


class DashboardWeeklyAdjustRequestV2(CamelModel):
    daily_minutes_target: int | None = Field(default=None, ge=60, le=720)
    style: str | None = Field(default=None, min_length=1, max_length=32)
    focus_subjects: list[str] | None = None


class DashboardFullPlanResponseV2(CamelModel):
    view: Literal["today", "week", "month"]
    anchor_date: date
    from_date: date = Field(alias="from")
    to: date
    plan_id: int | None = None
    summary: DashboardPlanWindowSummaryV2
    events: list[PlanEventReadV2] = Field(default_factory=list)
    practice_blocks: list[PracticeBlockV2] = Field(default_factory=list)
    targets: list[ExamCountdownV2] = Field(default_factory=list)
