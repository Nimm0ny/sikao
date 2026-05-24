"""Review WU-R7: weekly snapshot read model."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB


revision = "1029_review_weekly_snapshot"
down_revision = "1028_review_cause_analysis_taxonomy"
branch_labels = None
depends_on = None

_JSON_COMPAT = sa.JSON().with_variant(JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "review_weekly_snapshots_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users_v2.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("week_start_date", sa.Date(), nullable=False),
        sa.Column("data_json", _JSON_COMPAT, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint(
            "user_id",
            "week_start_date",
            name="uq_review_weekly_snapshots_v2_user_week",
        ),
    )
    op.create_index(
        "ix_review_weekly_snapshots_v2_user_week",
        "review_weekly_snapshots_v2",
        ["user_id", "week_start_date"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_review_weekly_snapshots_v2_user_week",
        table_name="review_weekly_snapshots_v2",
    )
    op.drop_table("review_weekly_snapshots_v2")

