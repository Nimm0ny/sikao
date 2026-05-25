"""Notes M4: add weekly review and AI summary runtime cache tables.

Revision ID: 1033_notes_ai_runtime_cache
Revises: 1032_notes_image_nullable
Create Date: 2026-05-26
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "1033_notes_ai_runtime_cache"
down_revision = "1032_notes_image_nullable"
branch_labels = None
depends_on = None


JSONB_COMPAT = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    op.create_table(
        "ai_summary_cache_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("note_id", sa.Integer(), sa.ForeignKey("notes_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("prompt_version", sa.String(length=32), nullable=False),
        sa.Column("cards_json", JSONB_COMPAT, nullable=False),
        sa.Column("llm_call_id", sa.Integer(), sa.ForeignKey("llm_call_v2.id", ondelete="SET NULL"), nullable=True),
        sa.Column("confirmed_review_item_ids", JSONB_COMPAT, nullable=False),
        sa.Column("confirmed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint(
            "user_id",
            "note_id",
            "content_hash",
            "prompt_version",
            name="uq_ai_summary_cache_v2_identity",
        ),
    )
    op.create_index("ix_ai_summary_cache_v2_user_note", "ai_summary_cache_v2", ["user_id", "note_id"])

    op.create_table(
        "weekly_review_cache_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("week_start_date", sa.Date(), nullable=False),
        sa.Column("prompt_version", sa.String(length=32), nullable=False),
        sa.Column("note_id", sa.Integer(), sa.ForeignKey("notes_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("llm_call_id", sa.Integer(), sa.ForeignKey("llm_call_v2.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint(
            "user_id",
            "week_start_date",
            "prompt_version",
            name="uq_weekly_review_cache_v2_identity",
        ),
    )
    op.create_index("ix_weekly_review_cache_v2_user_week", "weekly_review_cache_v2", ["user_id", "week_start_date"])


def downgrade() -> None:
    op.drop_index("ix_weekly_review_cache_v2_user_week", table_name="weekly_review_cache_v2")
    op.drop_table("weekly_review_cache_v2")

    op.drop_index("ix_ai_summary_cache_v2_user_note", table_name="ai_summary_cache_v2")
    op.drop_table("ai_summary_cache_v2")
