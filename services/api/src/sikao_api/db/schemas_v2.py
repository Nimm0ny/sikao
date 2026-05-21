from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Literal

from pydantic import Field

from sikao_api.core.schemas import CamelModel, UtcDatetime


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
    purpose: Literal["register", "reset_password", "login", "bind"]


class SendCodeResponseV2(CamelModel):
    ok: bool
    purpose: str
    delivery: str


class VerifyCodeRequestV2(CamelModel):
    target_kind: Literal["email", "phone"]
    target_value: str = Field(min_length=3, max_length=255)
    purpose: Literal["register", "reset_password", "login", "bind"]
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
    paper_code: str | None = None
    question_ids: list[int] = Field(default_factory=list)
    payload: dict[str, Any] = Field(default_factory=dict)
    linked_plan_event_id: int | None = None
    linked_plan_event_occurrence_ref: str | None = Field(default=None, max_length=64)
    linked_recommendation_id: int | None = None


class PracticeSessionItemV2(CamelModel):
    id: str
    question_key: str
    prompt: str
    answer_kind: str
    status: str


class PracticeSessionEnvelopeV2(CamelModel):
    id: int
    track: str
    entry_kind: str
    status: str
    items: list[PracticeSessionItemV2]
    actions: list[ActionLinkV2]
    started_at: UtcDatetime
    submitted_at: UtcDatetime | None = None


class PracticeAnswerPayloadV2(CamelModel):
    question_key: str = Field(min_length=1, max_length=64)
    answer: dict[str, Any] = Field(default_factory=dict)
    duration_seconds: int | None = None


class PracticeAnswerUpsertRequestV2(CamelModel):
    answers: list[PracticeAnswerPayloadV2] = Field(default_factory=list)


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


class ReviewListResponseV2(CamelModel):
    items: list[ReviewItemV2]
    total: int
    page: int
    page_size: int


class ReviewAttemptOutV2(CamelModel):
    id: int
    outcome: str
    attempted_at: UtcDatetime


class ReviewDetailResponseV2(CamelModel):
    item: ReviewItemV2
    history: list[ReviewAttemptOutV2]
    actions: list[ActionLinkV2]


class NoteItemV2(CamelModel):
    id: int
    title: str
    excerpt: str
    status: str
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
    created_at: UtcDatetime
    updated_at: UtcDatetime


class NoteCreateRequestV2(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    body: str = Field(default="")


class NoteUpdateRequestV2(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    body: str = Field(default="")
    status: str = Field(default="active")


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


class DashboardTodayResponseV2(OverviewResponseV2):
    pass


class DashboardWeeklyPlanResponseV2(OverviewResponseV2):
    pass


class DashboardProgressResponseV2(OverviewResponseV2):
    pass
