"""Create Home Phase plan and event v2 tables."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "1005_home_plan_and_event_v2"
down_revision = "1004_planning_progress_review_profile_v2_tables"
branch_labels = None
depends_on = None

_JSONB_COMPAT = sa.JSON().with_variant(JSONB(), "postgresql")
_PLAN_ACTIVE_WHERE = sa.text("status = 'active' AND deleted_at IS NULL")
_EVENT_ALIVE_WHERE = sa.text("deleted_at IS NULL")


def upgrade() -> None:
    op.create_table(
        "plan_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("target_exam_id", sa.String(length=64), nullable=False),
        sa.Column("target_exam_date", sa.Date(), nullable=False),
        sa.Column("daily_minutes_target", sa.Integer(), nullable=False),
        sa.Column("style", sa.String(length=32), nullable=False),
        sa.Column("baseline", _JSONB_COMPAT, nullable=False),
        sa.Column("focus_subjects", _JSONB_COMPAT, nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("change_log", _JSONB_COMPAT, nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("archived_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("daily_minutes_target BETWEEN 60 AND 720", name="ck_plan_v2_minutes"),
    )
    op.create_index("ix_plan_v2_user_status", "plan_v2", ["user_id", "status"])
    op.create_index(
        "ix_plan_v2_user_active",
        "plan_v2",
        ["user_id"],
        unique=True,
        sqlite_where=_PLAN_ACTIVE_WHERE,
        postgresql_where=_PLAN_ACTIVE_WHERE,
    )

    op.create_table(
        "plan_event_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("plan_id", sa.Integer(), sa.ForeignKey("plan_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("start_at", sa.DateTime(), nullable=False),
        sa.Column("end_at", sa.DateTime(), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("recurring_rule", sa.Text(), nullable=True),
        sa.Column(
            "recurring_parent_id",
            sa.Integer(),
            sa.ForeignKey("plan_event_v2.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("recurring_exception_dates", _JSONB_COMPAT, nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column(
            "linked_session_id",
            sa.Integer(),
            sa.ForeignKey("practice_sessions_v2.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("target_id", sa.Integer(), nullable=True),
        sa.Column("change_log", _JSONB_COMPAT, nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("end_at > start_at", name="ck_event_v2_time_window"),
    )
    op.create_index("ix_event_v2_user_range", "plan_event_v2", ["user_id", "start_at", "end_at"])
    op.create_index("ix_event_v2_plan_range", "plan_event_v2", ["plan_id", "start_at"])
    op.create_index("ix_event_v2_recurring_parent", "plan_event_v2", ["recurring_parent_id"])
    op.create_index(
        "ix_event_v2_user_alive",
        "plan_event_v2",
        ["user_id"],
        sqlite_where=_EVENT_ALIVE_WHERE,
        postgresql_where=_EVENT_ALIVE_WHERE,
    )


def downgrade() -> None:
    op.drop_index("ix_event_v2_user_alive", table_name="plan_event_v2")
    op.drop_index("ix_event_v2_recurring_parent", table_name="plan_event_v2")
    op.drop_index("ix_event_v2_plan_range", table_name="plan_event_v2")
    op.drop_index("ix_event_v2_user_range", table_name="plan_event_v2")
    op.drop_table("plan_event_v2")
    op.drop_index("ix_plan_v2_user_active", table_name="plan_v2")
    op.drop_index("ix_plan_v2_user_status", table_name="plan_v2")
    op.drop_table("plan_v2")
