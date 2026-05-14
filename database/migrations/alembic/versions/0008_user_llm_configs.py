"""Slice 0c: User BYOM (Bring Your Own Model) 配置表.

每用户可配置多个 LLM endpoint (label / base_url / api_key / model 四元组).
api_key_encrypted 是 AES-256-GCM 加密的 BYTEA, layout = `version (1B) ||
nonce (12B) || ciphertext_with_tag (var)`. AAD 绑定 user_id 防 ciphertext
被剪贴到别人的 record (详 services/llm/byom_config.py).

is_default 标记用户当前激活的 config (build_llm_provider 优先读). 同 user
最多一个 is_default=True (业务层 set_default 流程保证, schema 没 enforce).

User 删了走 ON DELETE CASCADE: BYOM key 也删 (避免悬挂加密 blob, 也防 key
仍被引用 — Slice 0a/0b 的 llm_token_usage 走 SET NULL 是审计需要, BYOM
config 没审计需要).
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0008_user_llm_configs"
down_revision = "0007_llm_token_usage"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_llm_configs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("label", sa.String(length=64), nullable=False),
        sa.Column("base_url", sa.String(length=255), nullable=False),
        # api_key_encrypted: version || nonce || ct+tag (详 byom_config.py).
        # SQLAlchemy LargeBinary → PG BYTEA / SQLite BLOB.
        sa.Column("api_key_encrypted", sa.LargeBinary(), nullable=False),
        sa.Column("model", sa.String(length=64), nullable=False),
        sa.Column(
            "is_default",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        # 字面量 'ok' | 'unreachable' | 'auth_failed' | 'timeout' | NULL (从未测过)
        sa.Column("last_tested_at", sa.DateTime(), nullable=True),
        sa.Column("last_tested_status", sa.String(length=16), nullable=True),
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
        sa.UniqueConstraint("user_id", "label", name="uq_user_llm_configs_user_label"),
    )
    op.create_index(
        "ix_user_llm_configs_user_default",
        "user_llm_configs",
        ["user_id", "is_default"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_user_llm_configs_user_default", table_name="user_llm_configs"
    )
    op.drop_table("user_llm_configs")
