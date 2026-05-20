from __future__ import annotations

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


class PracticeSessionItemV2(CamelModel):
    id: str
    question_key: str | None = None
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


class ProfileGoalsResponseV2(CamelModel):
    target_exam: str | None = None
    target_score: Decimal | None = None
    weekly_target_hours: int | None = None


class ProfileGoalsUpdateRequestV2(CamelModel):
    target_exam: str | None = None
    target_score: Decimal | None = None
    weekly_target_hours: int | None = None


class ProfileInfoResponseV2(CamelModel):
    display_name: str
    real_name: str | None = None
    region: str | None = None
    bio: str | None = None


class ProfileInfoUpdateRequestV2(CamelModel):
    display_name: str = Field(min_length=1, max_length=255)
    real_name: str | None = Field(default=None, max_length=255)
    region: str | None = Field(default=None, max_length=128)
    bio: str | None = Field(default=None, max_length=2000)


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
