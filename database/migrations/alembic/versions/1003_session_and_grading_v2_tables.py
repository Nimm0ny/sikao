"""Create session and grading v2 tables for backend rewrite phase 1."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "1003_session_and_grading_v2_tables"
down_revision = "1002_content_v2_tables"
branch_labels = None
depends_on = None

_JSONB_COMPAT = sa.JSON().with_variant(JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "practice_sessions_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("track", sa.String(length=32), nullable=False),
        sa.Column("entry_kind", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("paper_id", sa.Integer(), sa.ForeignKey("papers_v2.id", ondelete="SET NULL"), nullable=True),
        sa.Column("revision_id", sa.Integer(), sa.ForeignKey("paper_revisions_v2.id", ondelete="SET NULL"), nullable=True),
        sa.Column("payload_json", _JSONB_COMPAT, nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_practice_sessions_v2_user_started", "practice_sessions_v2", ["user_id", "started_at"])

    op.create_table(
        "practice_session_answers_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("practice_sessions_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", sa.Integer(), sa.ForeignKey("questions_v2.id", ondelete="SET NULL"), nullable=True),
        sa.Column("question_key", sa.String(length=64), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("response_json", _JSONB_COMPAT, nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("answered_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_practice_session_answers_v2_session",
        "practice_session_answers_v2",
        ["session_id", "display_order"],
    )

    op.create_table(
        "essay_drafts_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", sa.Integer(), sa.ForeignKey("questions_v2.id", ondelete="SET NULL"), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("metadata_json", _JSONB_COMPAT, nullable=False),
        sa.Column("saved_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "question_id", name="uq_essay_drafts_v2_user_question"),
    )

    op.create_table(
        "essay_submissions_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", sa.Integer(), sa.ForeignKey("questions_v2.id", ondelete="SET NULL"), nullable=True),
        sa.Column("practice_session_id", sa.Integer(), sa.ForeignKey("practice_sessions_v2.id", ondelete="SET NULL"), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("submitted_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_essay_submissions_v2_user_submitted", "essay_submissions_v2", ["user_id", "submitted_at"])

    op.create_table(
        "essay_reports_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("submission_id", sa.Integer(), sa.ForeignKey("essay_submissions_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("score", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("feedback_json", _JSONB_COMPAT, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("submission_id", name="uq_essay_reports_v2_submission"),
    )


def downgrade() -> None:
    op.drop_table("essay_reports_v2")
    op.drop_index("ix_essay_submissions_v2_user_submitted", table_name="essay_submissions_v2")
    op.drop_table("essay_submissions_v2")
    op.drop_table("essay_drafts_v2")
    op.drop_index("ix_practice_session_answers_v2_session", table_name="practice_session_answers_v2")
    op.drop_table("practice_session_answers_v2")
    op.drop_index("ix_practice_sessions_v2_user_started", table_name="practice_sessions_v2")
    op.drop_table("practice_sessions_v2")
