"""P0 review fix (#3e): drop pre_register_codes.code_hash table-level UNIQUE.

Background:
  Subagent #3 review (commit afefeaa) caught: 6-digit SMS code space = 10^6;
  当表内累积 ~1184 active rows (sqrt(2*10^6*ln 2) ≈ 1177), 下一个新 code 50%
  概率跟既有 active row 撞 hash → INSERT 撞 UniqueConstraint("code_hash")
  → IntegrityError 500, prod register 链路随机 5xx.

Fix:
  Drop table-level UNIQUE(code_hash). verify_code 已按 (target_kind,
  target_value, purpose, code_hash, used_at IS NULL, expires>now) 多条件
  WHERE 精确命中, 不需全局唯一. Cross-target attacker probe 同 code 也命中
  不到 (target_value 强约束).

Note:
  0015_*.py upgrade() create_table 用 inline `sa.UniqueConstraint(...)`,
  alembic auto-name 通常能解析. 用显式 name="uq_pre_register_codes_hash"
  drop 兜底 (跨 dialect 安全).
"""

from __future__ import annotations

from alembic import op

revision = "0016_drop_pre_register_code_hash_unique"
down_revision = "0015_email_phone_login_identity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # batch_alter_table for SQLite (DROP CONSTRAINT 不原生支持, batch 走 copy-table).
    with op.batch_alter_table("pre_register_codes") as batch_op:
        batch_op.drop_constraint(
            "uq_pre_register_codes_hash", type_="unique"
        )


def downgrade() -> None:
    # Reverse 用. 注意: downgrade 后再次 issue_code 仍可能撞 — 仅给 ops
    # 紧急回滚用, 不应作为常态.
    with op.batch_alter_table("pre_register_codes") as batch_op:
        batch_op.create_unique_constraint(
            "uq_pre_register_codes_hash", ["code_hash"]
        )
