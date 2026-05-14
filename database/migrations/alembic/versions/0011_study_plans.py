"""Slice 3a: 学习计划表 (study_plans + study_plan_tasks).

每个用户每天 1 份 study_plan (UNIQUE user_id+plan_date), 含 N 个 task.
generation_status 三态:
  success                — LLM 正常生成
  fallback_cold_start    — 用户答题数 < 阈值, 跳过 LLM 直接落写死 fallback
  fallback_llm_failed    — LLM 调用 / parse / sanity check 失败, 降 fallback

task 三类 task_kind:
  practice / review_wrong / essay_writing  (D1 砍掉 study_concept)

task status 三态 (D4):
  pending → completed / skipped (单向不可逆, 不要 in_progress)

user 走 CASCADE — 删账户带走 plan; plan→task 也 CASCADE 整套清理.
token_usage 走 SET NULL — 用量审计行保留.

plan/timeline 决策见 docs/plan/slice-3a-study-plan-be.md.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0011_study_plans"
down_revision = "0010_essay_grading"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "study_plans",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("plan_date", sa.Date(), nullable=False),
        # 'success' | 'fallback_cold_start' | 'fallback_llm_failed' (业务 enum, schema 不约束).
        sa.Column("generation_status", sa.String(length=32), nullable=False),
        sa.Column(
            "token_usage_id",
            sa.Integer(),
            sa.ForeignKey("llm_token_usage.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("user_id", "plan_date", name="uq_study_plans_user_date"),
    )
    # GET /today / list 都走 (user_id, plan_date DESC) — sqlite + PG 都生效.
    op.create_index(
        "ix_study_plans_user_date",
        "study_plans",
        ["user_id", "plan_date"],
    )

    op.create_table(
        "study_plan_tasks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "plan_id",
            sa.Integer(),
            sa.ForeignKey("study_plans.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # 'practice' | 'review_wrong' | 'essay_writing' (业务 enum, Pydantic Literal 约束).
        sa.Column("task_kind", sa.String(length=32), nullable=False),
        # task-specific shape, Pydantic discriminated union sanity 后写入. 读时
        # TypeAdapter narrow 回 outer union — 见 schemas.py.
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        # 'pending' | 'completed' | 'skipped' (D4 三态, 不要 in_progress).
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_study_plan_tasks_plan_order",
        "study_plan_tasks",
        ["plan_id", "display_order"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_study_plan_tasks_plan_order", table_name="study_plan_tasks"
    )
    op.drop_table("study_plan_tasks")
    op.drop_index("ix_study_plans_user_date", table_name="study_plans")
    op.drop_table("study_plans")
