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
    text,
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
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    deletion_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
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

    # Phase-Practice WU-B10.1 (Tab 2): question source + exam classification.
    # Source distinguishes real_exam vs ai_generated/ai_modified items so the
    # session picker, recommender, and stats aggregator can treat them
    # consistently while remaining auditable. Allowed values are enforced in
    # application layer (no DB enum, matching PlanV2.source convention) and the
    # value is logically immutable post-create — the DB-level immutable trigger
    # is added in WU-B10.3 once content_hash backfill completes.
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="real_exam")
    # year / region intentionally nullable: AI-generated items have no
    # provenance year and not every official paper carries a region (e.g. 国考).
    year: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    region: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # exam_type values: national / provincial / institution / xuandiao / other.
    exam_type: Mapped[str] = mapped_column(String(32), nullable=False, default="other")
    # category_l1 stores the top-level taxonomy key (e.g. 'verbal', 'numeric').
    # category_l2 is optional sub-category. Exact value space is defined by the
    # WU-B14 content service's category aggregator and the WU-B21 import script;
    # legacy rows are seeded with 'uncategorized' so the NOT NULL invariant
    # holds across the migration.
    category_l1: Mapped[str] = mapped_column(String(32), nullable=False, default="uncategorized")
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
        Boolean, nullable=False, default=True, server_default=text("1"), index=True
    )
    # content_hash: BLAKE2b(stem + sorted options + correct_answer); 32 chars
    # hex. Used to dedup both AI re-generations against existing real exams and
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
        Index("ix_practice_sessions_v2_linked_plan_event", "linked_plan_event_id"),
        Index("ix_practice_sessions_v2_linked_recommendation", "linked_recommendation_id"),
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
    linked_plan_event_occurrence_ref: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )
    linked_recommendation_id: Mapped[int | None] = mapped_column(
        ForeignKey("recommendation_v2.id", ondelete="SET NULL"),
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
        Boolean, nullable=False, default=False, server_default=text("0")
    )
    viewed_solution: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("0")
    )
    view_solution_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


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

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recommendation_id: Mapped[int] = mapped_column(
        ForeignKey("recommendation_v2.id", ondelete="CASCADE"),
        nullable=False,
    )
    reason: Mapped[str] = mapped_column(String(40), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
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
