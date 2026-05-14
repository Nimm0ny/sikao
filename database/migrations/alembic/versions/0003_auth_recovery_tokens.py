"""Phase B (auth recovery): users.email + users.email_verified + auth_tokens.

P1 review 后续 Phase B.1: 给 forgot-password / reset-password / email-verify
flow 加 schema 支持. plan-review subagent (P0-2) 强制要求显式 op.* DDL,
不能用 Base.metadata.create_all (避免撞 0001 修过的雷).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.sql import expression


revision = "0003_auth_recovery_tokens"
down_revision = "0002_wrong_question_mastery_and_subject"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # —— users 表加 email + email_verified 列 ——
    # email nullable 让老 user 兼容; email_verified server_default '0' 让
    # NOT NULL 约束在已有数据上不爆 IntegrityError.
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("email", sa.String(length=255), nullable=True))
        # expression.false() 跨方言: PG → FALSE, SQLite → 0. sa.text("0")
        # 在 PG 上撞 "boolean default is integer" (PG 严格 type check).
        batch_op.add_column(
            sa.Column(
                "email_verified",
                sa.Boolean(),
                nullable=False,
                server_default=expression.false(),
            )
        )
    # plain UNIQUE(email) — sqlite + PG 都对 NULL 行豁免 unique violation.
    # 应用层用 lower(email) lookup 处理大小写不敏感 (P1-2 修订).
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # —— auth_tokens 表 (single-use password_reset + email_verify tokens) ——
    op.create_table(
        "auth_tokens",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        # Unique constraint inline 跨方言安全 (sqlite ALTER ADD CONSTRAINT 不支持).
        sa.UniqueConstraint("token_hash", name="uq_auth_tokens_hash"),
    )
    op.create_index("ix_auth_tokens_user_kind", "auth_tokens", ["user_id", "kind"])


def downgrade() -> None:
    op.drop_index("ix_auth_tokens_user_kind", table_name="auth_tokens")
    op.drop_table("auth_tokens")
    op.drop_index("ix_users_email", table_name="users")
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("email_verified")
        batch_op.drop_column("email")
