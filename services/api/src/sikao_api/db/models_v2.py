from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from sikao_api.db.base import Base
from sqlalchemy import JSON


JSONB_COMPAT = JSON().with_variant(JSONB(), "postgresql")


def utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class UserV2(Base):
    __tablename__ = "users_v2"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    public_id: Mapped[str] = mapped_column(String(36), unique=True, nullable=False, default=lambda: str(uuid4()))
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )

    password_credential: Mapped[PasswordCredentialV2 | None] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    email_contacts: Mapped[list[EmailContactV2]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    phone_contacts: Mapped[list[PhoneContactV2]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    auth_sessions: Mapped[list[AuthSessionV2]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class PasswordCredentialV2(Base):
    __tablename__ = "password_credentials_v2"
    __table_args__ = (UniqueConstraint("user_id", name="uq_password_credentials_v2_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )

    user: Mapped[UserV2] = relationship(back_populates="password_credential")


class EmailContactV2(Base):
    __tablename__ = "email_contacts_v2"
    __table_args__ = (
        UniqueConstraint("email", name="uq_email_contacts_v2_email"),
        Index("ix_email_contacts_v2_user", "user_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )

    user: Mapped[UserV2] = relationship(back_populates="email_contacts")


class PhoneContactV2(Base):
    __tablename__ = "phone_contacts_v2"
    __table_args__ = (
        UniqueConstraint("phone", name="uq_phone_contacts_v2_phone"),
        Index("ix_phone_contacts_v2_user", "user_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    phone: Mapped[str] = mapped_column(String(32), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )

    user: Mapped[UserV2] = relationship(back_populates="phone_contacts")


class AuthSessionV2(Base):
    __tablename__ = "auth_sessions_v2"
    __table_args__ = (
        UniqueConstraint("token_hash", name="uq_auth_sessions_v2_token_hash"),
        Index("ix_auth_sessions_v2_user", "user_id"),
        Index("ix_auth_sessions_v2_expires", "expires_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    csrf_token: Mapped[str] = mapped_column(String(128), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped[UserV2] = relationship(back_populates="auth_sessions")


class VerificationTokenV2(Base):
    __tablename__ = "verification_tokens_v2"
    __table_args__ = (
        Index("ix_verification_tokens_v2_target", "target_kind", "target_value", "purpose"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    target_kind: Mapped[str] = mapped_column(String(16), nullable=False)
    target_value: Mapped[str] = mapped_column(String(255), nullable=False)
    purpose: Mapped[str] = mapped_column(String(32), nullable=False)
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)


class PaperV2(Base):
    __tablename__ = "papers_v2"
    __table_args__ = (
        UniqueConstraint("paper_code", name="uq_papers_v2_code"),
        Index("ix_papers_v2_subject", "subject_kind"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    paper_code: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    subject_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class PaperRevisionV2(Base):
    __tablename__ = "paper_revisions_v2"
    __table_args__ = (
        UniqueConstraint("paper_id", "revision_number", name="uq_paper_revisions_v2_number"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    paper_id: Mapped[int] = mapped_column(ForeignKey("papers_v2.id", ondelete="CASCADE"), nullable=False)
    revision_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)


class PaperSectionV2(Base):
    __tablename__ = "paper_sections_v2"
    __table_args__ = (
        UniqueConstraint("revision_id", "section_key", name="uq_paper_sections_v2_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    revision_id: Mapped[int] = mapped_column(ForeignKey("paper_revisions_v2.id", ondelete="CASCADE"), nullable=False)
    section_key: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)


class PaperBlockV2(Base):
    __tablename__ = "paper_blocks_v2"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    revision_id: Mapped[int] = mapped_column(ForeignKey("paper_revisions_v2.id", ondelete="CASCADE"), nullable=False)
    section_id: Mapped[int] = mapped_column(ForeignKey("paper_sections_v2.id", ondelete="CASCADE"), nullable=False)
    block_kind: Mapped[str] = mapped_column(String(64), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)


class MaterialGroupV2(Base):
    __tablename__ = "material_groups_v2"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    revision_id: Mapped[int] = mapped_column(ForeignKey("paper_revisions_v2.id", ondelete="CASCADE"), nullable=False)
    block_id: Mapped[int] = mapped_column(ForeignKey("paper_blocks_v2.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content_json: Mapped[dict[str, Any]] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)


class MaterialGroupAssetV2(Base):
    __tablename__ = "material_group_assets_v2"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    material_group_id: Mapped[int] = mapped_column(
        ForeignKey("material_groups_v2.id", ondelete="CASCADE"), nullable=False
    )
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=1, nullable=False)


class QuestionV2(Base):
    __tablename__ = "questions_v2"
    __table_args__ = (
        UniqueConstraint("revision_id", "item_no", name="uq_questions_v2_item_no"),
        Index("ix_questions_v2_subject", "subject_kind"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    revision_id: Mapped[int] = mapped_column(ForeignKey("paper_revisions_v2.id", ondelete="CASCADE"), nullable=False)
    section_id: Mapped[int | None] = mapped_column(ForeignKey("paper_sections_v2.id", ondelete="SET NULL"))
    block_id: Mapped[int | None] = mapped_column(ForeignKey("paper_blocks_v2.id", ondelete="SET NULL"))
    material_group_id: Mapped[int | None] = mapped_column(
        ForeignKey("material_groups_v2.id", ondelete="SET NULL"), nullable=True
    )
    item_no: Mapped[int] = mapped_column(Integer, nullable=False)
    subject_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    answer_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    content_json: Mapped[dict[str, Any]] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class QuestionOptionV2(Base):
    __tablename__ = "question_options_v2"
    __table_args__ = (
        UniqueConstraint("question_id", "option_key", name="uq_question_options_v2_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions_v2.id", ondelete="CASCADE"), nullable=False)
    option_key: Mapped[str] = mapped_column(String(16), nullable=False)
    option_text: Mapped[str] = mapped_column(Text, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)


class QuestionAssetV2(Base):
    __tablename__ = "question_assets_v2"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions_v2.id", ondelete="CASCADE"), nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=1, nullable=False)


class PracticeSessionV2(Base):
    __tablename__ = "practice_sessions_v2"
    __table_args__ = (
        Index("ix_practice_sessions_v2_user_started", "user_id", "started_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    track: Mapped[str] = mapped_column(String(32), nullable=False)
    entry_kind: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    paper_id: Mapped[int | None] = mapped_column(ForeignKey("papers_v2.id", ondelete="SET NULL"), nullable=True)
    revision_id: Mapped[int | None] = mapped_column(
        ForeignKey("paper_revisions_v2.id", ondelete="SET NULL"), nullable=True
    )
    payload_json: Mapped[dict[str, Any]] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class PracticeSessionAnswerV2(Base):
    __tablename__ = "practice_session_answers_v2"
    __table_args__ = (
        Index("ix_practice_session_answers_v2_session", "session_id", "display_order"),
        UniqueConstraint(
            "session_id",
            "question_key",
            name="uq_practice_session_answers_v2_session_question_key",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("practice_sessions_v2.id", ondelete="CASCADE"), nullable=False
    )
    question_id: Mapped[int | None] = mapped_column(
        ForeignKey("questions_v2.id", ondelete="SET NULL"), nullable=True
    )
    question_key: Mapped[str] = mapped_column(String(64), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)
    response_json: Mapped[dict[str, Any]] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    is_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    answered_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)


class EssayDraftV2(Base):
    __tablename__ = "essay_drafts_v2"
    __table_args__ = (
        UniqueConstraint("user_id", "question_id", name="uq_essay_drafts_v2_user_question"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    question_id: Mapped[int | None] = mapped_column(
        ForeignKey("questions_v2.id", ondelete="SET NULL"), nullable=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    saved_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class EssaySubmissionV2(Base):
    __tablename__ = "essay_submissions_v2"
    __table_args__ = (
        Index("ix_essay_submissions_v2_user_submitted", "user_id", "submitted_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    question_id: Mapped[int | None] = mapped_column(
        ForeignKey("questions_v2.id", ondelete="SET NULL"), nullable=True
    )
    practice_session_id: Mapped[int | None] = mapped_column(
        ForeignKey("practice_sessions_v2.id", ondelete="SET NULL"), nullable=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="submitted")
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)


class EssayReportV2(Base):
    __tablename__ = "essay_reports_v2"
    __table_args__ = (
        UniqueConstraint("submission_id", name="uq_essay_reports_v2_submission"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    submission_id: Mapped[int] = mapped_column(
        ForeignKey("essay_submissions_v2.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    feedback_json: Mapped[dict[str, Any]] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class DailyPlanV2(Base):
    __tablename__ = "daily_plans_v2"
    __table_args__ = (
        UniqueConstraint("user_id", "plan_date", name="uq_daily_plans_v2_user_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    plan_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class DailyPlanItemV2(Base):
    __tablename__ = "daily_plan_items_v2"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    daily_plan_id: Mapped[int] = mapped_column(ForeignKey("daily_plans_v2.id", ondelete="CASCADE"), nullable=False)
    item_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    state: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)


class WeeklyPlanV2(Base):
    __tablename__ = "weekly_plans_v2"
    __table_args__ = (
        UniqueConstraint("user_id", "week_start", name="uq_weekly_plans_v2_user_week"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    week_start: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    summary_json: Mapped[dict[str, Any]] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class DiagnosisReportV2(Base):
    __tablename__ = "diagnosis_reports_v2"
    __table_args__ = (Index("ix_diagnosis_reports_v2_user_created", "user_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary_json: Mapped[dict[str, Any]] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)


class ProgressSnapshotV2(Base):
    __tablename__ = "progress_snapshots_v2"
    __table_args__ = (
        UniqueConstraint("user_id", "snapshot_date", name="uq_progress_snapshots_v2_user_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False)
    data_json: Mapped[dict[str, Any]] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)


class WeaknessSnapshotV2(Base):
    __tablename__ = "weakness_snapshots_v2"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "snapshot_date",
            "subject_key",
            name="uq_weakness_snapshots_v2_user_date_subject",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False)
    subject_key: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(String(32), nullable=False, default="low")
    data_json: Mapped[dict[str, Any]] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)


class ReviewItemV2(Base):
    __tablename__ = "review_items_v2"
    __table_args__ = (
        Index("ix_review_items_v2_user_created", "user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    source_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    source_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    question_id: Mapped[int | None] = mapped_column(ForeignKey("questions_v2.id", ondelete="SET NULL"), nullable=True)
    essay_submission_id: Mapped[int | None] = mapped_column(
        ForeignKey("essay_submissions_v2.id", ondelete="SET NULL"), nullable=True
    )
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class ReviewAttemptV2(Base):
    __tablename__ = "review_attempts_v2"
    __table_args__ = (
        Index("ix_review_attempts_v2_item_attempted", "review_item_id", "attempted_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    review_item_id: Mapped[int] = mapped_column(ForeignKey("review_items_v2.id", ondelete="CASCADE"), nullable=False)
    outcome: Mapped[str] = mapped_column(String(32), nullable=False)
    notes_json: Mapped[dict[str, Any]] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    attempted_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)


class NoteV2(Base):
    __tablename__ = "notes_v2"
    __table_args__ = (
        Index("ix_notes_v2_user_updated", "user_id", "updated_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class NoteLinkV2(Base):
    __tablename__ = "note_links_v2"
    __table_args__ = (
        Index("ix_note_links_v2_note", "note_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    note_id: Mapped[int] = mapped_column(ForeignKey("notes_v2.id", ondelete="CASCADE"), nullable=False)
    link_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    link_target_id: Mapped[str] = mapped_column(String(64), nullable=False)


class ProfileInfoV2(Base):
    __tablename__ = "profile_infos_v2"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_profile_infos_v2_user"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    real_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    region: Mapped[str | None] = mapped_column(String(128), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class ProfileGoalV2(Base):
    __tablename__ = "profile_goals_v2"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_profile_goals_v2_user"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    target_exam: Mapped[str | None] = mapped_column(String(128), nullable=True)
    target_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    weekly_target_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )
