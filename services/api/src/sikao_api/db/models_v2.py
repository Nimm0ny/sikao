from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    false,
    text,
    true,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from sikao_api.db.base import Base
from sikao_api.db.enums_v2 import CauseAnalysisScope, ReviewItemStatus
from sikao_api.modules.question_reports.domain.types import QuestionReportStatus
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
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    deletion_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

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
        # Phase-Practice WU-B10.1 (Tab 2): twin-axis category index for category
        # browsing endpoints; (l1, l2) covers both l1-only and l1+l2 lookups.
        Index("ix_questions_v2_category", "category_l1", "category_l2"),
        # Phase-Practice WU-B10.1: (year, region, exam_type) covers the typical
        # paper filter combo on /practice/xingce/papers and /practice/essay/papers.
        Index(
            "ix_questions_v2_year_region_exam",
            "year",
            "region",
            "exam_type",
        ),
        # Phase-Practice WU-B10.3: (source, is_active) is the picker's hottest
        # filter; the single-col is_active index from B10.2 still serves the
        # source-agnostic queries.
        Index("ix_questions_v2_source_active", "source", "is_active"),
        # WU-B10.3: content_hash UNIQUE for cross-source dedup. Multiple NULLs
        # are allowed by both PG and SQLite, so dedup losers can keep their
        # row by NULLing this field.
        UniqueConstraint("content_hash", name="uq_questions_v2_content_hash"),
        Index("ix_questions_v2_heat", "heat_score"),
        CheckConstraint(
            "complexity_level IS NULL OR (complexity_level >= 1 AND complexity_level <= 5)",
            name="ck_q_v2_complexity_range",
        ),
        CheckConstraint("heat_score >= 0.0", name="ck_q_v2_heat_non_negative"),
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

    # Phase-Practice WU-B10.1 (Tab 2): question source + exam classification.
    # Source distinguishes real_exam vs ai_generated/ai_modified items so the
    # session picker, recommender, and stats aggregator can treat them
    # consistently while remaining auditable. Allowed values are enforced in
    # application layer (no DB enum, matching PlanV2.source convention) and the
    # value is logically immutable post-create — the DB-level immutable trigger
    # is added in WU-B10.3 once content_hash backfill completes.
    source: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="real_exam",
        server_default="real_exam",
    )
    # year / region intentionally nullable: AI-generated items have no
    # provenance year and not every official paper carries a region (e.g. 国考).
    year: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    region: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # exam_type values: national / provincial / institution / xuandiao / other.
    exam_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="other",
        server_default="other",
    )
    # category_l1 stores the top-level taxonomy key (e.g. 'verbal', 'numeric').
    # category_l2 is optional sub-category. Exact value space is defined by the
    # WU-B14 content service's category aggregator and the WU-B21 import script;
    # legacy rows are seeded with 'uncategorized' so the NOT NULL invariant
    # holds across the migration.
    category_l1: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="uncategorized",
        server_default="uncategorized",
    )
    category_l2: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Phase-Practice WU-B10.2 (Tab 2): quality signals + dedup key + AI-source
    # back-reference.
    #
    # historical_accuracy: rolling correct ratio across all PracticeSessionAnswerV2
    #   submissions for this question, in [0.0, 1.0]. The legacy seed value 0.0
    #   simply means "no data yet"; the WU-B17 stats aggregator overwrites it
    #   on every session.submit. We do not seed legacy rows with 0.5 (the spec
    #   median fallback) because the column is read inside the recommender as
    #   a sortable signal — a synthetic 0.5 would distort early picks until the
    #   first real submissions arrive.
    historical_accuracy: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0, server_default="0"
    )
    # answer_count: lifetime number of answers (correct + wrong + skipped). The
    # stats module increments this on every session.submit per-question.
    answer_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    # quality_score: only meaningful for source != real_exam. Range [0.0, 5.0];
    # the WU-D-Q9 LLM self-audit + user-feedback loop adjusts this. Real-exam
    # rows keep the seed value 5.0 (top quality assumption) so they never get
    # filtered out by quality_score < threshold rules.
    quality_score: Mapped[float] = mapped_column(
        Float, nullable=False, default=5.0, server_default="5"
    )
    # report_count: only meaningful for source != real_exam. Auto-disable
    # threshold lives in WU-B30 question_report; field is here so the picker
    # can sort it out cheaply.
    report_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    # is_active: false = retired (low quality_score / many reports / explicit
    # admin disable). Retired questions remain readable for users who already
    # answered them but never appear in new picks. index=True so the picker's
    # WHERE is_active filter stays cheap on large catalogs.
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true(), index=True
    )
    # content_hash: canonical 32-char BLAKE2b over prompt + normalized
    # content_json (see sikao_api.db.content_hash.compute_question_content_hash).
    # Used to dedup both AI re-generations against existing real exams and
    # repeated real-exam imports. Nullable in WU-B10.2 because legacy rows are
    # backfilled in WU-B10.3, after which the UNIQUE constraint is added.
    content_hash: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # ai_source_question_id: self-FK back to the real-exam question that an AI
    # item was adapted from. ondelete=SET NULL keeps AI items if the source
    # real-exam row is hard-deleted, since users may already have answered them.
    ai_source_question_id: Mapped[int | None] = mapped_column(
        ForeignKey("questions_v2.id", ondelete="SET NULL"), nullable=True
    )
    # ai_self_audit_passed: WU-B22 question_self_audit prompt result. Three
    # states: True (passed) / False (rejected, do not show) / None (real exam,
    # not applicable).
    ai_self_audit_passed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    # ai_generated_at: provenance timestamp; NULL for real-exam rows.
    ai_generated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Phase-1 question_metadata reserve fields. Phase 1 only lands the schema;
    # Phase 2 will populate / expose them through dedicated services.
    ability_dimensions: Mapped[list[str]] = mapped_column(
        JSONB_COMPAT,
        nullable=False,
        default=list,
        server_default=text("'[]'"),
    )
    discrimination_index: Mapped[float | None] = mapped_column(Float, nullable=True)
    heat_score: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0, server_default="0"
    )
    complexity_level: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    knowledge_tags: Mapped[list[str]] = mapped_column(
        JSONB_COMPAT,
        nullable=False,
        default=list,
        server_default=text("'[]'"),
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
        Index("ix_practice_sessions_v2_linked_plan_event", "linked_plan_event_id"),
        Index("ix_practice_sessions_v2_linked_recommendation", "linked_recommendation_id"),
        Index("ix_practice_sessions_v2_user_status_activity", "user_id", "status", "last_activity_at"),
        Index("ix_practice_sessions_v2_mock_auto_submit", "exam_mode", "status", "auto_submit_at"),
        CheckConstraint(
            "(status = 'paused' AND paused_at IS NOT NULL) OR "
            "(status != 'paused' AND paused_at IS NULL)",
            name="ck_ps_v2_paused_status",
        ),
        CheckConstraint(
            "(status != 'abandoned') OR (abandoned_reason IS NOT NULL)",
            name="ck_ps_v2_abandoned_reason",
        ),
        CheckConstraint(
            "(force_submitted = false) OR (force_submitted_reason IS NOT NULL)",
            name="ck_ps_v2_force_submit_reason",
        ),
        CheckConstraint(
            "(exam_mode = false) OR (time_limit_minutes IS NOT NULL)",
            name="ck_ps_v2_mock_time_limit",
        ),
        CheckConstraint(
            "(exam_mode = false) OR (practice_mode = 'full_set')",
            name="ck_ps_v2_mock_full_set",
        ),
        CheckConstraint(
            "(exam_mode = false) OR (source_mode = 'paper')",
            name="ck_ps_v2_mock_paper_source",
        ),
        CheckConstraint(
            "time_limit_minutes IS NULL OR (time_limit_minutes >= 10 AND time_limit_minutes <= 360)",
            name="ck_ps_v2_mock_time_range",
        ),
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
    linked_plan_event_id: Mapped[int | None] = mapped_column(
        ForeignKey("plan_event_v2.id", ondelete="SET NULL"),
        nullable=True,
    )
    linked_recommendation_id: Mapped[int | None] = mapped_column(
        ForeignKey("recommendation_v2.id", ondelete="SET NULL"),
        nullable=True,
    )
    linked_plan_event_occurrence_ref: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )

    # Phase-Practice WU-B11.1 (Tab 2): how the user is answering this session
    # and what selected the question set. Both fields are conceptually
    # immutable post-create; the DB-level enforcement lives in WU-B26
    # (session_lifecycle terminal-state trigger) once that module ships.
    #
    # practice_mode controls the answering UX:
    #   per_question  user sees solution after each answer
    #   full_set      strict closed-book; solutions only after submit (D-Q15)
    #
    # source_mode records how the question list was assembled. Picker
    # implementations live in WU-B15 by-mode dispatchers; here we just store
    # the audit-grade label so /sessions/:id results can recreate the user's
    # original intent.
    practice_mode: Mapped[str] = mapped_column(
        String(32), nullable=False, default="full_set", server_default="full_set"
    )
    source_mode: Mapped[str] = mapped_column(
        String(32), nullable=False, default="paper", server_default="paper"
    )
    # config_snapshot holds the resolved config the picker actually ran with —
    # category filters, year ranges, exclude-already-done flags, AI request
    # ids, etc. The application layer decides the inner shape per source_mode;
    # we keep it as opaque JSON here so future pickers do not require a
    # schema migration each time they add a knob. server_default '{}' on PG;
    # SQLite tolerates the same literal because the column type is JSON
    # (stored as TEXT) and JSON('{}') parses cleanly on both backends.
    config_snapshot: Mapped[dict[str, Any]] = mapped_column(
        JSONB_COMPAT, nullable=False, default=dict, server_default=text("'{}'")
    )
    paused_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    paused_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    last_heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    abandoned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    abandoned_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)
    force_submitted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    force_submitted_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)
    recovered_from_session_id: Mapped[int | None] = mapped_column(
        ForeignKey("practice_sessions_v2.id", ondelete="SET NULL"),
        nullable=True,
    )
    total_active_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    paused_total_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    first_question_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_activity_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    exam_mode: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    time_limit_minutes: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    auto_submit_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    allow_review_during: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    allow_pause: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    delayed_review_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


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

    # Phase-Practice WU-B11.2 (Tab 2): per-answer in-session flags.
    #
    # flagged tracks the user's "mark as uncertain" toggle for THIS session
    # only. Cross-session persistent flags live on QuestionFlagV2 (see WU-B16);
    # this column is the throwaway working set during answering.
    #
    # viewed_solution + view_solution_at record whether the user requested the
    # solution panel before submitting. Only meaningful in practice_mode=
    # per_question; full_set sessions strictly forbid solution view pre-submit
    # (D-Q15 closed-book invariant) and the route handler returns 403
    # STRICT_CLOSED_BOOK rather than letting the columns get set. The column
    # still exists on every row so the post-submit result page can render the
    # "you peeked at N solutions" stat uniformly.
    flagged: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    viewed_solution: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    view_solution_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    time_spent_ms: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    first_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    first_answered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_modified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    answer_change_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    visit_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    is_overtime: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )


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


