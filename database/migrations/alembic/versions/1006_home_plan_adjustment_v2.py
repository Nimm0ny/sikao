"""Create Home Phase plan adjustment v2 table."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "1006_home_plan_adjustment_v2"
down_revision = "1005_home_plan_and_event_v2"
branch_labels = None
depends_on = None

_JSONB_COMPAT = sa.JSON().with_variant(JSONB(), "postgresql")
_PENDING_WHERE = sa.text("status = 'pending'")


def upgrade() -> None:
    op.create_table(
        "plan_adjustment_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("plan_id", sa.Integer(), sa.ForeignKey("plan_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("proposed_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("decided_at", sa.DateTime(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("changes", _JSONB_COMPAT, nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("user_reject_reason", sa.Text(), nullable=True),
    )
    op.create_index("ix_adj_v2_user_status", "plan_adjustment_v2", ["user_id", "status"])
    op.create_index(
        "ix_adj_v2_pending_expires",
        "plan_adjustment_v2",
        ["expires_at"],
        sqlite_where=_PENDING_WHERE,
        postgresql_where=_PENDING_WHERE,
    )


def downgrade() -> None:
    op.drop_index("ix_adj_v2_pending_expires", table_name="plan_adjustment_v2")
    op.drop_index("ix_adj_v2_user_status", table_name="plan_adjustment_v2")
    op.drop_table("plan_adjustment_v2")
