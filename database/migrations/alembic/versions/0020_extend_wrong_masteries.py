"""SIKAO Wave 4 Phase 2C (xingce-wrongbook BE): 扩 wrong_question_masteries 4 字段.

新加字段:
  - error_reasons   JSONB_COMPAT (list[str], default=[]) — 用户在该题上累计标
                    记过的错误原因 (陷阱掉入 / 时间不足 / ...). DetailA banner +
                    chip 显示用. 应用层永远 list (memory
                    `reference_jsonb_compat_pattern`).
  - bluff_count     int default 0 — 蒙对识破累计 (耗时 > 均时×2 + 答对). Standout
                    "蒙对识破" 卡 + isDanger 判定输入.
  - peek_count      int default 3 — 重做模式"偷看答案"剩余次数. 每偷看一次扣 1.
                    0 时拒绝 peek.
  - attempts_json   JSONB_COMPAT (list[dict] backup) — attempts 备份 / 历史回填用,
                    主路径走 wrong_question_attempts (0019) 关系表. attempts_json
                    是 cold-storage backup, 应用层选择性写 (默认不写).

0001 baseline drift: 4 个新 column 必须同步 0001_initial.py
_COLUMNS_ADDED_IN_LATER (memory `reference_alembic_0001_baseline_drift`).

向后兼容: 所有新字段都有 default, 老行 ALTER 后自动填入 default. 不动 last_wrong_time
(保留原名, 不引入 last_wrong_at 别名, 避免 SSOT 漂移).
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0020_extend_wrong_masteries"
down_revision = "0019_wrong_question_attempts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 跨方言 JSONB_COMPAT: PG 用 JSONB, SQLite 兜底 JSON (TEXT).
    with op.batch_alter_table("wrong_question_masteries") as batch_op:
        batch_op.add_column(
            sa.Column(
                "error_reasons",
                sa.JSON(),
                nullable=False,
                server_default=sa.text("'[]'"),
            )
        )
        batch_op.add_column(
            sa.Column(
                "bluff_count",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("0"),
            )
        )
        batch_op.add_column(
            sa.Column(
                "peek_count",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("3"),
            )
        )
        batch_op.add_column(
            sa.Column(
                "attempts_json",
                sa.JSON(),
                nullable=True,
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("wrong_question_masteries") as batch_op:
        batch_op.drop_column("attempts_json")
        batch_op.drop_column("peek_count")
        batch_op.drop_column("bluff_count")
        batch_op.drop_column("error_reasons")
