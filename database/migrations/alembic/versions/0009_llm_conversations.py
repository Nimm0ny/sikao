"""Slice 1a: AI 答疑会话表 (llm_conversations + llm_messages).

会话 + 消息分两表 (1:N). 用户走 ON DELETE CASCADE — 用户删账户时 PII
答疑历史不留 (跟 0c BYOM 一致). 消息引用 token_usage 走 SET NULL — 用量
保留给 admin 审计 (跟 0b 一致), 但消息删了不删 usage 行 (反过来 token_usage
是 1:N 来源, 单 message 一行).

context_kind 字面量 (业务层 enum, schema 不约束):
  'question' | 'wrong_question' | 'session_result' | 'general'
context_id NULL 仅 'general' 走自由问 (前端 'AI 答疑' 入口直接发).

content TEXT: 单 assistant 回复一次性 INSERT (stream 累积完成后), 不存增量
chunk (避免每 chunk 一行 IO 风暴, 也防部分 chunk 写入后 crash 留半截 row).
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0009_llm_conversations"
down_revision = "0008_user_llm_configs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "llm_conversations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=128), nullable=False),
        sa.Column("context_kind", sa.String(length=32), nullable=False),
        sa.Column("context_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        # 新消息加进来时刷新, 用于 list "最近 20 条" 排序.
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_llm_conversations_user_updated",
        "llm_conversations",
        ["user_id", "updated_at"],
    )

    op.create_table(
        "llm_messages",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "conversation_id",
            sa.Integer(),
            sa.ForeignKey("llm_conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # 字面量 'system' | 'user' | 'assistant' (业务层 enum, schema 不约束).
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        # token_usage 是审计行, 删消息不删 usage; 反向 usage 删了 (cascade
        # from user) message 仍保留(只是引用断开).
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
    )
    op.create_index(
        "ix_llm_messages_conversation_created",
        "llm_messages",
        ["conversation_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_llm_messages_conversation_created", table_name="llm_messages"
    )
    op.drop_table("llm_messages")
    op.drop_index(
        "ix_llm_conversations_user_updated", table_name="llm_conversations"
    )
    op.drop_table("llm_conversations")
