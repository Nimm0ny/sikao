"""Slice 2c: 申论批改记录表 (essay_grading_records).

每次用户提交一次申论答案 → 一行 record. status 状态机:
  pending  — 用户已提交, BackgroundTask 异步评分中
  completed — LLM 返回 + sanity check 通过, score / feedback_json 落地
  failed   — LLM / parse / sanity check 任一失败, failure_reason 描述

user_id / question_id 都走 CASCADE — 用户删账户 + 题目删除 → 答案 PII 不留.
token_usage_id 走 SET NULL — 用量审计行保留, 删 record 不删 usage.

feedback_json (sa.JSON dev SQLite TEXT / prod PG JSONB) 存:
  {
    overallScore: float,
    dimensions: [{name, weight, score 0-10, comment}] (5 维度: 论点/材料/语言/结构/字数),
    strengths/weaknesses/suggestions: list[str],
    sampleAnswer: str | None  (AI 生成示范答案, ±10% 题干字数),
    suspicious: bool  (5 维度全相等差 ≤0.5 / sampleAnswer 字数偏离 ±20% 标弱提示)
  }
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0010_essay_grading"
down_revision = "0009_llm_conversations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "essay_grading_records",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "question_id",
            sa.Integer(),
            sa.ForeignKey("questions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("answer_text", sa.Text(), nullable=False),
        # 字面量 'pending' | 'completed' | 'failed' (业务层 enum, schema 不约束).
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        # NUMERIC(5,2) 0.00-100.00 加权后总分; sanity check 业务层 clamp 后写入.
        sa.Column("score", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("feedback_json", sa.JSON(), nullable=True),
        # token usage 审计行 (Slice 0b llm_token_usage), 删 record 不删 usage.
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
        sa.Column("graded_at", sa.DateTime(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    # list "我的批改历史" 按时间倒序索引.
    op.create_index(
        "ix_essay_grading_records_user_created",
        "essay_grading_records",
        ["user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_essay_grading_records_user_created",
        table_name="essay_grading_records",
    )
    op.drop_table("essay_grading_records")
