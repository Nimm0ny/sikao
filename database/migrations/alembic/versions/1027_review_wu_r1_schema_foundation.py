"""Review WU-R1: review schema foundation.

Extends the existing ReviewItemV2 stub with the first SRS state columns and
creates AiCauseAnalysisV2 on the live phase1-v2 alembic chain.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB


revision = "1027_review_wu_r1_schema_foundation"
down_revision = "1026_question_report"
branch_labels = None
depends_on = None

_JSON_COMPAT = sa.JSON().with_variant(JSONB(), "postgresql")


def upgrade() -> None:
    with op.batch_alter_table("review_items_v2") as batch_op:
        batch_op.add_column(
            sa.Column("correct_streak", sa.Integer(), nullable=False, server_default=sa.text("0"))
        )
        batch_op.add_column(
            sa.Column("next_review_at", sa.DateTime(), nullable=True)
        )
        batch_op.add_column(
            sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1"))
        )

    op.create_index(
        "ix_review_items_v2_user_status",
        "review_items_v2",
        ["user_id", "status"],
    )
    op.create_index(
        "ix_review_items_v2_user_next_review",
        "review_items_v2",
        ["user_id", "next_review_at"],
    )
    op.create_index(
        "ix_review_items_v2_user_source_kind",
        "review_items_v2",
        ["user_id", "source_kind"],
    )
    op.create_index(
        "ix_review_items_v2_question",
        "review_items_v2",
        ["question_id"],
    )

    op.create_table(
        "ai_cause_analysis_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users_v2.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("scope", sa.String(length=16), nullable=False),
        sa.Column(
            "question_id",
            sa.Integer(),
            sa.ForeignKey("questions_v2.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("question_ids_signature", sa.String(length=64), nullable=True),
        sa.Column("input_hash", sa.String(length=64), nullable=False),
        sa.Column("result_json", _JSON_COMPAT, nullable=False),
        sa.Column(
            "llm_call_id",
            sa.Integer(),
            sa.ForeignKey("llm_call_v2.id"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint(
            "((scope = 'single' AND question_id IS NOT NULL AND question_ids_signature IS NULL) "
            "OR (scope = 'group' AND question_id IS NULL AND question_ids_signature IS NOT NULL))",
            name="ck_ai_cause_v2_scope_target",
        ),
    )
    op.create_index(
        "ix_ai_cause_v2_user_question_hash",
        "ai_cause_analysis_v2",
        ["user_id", "question_id", "input_hash"],
    )
    op.create_index(
        "ix_ai_cause_v2_user_signature",
        "ai_cause_analysis_v2",
        ["user_id", "question_ids_signature"],
    )
    op.create_index(
        "ix_ai_cause_v2_expires",
        "ai_cause_analysis_v2",
        ["expires_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_ai_cause_v2_expires", table_name="ai_cause_analysis_v2")
    op.drop_index("ix_ai_cause_v2_user_signature", table_name="ai_cause_analysis_v2")
    op.drop_index("ix_ai_cause_v2_user_question_hash", table_name="ai_cause_analysis_v2")
    op.drop_table("ai_cause_analysis_v2")

    op.drop_index("ix_review_items_v2_question", table_name="review_items_v2")
    op.drop_index("ix_review_items_v2_user_source_kind", table_name="review_items_v2")
    op.drop_index("ix_review_items_v2_user_next_review", table_name="review_items_v2")
    op.drop_index("ix_review_items_v2_user_status", table_name="review_items_v2")

    with op.batch_alter_table("review_items_v2") as batch_op:
        batch_op.drop_column("version")
        batch_op.drop_column("next_review_at")
        batch_op.drop_column("correct_streak")