class ReviewWeeklySnapshotV2(Base):
    __tablename__ = "review_weekly_snapshots_v2"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "week_start_date",
            name="uq_review_weekly_snapshots_v2_user_week",
        ),
        Index("ix_review_weekly_snapshots_v2_user_week", "user_id", "week_start_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    week_start_date: Mapped[date] = mapped_column(Date, nullable=False)
    data_json: Mapped[dict[str, Any]] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class ReviewItemV2(Base):
    __tablename__ = "review_items_v2"
    __table_args__ = (
        Index("ix_review_items_v2_user_created", "user_id", "created_at"),
        Index("ix_review_items_v2_user_status", "user_id", "status"),
        Index("ix_review_items_v2_user_next_review", "user_id", "next_review_at"),
        Index("ix_review_items_v2_user_source_kind", "user_id", "source_kind"),
        Index("ix_review_items_v2_question", "question_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    source_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    source_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default=ReviewItemStatus.PENDING.value)
    question_id: Mapped[int | None] = mapped_column(ForeignKey("questions_v2.id", ondelete="SET NULL"), nullable=True)
    essay_submission_id: Mapped[int | None] = mapped_column(
        ForeignKey("essay_submissions_v2.id", ondelete="SET NULL"), nullable=True
    )
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)

    # Phase-Practice WU-B11.4 (Tab 2): why this review item was queued.
    # Application-layer enum, intentionally nullable for legacy rows that
    # pre-date the field. Values:
    #   wrong_answer        Auto-queued from a wrong submission (existing flow).
    #   low_confidence      Auto-queued when user marks low confidence on submit.
    #   manual_add          User explicitly added the item to their queue.
    #   flagged_persistent  Tab 2 NEW: a session-level flag was promoted to the
    #                       persistent review queue via WU-B16 QuestionFlagV2
    #                       (D-Q12 "拓展" tier).
    # We do not enforce a DB-level enum or CHECK constraint; that lives in the
    # WU-B14+ review module's writer paths and follows the same pattern as
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )
    # PlanV2.source / RecommendationV2.status.
    reason: Mapped[str | None] = mapped_column(String(32), nullable=True)
    correct_streak: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    next_review_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default=text("1")
    )
    attempts: Mapped[list["ReviewAttemptV2"]] = relationship(
        back_populates="review_item",
        cascade="all, delete-orphan",
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
    review_item: Mapped["ReviewItemV2"] = relationship(back_populates="attempts")


class AiCauseAnalysisV2(Base):
    __tablename__ = "ai_cause_analysis_v2"
    __table_args__ = (
        Index("ix_ai_cause_v2_user_question_hash", "user_id", "question_id", "input_hash"),
        Index("ix_ai_cause_v2_user_signature", "user_id", "question_ids_signature"),
        Index("ix_ai_cause_v2_expires", "expires_at"),
        CheckConstraint(
            "((scope = 'single' AND question_id IS NOT NULL AND question_ids_signature IS NULL) "
            "OR (scope = 'group' AND question_id IS NULL AND question_ids_signature IS NOT NULL))",
            name="ck_ai_cause_v2_scope_target",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    scope: Mapped[str] = mapped_column(String(16), nullable=False, default=CauseAnalysisScope.SINGLE.value)
    question_id: Mapped[int | None] = mapped_column(
        ForeignKey("questions_v2.id", ondelete="SET NULL"),
        nullable=True,
    )
    question_ids_signature: Mapped[str | None] = mapped_column(String(64), nullable=True)
    input_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    result_json: Mapped[dict[str, Any]] = mapped_column(JSONB_COMPAT, nullable=False)
    llm_call_id: Mapped[int] = mapped_column(ForeignKey("llm_call_v2.id"), nullable=False)
    version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default=text("1")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class CauseTagV2(Base):
    __tablename__ = "cause_tag_v2"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_cause_tag_v2_slug"),
        Index("ix_cause_tag_v2_category_order", "category", "display_order"),
        Index("ix_cause_tag_v2_active", "is_active"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    severity_default: Mapped[str] = mapped_column(String(16), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    display_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    taxonomy_version: Mapped[str] = mapped_column(
        String(32), nullable=False, default="v1", server_default="v1"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class NoteV2(Base):
    __tablename__ = "notes_v2"
    __table_args__ = (
        Index("ix_notes_v2_user_updated", "user_id", "updated_at"),
        Index("ix_notes_v2_user_type", "user_id", "type"),
        Index("ix_notes_v2_user_visibility", "user_id", "visibility"),
        # Phase-Practice WU-B11.3 (Tab 4 schema 提前升级): the question-level
        # note write path lives in Tab 2 (D-Q5 / D-Q17), so we add the link
        # column ahead of the full Tab 4 / Phase-Notes rewrite. Composite
        # (user_id, linked_question_id) is the hot lookup shape for "show
        # me my notes on this question" inside the answering view.
        Index("ix_notes_v2_user_question", "user_id", "linked_question_id"),
        Index("ix_notes_v2_linked_question", "linked_question_id"),
        Index(
            "ix_notes_v2_community_feed",
            "visibility",
            "created_at",
            postgresql_where=text("visibility = 'public' AND deleted_at IS NULL"),
            sqlite_where=text("visibility = 'public' AND deleted_at IS NULL"),
        ),
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

    # Phase-Practice WU-B11.3 — Tab 4 schema brought forward.
    # linked_question_id: when set, this note is attached to a specific
    #   question (Tab 2 D-Q5 question-level notes). NULL for free-form notes.
    #   ondelete=SET NULL preserves the user's note even if the source
    #   question is hard-deleted (the body still has value as memory aid).
    # visibility: D-Q17 future-proofing. Tab 2 only writes 'private'; the
    #   Phase-Notes community feature later adds 'public' / 'shared_group'.
    linked_question_id: Mapped[int | None] = mapped_column(
        ForeignKey("questions_v2.id", ondelete="SET NULL"), nullable=True
    )
    visibility: Mapped[str] = mapped_column(
        String(32), nullable=False, default="private", server_default="private"
    )
    type: Mapped[str] = mapped_column(
        String(32), nullable=False, default="free", server_default="free"
    )
    body_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB_COMPAT, nullable=True)
    body_text: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    word_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reaction_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    comment_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    bookmark_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    is_featured: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    tags: Mapped[list[NoteTagV2]] = relationship(
        back_populates="note",
        cascade="all, delete-orphan",
    )
    images: Mapped[list[NoteImageV2]] = relationship(
        back_populates="note",
        cascade="all, delete-orphan",
    )


class NoteTagV2(Base):
    __tablename__ = "note_tags_v2"
    __table_args__ = (
        UniqueConstraint("note_id", "tag_name", name="uq_note_tag_per_note"),
        Index("ix_note_tags_v2_user_tag", "user_id", "tag_name"),
        Index("ix_note_tags_v2_note", "note_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users_v2.id", ondelete="CASCADE"),
        nullable=False,
    )
    note_id: Mapped[int] = mapped_column(
        ForeignKey("notes_v2.id", ondelete="CASCADE"),
        nullable=False,
    )
    tag_name: Mapped[str] = mapped_column(String(64), nullable=False)
    is_system: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    note: Mapped[NoteV2] = relationship(back_populates="tags")


class NoteImageV2(Base):
    __tablename__ = "note_images_v2"
    __table_args__ = (
        Index("ix_note_images_v2_note", "note_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    note_id: Mapped[int | None] = mapped_column(
        ForeignKey("notes_v2.id", ondelete="CASCADE"),
        nullable=True,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users_v2.id", ondelete="CASCADE"),
        nullable=False,
    )
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(64), nullable=False)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    note: Mapped[NoteV2] = relationship(back_populates="images")


class AiSummaryCacheV2(Base):
    __tablename__ = "ai_summary_cache_v2"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "note_id",
            "content_hash",
            "prompt_version",
            name="uq_ai_summary_cache_v2_identity",
        ),
        Index("ix_ai_summary_cache_v2_user_note", "user_id", "note_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users_v2.id", ondelete="CASCADE"),
        nullable=False,
    )
    note_id: Mapped[int] = mapped_column(
        ForeignKey("notes_v2.id", ondelete="CASCADE"),
        nullable=False,
    )
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(32), nullable=False)
    cards_json: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB_COMPAT,
        default=list,
        nullable=False,
    )
    llm_call_id: Mapped[int | None] = mapped_column(
        ForeignKey("llm_call_v2.id", ondelete="SET NULL"),
        nullable=True,
    )
    confirmed_review_item_ids: Mapped[list[int]] = mapped_column(
        JSONB_COMPAT,
        default=list,
        nullable=False,
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )


class WeeklyReviewCacheV2(Base):
    __tablename__ = "weekly_review_cache_v2"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "week_start_date",
            "prompt_version",
            name="uq_weekly_review_cache_v2_identity",
        ),
        Index("ix_weekly_review_cache_v2_user_week", "user_id", "week_start_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users_v2.id", ondelete="CASCADE"),
        nullable=False,
    )
    week_start_date: Mapped[date] = mapped_column(Date, nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(32), nullable=False)
    note_id: Mapped[int] = mapped_column(
        ForeignKey("notes_v2.id", ondelete="CASCADE"),
        nullable=False,
    )
    llm_call_id: Mapped[int | None] = mapped_column(
        ForeignKey("llm_call_v2.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )


class NoteReactionV2(Base):
    __tablename__ = "note_reactions_v2"
    __table_args__ = (
        UniqueConstraint("user_id", "note_id", "type", name="uq_note_reaction"),
        Index("ix_note_reactions_v2_note", "note_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users_v2.id", ondelete="CASCADE"),
        nullable=False,
    )
    note_id: Mapped[int] = mapped_column(
        ForeignKey("notes_v2.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[str] = mapped_column(
        String(16), nullable=False, default="like", server_default="like"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)


class NoteCommentV2(Base):
    __tablename__ = "note_comments_v2"
    __table_args__ = (
        Index("ix_note_comments_v2_note_created", "note_id", "created_at"),
        Index("ix_note_comments_v2_path", "note_id", "path"),
        CheckConstraint("depth BETWEEN 1 AND 3", name="ck_comment_depth"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users_v2.id", ondelete="CASCADE"),
        nullable=False,
    )
    note_id: Mapped[int] = mapped_column(
        ForeignKey("notes_v2.id", ondelete="CASCADE"),
        nullable=False,
    )
    parent_comment_id: Mapped[int | None] = mapped_column(
        ForeignKey("note_comments_v2.id", ondelete="CASCADE"),
        nullable=True,
    )
    path: Mapped[str] = mapped_column(String(128), nullable=False)
    depth: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default=text("1")
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class NoteBookmarkV2(Base):
    __tablename__ = "note_bookmarks_v2"
    __table_args__ = (
        UniqueConstraint("user_id", "note_id", name="uq_note_bookmark"),
        Index("ix_note_bookmarks_v2_user", "user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users_v2.id", ondelete="CASCADE"),
        nullable=False,
    )
    note_id: Mapped[int] = mapped_column(
        ForeignKey("notes_v2.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)


class NoteLinkV2(Base):
    __tablename__ = "note_links_v2"
    __table_args__ = (
        Index("ix_note_links_v2_note", "note_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    note_id: Mapped[int] = mapped_column(ForeignKey("notes_v2.id", ondelete="CASCADE"), nullable=False)
    link_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    link_target_id: Mapped[str] = mapped_column(String(64), nullable=False)


class PracticeStatsSnapshotV2(Base):
    __tablename__ = "practice_stats_snapshot_v2"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "scope",
            "category_key",
            "type",
            name="uq_practice_stats_v2_scope",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users_v2.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scope: Mapped[str] = mapped_column(String(32), nullable=False)
    category_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    total_questions: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    correct_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    accuracy: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0, server_default="0"
    )
    total_sessions: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    total_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    average_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    recent_trend: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB_COMPAT,
        nullable=False,
        default=list,
        server_default=text("'[]'"),
    )
    last_practiced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    percentile_rank: Mapped[float | None] = mapped_column(Float, nullable=True)
    percentile_updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class QuestionFavoriteV2(Base):
    __tablename__ = "question_favorite_v2"
    __table_args__ = (
        UniqueConstraint("user_id", "question_id", name="uq_qfav_v2_user_question"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users_v2.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions_v2.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    note: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)


class QuestionFlagV2(Base):
    __tablename__ = "question_flag_v2"
    __table_args__ = (
        Index(
            "uq_qflag_v2_active_user_question",
            "user_id",
            "question_id",
            unique=True,
            sqlite_where=text("resolved_at IS NULL"),
            postgresql_where=text("resolved_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users_v2.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions_v2.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reason: Mapped[str] = mapped_column(String(32), nullable=False)
    source_session_id: Mapped[int | None] = mapped_column(
        ForeignKey("practice_sessions_v2.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class QuestionReportV2(Base):
    __tablename__ = "question_report_v2"
    __table_args__ = (
        Index(
            "uq_qreport_v2_active_user_q_cat",
            "user_id",
            "question_id",
            "category",
            unique=True,
            sqlite_where=text("status IN ('pending', 'acknowledged') AND deleted_at IS NULL"),
            postgresql_where=text("status IN ('pending', 'acknowledged') AND deleted_at IS NULL"),
        ),
        Index("ix_qreport_v2_user_id", "user_id"),
        Index("ix_qreport_v2_question_id", "question_id"),
        Index("ix_qreport_v2_status_created", "status", "created_at"),
        CheckConstraint(
            "length(description) >= 10 AND length(description) <= 1000",
            name="ck_qreport_v2_desc_len",
        ),
        CheckConstraint(
            "(status NOT IN ('resolved_fixed', 'resolved_invalid', 'resolved_duplicate')) "
            "OR (handled_by_admin_id IS NOT NULL AND handled_at IS NOT NULL AND admin_response IS NOT NULL)",
            name="ck_qreport_v2_resolved_admin",
        ),
        CheckConstraint(
            "((status = 'resolved_fixed' AND applied_fix IS NOT NULL) "
            "OR (status != 'resolved_fixed' AND applied_fix IS NULL))",
            name="ck_qreport_v2_fix_when_fixed",
        ),
        CheckConstraint(
            "((status = 'resolved_duplicate' AND duplicate_of_report_id IS NOT NULL) "
            "OR (status != 'resolved_duplicate' AND duplicate_of_report_id IS NULL))",
            name="ck_qreport_v2_dup_when_dup",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users_v2.id", ondelete="CASCADE"),
        nullable=False,
    )
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions_v2.id", ondelete="CASCADE"),
        nullable=False,
    )
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    description: Mapped[str] = mapped_column(String(1000), nullable=False)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=QuestionReportStatus.PENDING.value,
        server_default=QuestionReportStatus.PENDING.value,
    )
    handled_by_admin_id: Mapped[int | None] = mapped_column(
        ForeignKey("users_v2.id"),
        nullable=True,
    )
    handled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    admin_response: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    duplicate_of_report_id: Mapped[int | None] = mapped_column(
        ForeignKey("question_report_v2.id"),
        nullable=True,
    )
    applied_fix: Mapped[dict[str, Any] | None] = mapped_column(JSONB_COMPAT, nullable=True)
    source_session_id: Mapped[int | None] = mapped_column(
        ForeignKey("practice_sessions_v2.id", ondelete="SET NULL"),
        nullable=True,
    )
    selected_answer_at_report: Mapped[Any | None] = mapped_column(
        JSONB_COMPAT,
        nullable=True,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )


class EssayReferenceAnswerV2(Base):
    __tablename__ = "essay_reference_answer_v2"
    __table_args__ = (
        Index("ix_essay_ref_answer_v2_question_status", "question_id", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions_v2.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users_v2.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_by_admin: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    likes_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    favorites_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    report_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    quality_score: Mapped[float] = mapped_column(
        Float, nullable=False, default=5.0, server_default="5"
    )
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="draft", server_default="draft"
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ai_self_audit_passed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    ai_generated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class EssayReferenceFeedbackV2(Base):
    __tablename__ = "essay_reference_feedback_v2"
    __table_args__ = (
        UniqueConstraint(
            "reference_id",
            "user_id",
            "action",
            name="uq_essay_ref_feedback_v2",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reference_id: Mapped[int] = mapped_column(
        ForeignKey("essay_reference_answer_v2.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users_v2.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    note: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)


class AiGeneratedQuestionRequestV2(Base):
    __tablename__ = "ai_generated_question_request_v2"
    __table_args__ = (
        Index("ix_ai_question_req_v2_user_started", "user_id", "started_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users_v2.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    request_params: Mapped[dict[str, Any]] = mapped_column(
        JSONB_COMPAT,
        nullable=False,
        default=dict,
        server_default=text("'{}'"),
    )
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="pending", server_default="pending"
    )
    pool_question_ids: Mapped[list[int]] = mapped_column(
        JSONB_COMPAT,
        nullable=False,
        default=list,
        server_default=text("'[]'"),
    )
    llm_generated_question_ids: Mapped[list[int]] = mapped_column(
        JSONB_COMPAT,
        nullable=False,
        default=list,
        server_default=text("'[]'"),
    )
    llm_self_audit_passed_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    llm_call_id: Mapped[int | None] = mapped_column(
        ForeignKey("llm_call_v2.id", ondelete="SET NULL"),
        nullable=True,
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)


class DailyPracticeV2(Base):
    __tablename__ = "daily_practice_v2"
    __table_args__ = (
        UniqueConstraint("user_id", "date", "type", name="uq_daily_practice_v2"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users_v2.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    question_ids: Mapped[list[int]] = mapped_column(
        JSONB_COMPAT,
        nullable=False,
        default=list,
        server_default=text("'[]'"),
    )
    generation_strategy: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="pending", server_default="pending"
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_session_id: Mapped[int | None] = mapped_column(
        ForeignKey("practice_sessions_v2.id", ondelete="SET NULL"),
        nullable=True,
    )
    expired_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)


class QuestionTimingBaselineV2(Base):
    __tablename__ = "question_timing_baseline_v2"
    __table_args__ = (
        Index("ix_qtb_v2_recomputed", "last_recomputed_at"),
    )

    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions_v2.id", ondelete="CASCADE"),
        primary_key=True,
    )
    p50_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    p90_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    p95_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    mean_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    sample_size: Mapped[int] = mapped_column(Integer, nullable=False)
    last_recomputed_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, nullable=False
    )


class UserPracticePreferencesV2(Base):
    __tablename__ = "user_practice_preferences_v2"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users_v2.id", ondelete="CASCADE"),
        primary_key=True,
    )
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB_COMPAT,
        nullable=False,
        default=dict,
        server_default=text("'{}'"),
    )
    schema_version: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=1, server_default="1"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class KnowledgePointV2(Base):
    __tablename__ = "knowledge_point_v2"
    __phase__ = "phase_2"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    category_l1: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    category_l2: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("knowledge_point_v2.id", ondelete="SET NULL"),
        nullable=True,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    weight_in_exam: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true(), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class QuestionKnowledgePointV2(Base):
    __tablename__ = "question_knowledge_point_v2"
    __phase__ = "phase_2"
    __table_args__ = (
        UniqueConstraint(
            "question_id",
            "knowledge_point_id",
            name="uq_qkp_v2_question_knowledge",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions_v2.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    knowledge_point_id: Mapped[int] = mapped_column(
        ForeignKey("knowledge_point_v2.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    weight: Mapped[float] = mapped_column(
        Float, nullable=False, default=1.0, server_default="1"
    )
    annotated_by: Mapped[str] = mapped_column(String(32), nullable=False)
    annotated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)


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
    ai_adjust_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    dashboard_preferences: Mapped[dict[str, Any]] = mapped_column(
        JSONB_COMPAT,
        default=dict,
        nullable=False,
    )
    recommender_preferences: Mapped[dict[str, Any]] = mapped_column(
        JSONB_COMPAT,
        default=dict,
        nullable=False,
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
    exam_targets: Mapped[list[dict[str, Any]]] = mapped_column(JSONB_COMPAT, default=list, nullable=False)


class AccountDeletionJobV2(Base):
    """Audit record for account deletion. user_id is SET NULL on hard-delete
    so the job survives as an audit trail of who was deleted and when."""

    __tablename__ = "account_deletion_jobs_v2"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users_v2.id", ondelete="SET NULL"), nullable=True, unique=True,
    )
    user_public_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    requested_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)
    hard_delete_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)


class PlanV2(Base):
    __tablename__ = "plan_v2"
    __table_args__ = (
        Index("ix_plan_v2_user_status", "user_id", "status"),
        Index(
            "ix_plan_v2_user_active",
            "user_id",
            unique=True,
            sqlite_where=text("status = 'active' AND deleted_at IS NULL"),
            postgresql_where=text("status = 'active' AND deleted_at IS NULL"),
        ),
        CheckConstraint("daily_minutes_target BETWEEN 60 AND 720", name="ck_plan_v2_minutes"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    target_exam_id: Mapped[str] = mapped_column(String(64), nullable=False)
    target_exam_date: Mapped[date] = mapped_column(Date, nullable=False)
    daily_minutes_target: Mapped[int] = mapped_column(Integer, nullable=False)
    style: Mapped[str] = mapped_column(String(32), nullable=False)
    baseline: Mapped[dict[str, Any]] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    focus_subjects: Mapped[list[str]] = mapped_column(JSONB_COMPAT, default=list, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="paused")
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    change_log: Mapped[list[dict[str, Any]]] = mapped_column(JSONB_COMPAT, default=list, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )


class PlanEventV2(Base):
    __tablename__ = "plan_event_v2"
    __table_args__ = (
        Index("ix_event_v2_user_range", "user_id", "start_at", "end_at"),
        Index("ix_event_v2_plan_range", "plan_id", "start_at"),
        Index("ix_event_v2_recurring_parent", "recurring_parent_id"),
        Index(
            "ix_event_v2_user_alive",
            "user_id",
            sqlite_where=text("deleted_at IS NULL"),
            postgresql_where=text("deleted_at IS NULL"),
        ),
        CheckConstraint("end_at > start_at", name="ck_event_v2_time_window"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plan_v2.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    start_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Asia/Shanghai")
    recurring_rule: Mapped[str | None] = mapped_column(Text, nullable=True)
    recurring_parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("plan_event_v2.id", ondelete="CASCADE"),
        nullable=True,
    )
    recurring_exception_dates: Mapped[list[str]] = mapped_column(JSONB_COMPAT, default=list, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="planned")
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    linked_session_id: Mapped[int | None] = mapped_column(
        ForeignKey("practice_sessions_v2.id", ondelete="SET NULL"),
        nullable=True,
    )
    target_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    change_log: Mapped[list[dict[str, Any]]] = mapped_column(JSONB_COMPAT, default=list, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )


class PlanAdjustmentV2(Base):
    __tablename__ = "plan_adjustment_v2"
    __table_args__ = (
        Index("ix_adj_v2_user_status", "user_id", "status"),
        Index(
            "ix_adj_v2_pending_expires",
            "expires_at",
            sqlite_where=text("status = 'pending'"),
            postgresql_where=text("status = 'pending'"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plan_v2.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    proposed_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    changes: Mapped[list[dict[str, Any]]] = mapped_column(JSONB_COMPAT, default=list, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    user_reject_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    llm_call_id: Mapped[int | None] = mapped_column(
        ForeignKey("llm_call_v2.id", ondelete="SET NULL"),
        nullable=True,
    )


class RecommendationV2(Base):
    __tablename__ = "recommendation_v2"
    __table_args__ = (
        Index("ix_rec_v2_user_status", "user_id", "status"),
        Index(
            "ix_rec_v2_active",
            "user_id",
            "expires_at",
            sqlite_where=text("status = 'pending'"),
            postgresql_where=text("status = 'pending'"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    estimated_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    cta: Mapped[str] = mapped_column(String(40), nullable=False)
    action_type: Mapped[str] = mapped_column(String(32), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    served_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    source_signals: Mapped[dict[str, Any]] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    llm_call_id: Mapped[int | None] = mapped_column(
        ForeignKey("llm_call_v2.id", ondelete="SET NULL"),
        nullable=True,
    )


class RecommendationFeedbackV2(Base):
    __tablename__ = "recommendation_feedback_v2"
    __table_args__ = (
        Index("ix_recommendation_feedback_v2_recommendation", "recommendation_id"),
        Index("ix_recommendation_feedback_v2_analysis", "analysis_id"),
        Index(
            "ix_recommendation_feedback_v2_type_rating_created",
            "feedback_type",
            "rating",
            "created_at",
        ),
        CheckConstraint(
            "("
            "(feedback_type = 'recommendation_reject' AND recommendation_id IS NOT NULL AND analysis_id IS NULL AND rating IS NULL)"
            " OR "
            "(feedback_type IN ('cause_analysis_single', 'cause_analysis_group') AND recommendation_id IS NULL AND analysis_id IS NOT NULL AND rating IN ('up', 'down'))"
            ")",
            name="ck_recommendation_feedback_v2_target_type",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recommendation_id: Mapped[int | None] = mapped_column(
        ForeignKey("recommendation_v2.id", ondelete="CASCADE"),
        nullable=True,
    )
    analysis_id: Mapped[int | None] = mapped_column(
        ForeignKey("ai_cause_analysis_v2.id", ondelete="CASCADE"),
        nullable=True,
    )
    feedback_type: Mapped[str] = mapped_column(String(32), nullable=False, default="recommendation_reject")
    reason: Mapped[str] = mapped_column(String(40), nullable=False)
    rating: Mapped[str | None] = mapped_column(String(16), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)


class IdempotencyKeyV2(Base):
    __tablename__ = "idempotency_key_v2"
    __table_args__ = (
        UniqueConstraint("key", "user_id", "endpoint", name="uq_idem_key"),
        Index("ix_idem_expires", "expires_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(64), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    endpoint: Mapped[str] = mapped_column(String(120), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    response_status: Mapped[int] = mapped_column(Integer, nullable=False)
    response_body: Mapped[dict[str, Any]] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class LlmCallV2(Base):
    __tablename__ = "llm_call_v2"
    __table_args__ = (
        Index("ix_llm_user_purpose", "user_id", "purpose", "created_at"),
        Index(
            "ix_llm_parse_failed",
            "parse_status",
            sqlite_where=text("parse_status != 'ok'"),
            postgresql_where=text("parse_status != 'ok'"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    purpose: Mapped[str] = mapped_column(String(40), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(32), nullable=False)
    provider: Mapped[str] = mapped_column(String(40), nullable=False)
    model: Mapped[str] = mapped_column(String(80), nullable=False)
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cost_cny: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    request_payload: Mapped[dict[str, Any]] = mapped_column(JSONB_COMPAT, default=dict, nullable=False)
    response_payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB_COMPAT, nullable=True)
    parsed_output: Mapped[dict[str, Any] | None] = mapped_column(JSONB_COMPAT, nullable=True)
    parse_status: Mapped[str] = mapped_column(String(32), nullable=False)
    error_class: Mapped[str | None] = mapped_column(String(80), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)


class AuditLogV2(Base):
    __tablename__ = "audit_log_v2"
    __table_args__ = (
        Index("ix_audit_user_action_at", "user_id", "action", "created_at"),
        Index("ix_audit_target", "target_type", "target_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    actor_type: Mapped[str] = mapped_column(String(32), nullable=False)
    actor_id: Mapped[str] = mapped_column(String(40), nullable=False)
    action: Mapped[str] = mapped_column(String(60), nullable=False)
    target_type: Mapped[str] = mapped_column(String(40), nullable=False)
    target_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    before: Mapped[dict[str, Any] | None] = mapped_column(JSONB_COMPAT, nullable=True)
    after: Mapped[dict[str, Any] | None] = mapped_column(JSONB_COMPAT, nullable=True)
    diff: Mapped[dict[str, Any] | None] = mapped_column(JSONB_COMPAT, nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB_COMPAT,
        default=dict,
        nullable=False,
    )
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
