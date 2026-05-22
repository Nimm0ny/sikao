"""Phase-Practice P1: timing reserve fields + baseline table.

Adds the schema that later timing analysis depends on:

  - practice_sessions_v2 timing aggregates
  - practice_session_answers_v2 per-answer timing facts
  - question_timing_baseline_v2

This revision does not add the timing API or cron jobs; it only creates the
persisted shape so later modules can reuse stable columns.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "1021_practice_session_timing"
down_revision = "1020_practice_session_lifecycle"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("practice_sessions_v2") as batch_op:
        batch_op.add_column(
            sa.Column(
                "total_active_seconds",
                sa.Integer(),
                nullable=False,
                server_default="0",
            )
        )
        batch_op.add_column(
            sa.Column(
                "paused_total_seconds",
                sa.Integer(),
                nullable=False,
                server_default="0",
            )
        )
        batch_op.add_column(sa.Column("first_question_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("last_activity_at", sa.DateTime(), nullable=True))

    op.create_index(
        "ix_practice_sessions_v2_user_status_activity",
        "practice_sessions_v2",
        ["user_id", "status", "last_activity_at"],
    )

    with op.batch_alter_table("practice_session_answers_v2") as batch_op:
        batch_op.add_column(
            sa.Column(
                "time_spent_ms",
                sa.Integer(),
                nullable=False,
                server_default="0",
            )
        )
        batch_op.add_column(sa.Column("first_seen_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("first_answered_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("last_modified_at", sa.DateTime(), nullable=True))
        batch_op.add_column(
            sa.Column(
                "answer_change_count",
                sa.Integer(),
                nullable=False,
                server_default="0",
            )
        )
        batch_op.add_column(
            sa.Column(
                "visit_count",
                sa.Integer(),
                nullable=False,
                server_default="0",
            )
        )
        batch_op.add_column(
            sa.Column(
                "is_overtime",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )

    op.create_table(
        "question_timing_baseline_v2",
        sa.Column(
            "question_id",
            sa.Integer(),
            sa.ForeignKey("questions_v2.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("p50_ms", sa.Integer(), nullable=False),
        sa.Column("p90_ms", sa.Integer(), nullable=False),
        sa.Column("p95_ms", sa.Integer(), nullable=False),
        sa.Column("mean_ms", sa.Integer(), nullable=False),
        sa.Column("sample_size", sa.Integer(), nullable=False),
        sa.Column("last_recomputed_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_qtb_v2_recomputed",
        "question_timing_baseline_v2",
        ["last_recomputed_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_qtb_v2_recomputed", table_name="question_timing_baseline_v2")
    op.drop_table("question_timing_baseline_v2")

    with op.batch_alter_table("practice_session_answers_v2") as batch_op:
        batch_op.drop_column("is_overtime")
        batch_op.drop_column("visit_count")
        batch_op.drop_column("answer_change_count")
        batch_op.drop_column("last_modified_at")
        batch_op.drop_column("first_answered_at")
        batch_op.drop_column("first_seen_at")
        batch_op.drop_column("time_spent_ms")

    op.drop_index(
        "ix_practice_sessions_v2_user_status_activity",
        table_name="practice_sessions_v2",
    )
    with op.batch_alter_table("practice_sessions_v2") as batch_op:
        batch_op.drop_column("last_activity_at")
        batch_op.drop_column("first_question_at")
        batch_op.drop_column("paused_total_seconds")
        batch_op.drop_column("total_active_seconds")
