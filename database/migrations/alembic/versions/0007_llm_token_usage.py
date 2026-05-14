"""Slice 0b: LLM token usage 记账表.

每次 LLM call (system default 或 BYOM) 一行 INSERT, 含 user_id (用户走) +
feature (qa/essay_grading/study_plan) + provider (system/user_byom) + model +
token 数 (含 DeepSeek 扩展 cache hit/miss 二档) + cost_cents (估算).

User 走 ON DELETE SET NULL: 用量数据保留给 admin 审计 / 计费追溯, 不 cascade.
prompt 内容不存这表, 只存 token 数 + model + cost — 不带 PII 直接信息.

estimated 标 True 当 usage 来自 tiktoken 估算 (R9 fallback): stream final
chunk 没 usage 字段时业务层 estimate_tokens 兜底.

Slice 0c (BYOM) 不在本 migration 加 user_llm_configs (跟 plan §3.5 微调拆开,
原计划 0007 含两表, 改 0008 单独 user_llm_configs 让 atomic Slice 边界更清).
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0007_llm_token_usage"
down_revision = "0006_exam_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "llm_token_usage",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("feature", sa.String(length=32), nullable=False),
        sa.Column("resource_type", sa.String(length=32), nullable=True),
        sa.Column("resource_id", sa.Integer(), nullable=True),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("model", sa.String(length=64), nullable=False),
        sa.Column("prompt_tokens", sa.Integer(), nullable=False),
        sa.Column(
            "prompt_cache_hit_tokens",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "prompt_cache_miss_tokens",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("completion_tokens", sa.Integer(), nullable=False),
        sa.Column("total_tokens", sa.Integer(), nullable=False),
        sa.Column("cost_cents", sa.Integer(), nullable=True),
        sa.Column(
            "estimated",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_llm_token_usage_user_created",
        "llm_token_usage",
        ["user_id", "created_at"],
    )
    op.create_index(
        "ix_llm_token_usage_feature_created",
        "llm_token_usage",
        ["feature", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_llm_token_usage_feature_created", table_name="llm_token_usage")
    op.drop_index("ix_llm_token_usage_user_created", table_name="llm_token_usage")
    op.drop_table("llm_token_usage")
