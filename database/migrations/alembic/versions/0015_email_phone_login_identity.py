"""Identity v2 (email/phone login + binding): users phone fields + username
nullable + pre_register_codes table.

详见 docs/plan/email-phone-login-and-binding.md.

Schema 变更:
  - users: ADD phone (str(11) nullable, unique, indexed)
  - users: ADD phone_verified (bool NOT NULL default false)
  - users: ALTER username DROP NOT NULL (D6/D7: 抛弃 username 主标识,
    保留 display 用; 老 user 兼容期 username 仍可作 identifier fallback —
    详 D15)
  - pre_register_codes: CREATE TABLE (D9: target-bound code 给 register/bind/
    future OTP login; SRP 跟 user-bound auth_tokens 隔离)

Downgrade 路径警示 (review fix #4):
  users.username SET NOT NULL 前必须 backfill 含 NULL username 行
  (phone 注册的新 user). migration 测试覆盖此路径; 否则 IntegrityError.

Baseline drift 同步 (0001_initial.py):
  - _TABLES_ADDED_IN_LATER: + "pre_register_codes"
  - _COLUMNS_ADDED_IN_LATER: + ("users", "phone") + ("users", "phone_verified")
  - _INDEXES_ADDED_IN_LATER: + "ix_users_phone"
  - _FORCE_NOT_NULL_IN_0001: + ("users", "username")
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.sql import expression

from alembic import op

revision = "0015_email_phone_login_identity"
down_revision = "0014_question_notes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # —— users 表加 phone + phone_verified, alter username nullable ——
    # batch_alter_table 让 SQLite 也能 ALTER COLUMN nullability.
    # phone server_default 不需要 (nullable, 老行 NULL 即可).
    # phone_verified server_default expression.false() 跨方言: PG → FALSE,
    # SQLite → 0. 老行回填 false.
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("phone", sa.String(length=11), nullable=True))
        batch_op.add_column(
            sa.Column(
                "phone_verified",
                sa.Boolean(),
                nullable=False,
                server_default=expression.false(),
            )
        )
        # D6: username 不再作为登录 identifier (新 phone 用户可以无 username).
        # 保留 unique 约束 — NULL 在 PG/SQLite 都豁免 unique violation.
        batch_op.alter_column("username", nullable=True, existing_type=sa.String(length=100))

    # plain UNIQUE(phone) — 跟 ix_users_email 同模式. NULL 多行 OK.
    op.create_index("ix_users_phone", "users", ["phone"], unique=True)

    # —— pre_register_codes 表 (D9: target-bound code) ——
    op.create_table(
        "pre_register_codes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        # 'phone' | 'email'
        sa.Column("target_kind", sa.String(length=10), nullable=False),
        # normalized: phone 11-digit / email lower-strip
        sa.Column("target_value", sa.String(length=255), nullable=False),
        # sha256(6-digit code) hex
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        # 'register' | 'bind_phone' | 'bind_email' | 'login_otp' (future)
        sa.Column("purpose", sa.String(length=20), nullable=False),
        # D17 (b): 单 code confirm 失败次数 ≥3 → mark used_at=now (一次性废)
        sa.Column(
            "attempt_count", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        # 额外发现 B (review fix): metadata only, 不做 IP /24 同段硬阻塞.
        # IPv6 最长 39 字符 + IPv4-mapped prefix → 45 留 buffer.
        sa.Column("requester_ip", sa.String(length=45), nullable=True),
        sa.Column("confirmer_ip", sa.String(length=45), nullable=True),
        sa.UniqueConstraint("code_hash", name="uq_pre_register_codes_hash"),
    )
    op.create_index(
        "ix_pre_register_codes_target",
        "pre_register_codes",
        ["target_kind", "target_value"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_pre_register_codes_target", table_name="pre_register_codes"
    )
    op.drop_table("pre_register_codes")
    op.drop_index("ix_users_phone", table_name="users")
    with op.batch_alter_table("users") as batch_op:
        # ⚠️ SET NOT NULL 前必须 backfill: UPDATE users SET username = id::text
        # WHERE username IS NULL — 否则 IntegrityError. 不在 migration 自动做
        # (避免 silent 数据修改); 调用方 ops 必须先手动 backfill 再 downgrade.
        batch_op.alter_column(
            "username", nullable=False, existing_type=sa.String(length=100)
        )
        batch_op.drop_column("phone_verified")
        batch_op.drop_column("phone")
