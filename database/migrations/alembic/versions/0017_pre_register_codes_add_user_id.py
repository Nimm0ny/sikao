"""Identity v2 (#4a): pre_register_codes 加 user_id 字段防 bind token leak.

Background:
  Bind email/phone 流 (verify-then-write D10) 用 PreRegisterCode 存 code/token.
  没 user_id 时, attacker 偷 victim 的 bind-email link → 在 attacker session
  confirm → confirm endpoint 找到 row (target_value=newEmail, purpose=bind_email,
  hash 命中) → 写 **attacker.email = newEmail** (而非 victim).
  Logged-in 检查不够 — 需 row.user_id 对应当前 session user.

Fix:
  ADD user_id (nullable, FK users.id ondelete CASCADE).
    - register / login_otp: user_id IS NULL (user 不存在)
    - bind_phone / bind_email: user_id = current_user.id (verify 时强匹配)
  ADD ix_pre_register_codes_user index 给 cleanup job + bind lookup.

Note:
  pre_register_codes 整张表是 alembic 0015 添加. 0001 baseline (to_metadata)
  整表 skip (in _TABLES_ADDED_IN_LATER), 不需更新 baseline drift checklist.
  0015 create_table 不含 user_id; fresh DB 走 0001 → ... → 0015 (建表无字段)
  → 0016 (drop UNIQUE) → 0017 (ADD user_id), 跟 ORM 当前 state 一致.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0017_pre_register_codes_add_user_id"
down_revision = "0016_drop_pre_register_code_hash_unique"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("pre_register_codes") as batch_op:
        batch_op.add_column(
            sa.Column(
                "user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="CASCADE", name="fk_pre_register_codes_user_id"),
                nullable=True,
            )
        )
    op.create_index(
        "ix_pre_register_codes_user", "pre_register_codes", ["user_id"]
    )


def downgrade() -> None:
    op.drop_index(
        "ix_pre_register_codes_user", table_name="pre_register_codes"
    )
    with op.batch_alter_table("pre_register_codes") as batch_op:
        batch_op.drop_column("user_id")
