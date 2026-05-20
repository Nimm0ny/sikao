"""Create planning, progress, review, notes, and profile v2 tables."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "1004_planning_progress_review_profile_v2_tables"
down_revision = "1003_session_and_grading_v2_tables"
branch_labels = None
depends_on = None

_JSONB_COMPAT = sa.JSON().with_variant(JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "daily_plans_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plan_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "plan_date", name="uq_daily_plans_v2_user_date"),
    )

    op.create_table(
        "daily_plan_items_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("daily_plan_id", sa.Integer(), sa.ForeignKey("daily_plans_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_kind", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("state", sa.String(length=32), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("metadata_json", _JSONB_COMPAT, nullable=False),
    )

    op.create_table(
        "weekly_plans_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("summary_json", _JSONB_COMPAT, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "week_start", name="uq_weekly_plans_v2_user_week"),
    )

    op.create_table(
        "diagnosis_reports_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("summary_json", _JSONB_COMPAT, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_diagnosis_reports_v2_user_created", "diagnosis_reports_v2", ["user_id", "created_at"])

    op.create_table(
        "progress_snapshots_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("data_json", _JSONB_COMPAT, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "snapshot_date", name="uq_progress_snapshots_v2_user_date"),
    )

    op.create_table(
        "weakness_snapshots_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("subject_key", sa.String(length=64), nullable=False),
        sa.Column("severity", sa.String(length=32), nullable=False),
        sa.Column("data_json", _JSONB_COMPAT, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint(
            "user_id",
            "snapshot_date",
            "subject_key",
            name="uq_weakness_snapshots_v2_user_date_subject",
        ),
    )

    op.create_table(
        "review_items_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_kind", sa.String(length=32), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("question_id", sa.Integer(), sa.ForeignKey("questions_v2.id", ondelete="SET NULL"), nullable=True),
        sa.Column("essay_submission_id", sa.Integer(), sa.ForeignKey("essay_submissions_v2.id", ondelete="SET NULL"), nullable=True),
        sa.Column("metadata_json", _JSONB_COMPAT, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_review_items_v2_user_created", "review_items_v2", ["user_id", "created_at"])

    op.create_table(
        "review_attempts_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("review_item_id", sa.Integer(), sa.ForeignKey("review_items_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("outcome", sa.String(length=32), nullable=False),
        sa.Column("notes_json", _JSONB_COMPAT, nullable=False),
        sa.Column("attempted_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_review_attempts_v2_item_attempted", "review_attempts_v2", ["review_item_id", "attempted_at"])

    op.create_table(
        "notes_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_notes_v2_user_updated", "notes_v2", ["user_id", "updated_at"])

    op.create_table(
        "note_links_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("note_id", sa.Integer(), sa.ForeignKey("notes_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("link_kind", sa.String(length=32), nullable=False),
        sa.Column("link_target_id", sa.String(length=64), nullable=False),
    )
    op.create_index("ix_note_links_v2_note", "note_links_v2", ["note_id"])

    op.create_table(
        "profile_infos_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("real_name", sa.String(length=255), nullable=True),
        sa.Column("region", sa.String(length=128), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", name="uq_profile_infos_v2_user"),
    )

    op.create_table(
        "profile_goals_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_exam", sa.String(length=128), nullable=True),
        sa.Column("target_score", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("weekly_target_hours", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", name="uq_profile_goals_v2_user"),
    )


def downgrade() -> None:
    op.drop_table("profile_goals_v2")
    op.drop_table("profile_infos_v2")
    op.drop_index("ix_note_links_v2_note", table_name="note_links_v2")
    op.drop_table("note_links_v2")
    op.drop_index("ix_notes_v2_user_updated", table_name="notes_v2")
    op.drop_table("notes_v2")
    op.drop_index("ix_review_attempts_v2_item_attempted", table_name="review_attempts_v2")
    op.drop_table("review_attempts_v2")
    op.drop_index("ix_review_items_v2_user_created", table_name="review_items_v2")
    op.drop_table("review_items_v2")
    op.drop_table("weakness_snapshots_v2")
    op.drop_table("progress_snapshots_v2")
    op.drop_index("ix_diagnosis_reports_v2_user_created", table_name="diagnosis_reports_v2")
    op.drop_table("diagnosis_reports_v2")
    op.drop_table("weekly_plans_v2")
    op.drop_table("daily_plan_items_v2")
    op.drop_table("daily_plans_v2")
