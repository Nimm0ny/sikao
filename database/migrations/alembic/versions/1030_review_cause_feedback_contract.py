"""Review TX15: cause-analysis feedback contract on recommendation_feedback_v2."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB


revision = "1030_review_cause_feedback_contract"
down_revision = "1029_review_weekly_snapshot"
branch_labels = None
depends_on = None

_JSON_COMPAT = sa.JSON().with_variant(JSONB(), "postgresql")


def upgrade() -> None:
    with op.batch_alter_table("recommendation_feedback_v2") as batch_op:
        batch_op.add_column(sa.Column("analysis_id", sa.Integer(), nullable=True))
        batch_op.add_column(
            sa.Column(
                "feedback_type",
                sa.String(length=32),
                nullable=False,
                server_default="recommendation_reject",
            )
        )
        batch_op.add_column(sa.Column("rating", sa.String(length=16), nullable=True))
        batch_op.add_column(sa.Column("metadata_json", _JSON_COMPAT, nullable=True))
        batch_op.alter_column("recommendation_id", existing_type=sa.Integer(), nullable=True)
        batch_op.create_foreign_key(
            "fk_recommendation_feedback_v2_analysis",
            "ai_cause_analysis_v2",
            ["analysis_id"],
            ["id"],
            ondelete="CASCADE",
        )

    op.execute("UPDATE recommendation_feedback_v2 SET metadata_json = '{}' WHERE metadata_json IS NULL")
    with op.batch_alter_table("recommendation_feedback_v2") as batch_op:
        batch_op.alter_column("metadata_json", existing_type=_JSON_COMPAT, nullable=False)
        batch_op.create_index(
            "ix_recommendation_feedback_v2_recommendation",
            ["recommendation_id"],
        )
        batch_op.create_index(
            "ix_recommendation_feedback_v2_analysis",
            ["analysis_id"],
        )
        batch_op.create_index(
            "ix_recommendation_feedback_v2_type_rating_created",
            ["feedback_type", "rating", "created_at"],
        )
        batch_op.create_check_constraint(
            "ck_recommendation_feedback_v2_target_type",
            "("
            "(feedback_type = 'recommendation_reject' AND recommendation_id IS NOT NULL AND analysis_id IS NULL AND rating IS NULL)"
            " OR "
            "(feedback_type IN ('cause_analysis_single', 'cause_analysis_group') AND recommendation_id IS NULL AND analysis_id IS NOT NULL AND rating IN ('up', 'down'))"
            ")",
        )


def downgrade() -> None:
    op.execute(
        "DELETE FROM recommendation_feedback_v2 WHERE feedback_type IN ('cause_analysis_single', 'cause_analysis_group')"
    )
    with op.batch_alter_table("recommendation_feedback_v2") as batch_op:
        batch_op.drop_constraint("ck_recommendation_feedback_v2_target_type", type_="check")
        batch_op.drop_index("ix_recommendation_feedback_v2_type_rating_created")
        batch_op.drop_index("ix_recommendation_feedback_v2_analysis")
        batch_op.drop_index("ix_recommendation_feedback_v2_recommendation")
        batch_op.drop_constraint("fk_recommendation_feedback_v2_analysis", type_="foreignkey")
        batch_op.drop_column("metadata_json")
        batch_op.drop_column("rating")
        batch_op.drop_column("feedback_type")
        batch_op.drop_column("analysis_id")
        batch_op.alter_column("recommendation_id", existing_type=sa.Integer(), nullable=False)
