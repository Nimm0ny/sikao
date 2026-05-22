"""Phase-Practice P1: support tables for stats/favorites/flags.

Creates the remaining non-essay support tables that the Practice P1 schema
baseline needs:

  - practice_stats_snapshot_v2
  - question_favorite_v2
  - question_flag_v2
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB


revision = "1023_practice_support_tables"
down_revision = "1022_practice_session_mock_exam"
branch_labels = None
depends_on = None

_ACTIVE_FLAG_WHERE = sa.text("resolved_at IS NULL")
_JSON_COMPAT = sa.JSON().with_variant(JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "practice_stats_snapshot_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users_v2.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("scope", sa.String(length=32), nullable=False),
        sa.Column("category_key", sa.String(length=64), nullable=True),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("total_questions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("correct_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("accuracy", sa.Float(), nullable=False, server_default="0"),
        sa.Column("total_sessions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("average_score", sa.Float(), nullable=True),
        sa.Column("recent_trend", _JSON_COMPAT, nullable=False, server_default=sa.text("'[]'")),
        sa.Column("last_practiced_at", sa.DateTime(), nullable=True),
        sa.Column("percentile_rank", sa.Float(), nullable=True),
        sa.Column("percentile_updated_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint(
            "user_id",
            "scope",
            "category_key",
            "type",
            name="uq_practice_stats_v2_scope",
        ),
    )
    op.create_index(
        "ix_practice_stats_snapshot_v2_user_id",
        "practice_stats_snapshot_v2",
        ["user_id"],
    )

    op.create_table(
        "question_favorite_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users_v2.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "question_id",
            sa.Integer(),
            sa.ForeignKey("questions_v2.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("note", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "question_id", name="uq_qfav_v2_user_question"),
    )
    op.create_index("ix_question_favorite_v2_user_id", "question_favorite_v2", ["user_id"])
    op.create_index("ix_question_favorite_v2_question_id", "question_favorite_v2", ["question_id"])

    op.create_table(
        "question_flag_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users_v2.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "question_id",
            sa.Integer(),
            sa.ForeignKey("questions_v2.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("reason", sa.String(length=32), nullable=False),
        sa.Column(
            "source_session_id",
            sa.Integer(),
            sa.ForeignKey("practice_sessions_v2.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_question_flag_v2_user_id", "question_flag_v2", ["user_id"])
    op.create_index("ix_question_flag_v2_question_id", "question_flag_v2", ["question_id"])
    op.create_index(
        "uq_qflag_v2_active_user_question",
        "question_flag_v2",
        ["user_id", "question_id"],
        unique=True,
        sqlite_where=_ACTIVE_FLAG_WHERE,
        postgresql_where=_ACTIVE_FLAG_WHERE,
    )

def downgrade() -> None:
    op.drop_index("uq_qflag_v2_active_user_question", table_name="question_flag_v2")
    op.drop_index("ix_question_flag_v2_question_id", table_name="question_flag_v2")
    op.drop_index("ix_question_flag_v2_user_id", table_name="question_flag_v2")
    op.drop_table("question_flag_v2")

    op.drop_index("ix_question_favorite_v2_question_id", table_name="question_favorite_v2")
    op.drop_index("ix_question_favorite_v2_user_id", table_name="question_favorite_v2")
    op.drop_table("question_favorite_v2")

    op.drop_index(
        "ix_practice_stats_snapshot_v2_user_id",
        table_name="practice_stats_snapshot_v2",
    )
    op.drop_table("practice_stats_snapshot_v2")
