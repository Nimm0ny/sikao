"""Phase-Practice P1: AI request, daily practice, and practice preferences tables."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB


revision = "1024_practice_ai_daily_preferences"
down_revision = "1023_practice_support_tables"
branch_labels = None
depends_on = None

_JSON_COMPAT = sa.JSON().with_variant(JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "ai_generated_question_request_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users_v2.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "request_params",
            _JSON_COMPAT,
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column(
            "status",
            sa.String(length=32),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "pool_question_ids",
            _JSON_COMPAT,
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column(
            "llm_generated_question_ids",
            _JSON_COMPAT,
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column(
            "llm_self_audit_passed_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "llm_call_id",
            sa.Integer(),
            sa.ForeignKey("llm_call_v2.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_ai_question_req_v2_user_started",
        "ai_generated_question_request_v2",
        ["user_id", "started_at"],
    )
    op.create_index(
        "ix_ai_generated_question_request_v2_user_id",
        "ai_generated_question_request_v2",
        ["user_id"],
    )

    op.create_table(
        "daily_practice_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users_v2.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("question_ids", _JSON_COMPAT, nullable=False, server_default=sa.text("'[]'")),
        sa.Column("generation_strategy", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column(
            "completed_session_id",
            sa.Integer(),
            sa.ForeignKey("practice_sessions_v2.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("expired_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "date", "type", name="uq_daily_practice_v2"),
    )
    op.create_index("ix_daily_practice_v2_user_id", "daily_practice_v2", ["user_id"])

    op.create_table(
        "user_practice_preferences_v2",
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users_v2.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("payload", _JSON_COMPAT, nullable=False, server_default=sa.text("'{}'")),
        sa.Column("schema_version", sa.SmallInteger(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("user_practice_preferences_v2")

    op.drop_index("ix_daily_practice_v2_user_id", table_name="daily_practice_v2")
    op.drop_table("daily_practice_v2")

    op.drop_index(
        "ix_ai_question_req_v2_user_started",
        table_name="ai_generated_question_request_v2",
    )
    op.drop_index(
        "ix_ai_generated_question_request_v2_user_id",
        table_name="ai_generated_question_request_v2",
    )
    op.drop_table("ai_generated_question_request_v2")
