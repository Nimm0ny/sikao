"""Create Home Phase recommendation v2 tables."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "1007_home_recommendation_v2"
down_revision = "1006_home_plan_adjustment_v2"
branch_labels = None
depends_on = None

_JSONB_COMPAT = sa.JSON().with_variant(JSONB(), "postgresql")
_PENDING_WHERE = sa.text("status = 'pending'")


def upgrade() -> None:
    op.create_table(
        "recommendation_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("estimated_minutes", sa.Integer(), nullable=False),
        sa.Column("cta", sa.String(length=40), nullable=False),
        sa.Column("action_type", sa.String(length=32), nullable=False),
        sa.Column("payload", _JSONB_COMPAT, nullable=False),
        sa.Column("generated_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("served_count", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("accepted_at", sa.DateTime(), nullable=True),
        sa.Column("rejected_at", sa.DateTime(), nullable=True),
        sa.Column("source_signals", _JSONB_COMPAT, nullable=False),
    )
    op.create_index("ix_rec_v2_user_status", "recommendation_v2", ["user_id", "status"])
    op.create_index(
        "ix_rec_v2_active",
        "recommendation_v2",
        ["user_id", "expires_at"],
        sqlite_where=_PENDING_WHERE,
        postgresql_where=_PENDING_WHERE,
    )

    op.create_table(
        "recommendation_feedback_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "recommendation_id",
            sa.Integer(),
            sa.ForeignKey("recommendation_v2.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("reason", sa.String(length=40), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("recommendation_feedback_v2")
    op.drop_index("ix_rec_v2_active", table_name="recommendation_v2")
    op.drop_index("ix_rec_v2_user_status", table_name="recommendation_v2")
    op.drop_table("recommendation_v2")
