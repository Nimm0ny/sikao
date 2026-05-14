"""Phase 5.5 (fenbi-merge): user_goals — 用户备考总分目标.

MVP: 只存 target_score (int 0-150, app 层 Pydantic 校验). UNIQUE on user_id
保证一人一行, PUT 走 upsert 语义. module_targets / exam_track 推 follow-up
(见 docs/plan/fenbi-merge-prototype-vs-reality.md §5.5).
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0013_user_goals"
down_revision = "0012_jsonb_payloads_and_assets_relative"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_goals",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("target_score", sa.Integer(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint("user_id", name="uq_user_goals_user"),
    )
    op.create_index("ix_user_goals_user_id", "user_goals", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_goals_user_id", table_name="user_goals")
    op.drop_table("user_goals")
