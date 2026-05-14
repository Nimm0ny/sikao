"""SIKAO Wave 4 Phase 2C (xingce-wrongbook BE): 新表 wrong_question_attempts.

错题本"做题历史粒度"新表 — 跟 wrong_question_masteries (一题一行聚合) 互补:
  - wrong_question_masteries  : 一 (user, question) 一行 (level / consecutive_correct / ...)
  - wrong_question_attempts   : 一次做题一行 (attempt_no / selected_option_key /
                                 duration_ms / attempted_at / error_reason /
                                 is_correct).

应用场景:
  - DetailA "答题记录" 表 (第 N 次 / 选项 / 耗时 / 标记原因).
  - 蒙对识破算法 (duration_ms > avg×2 且 is_correct=True).
  - peek_count 扣减 (扣的是 mastery 的 peek_count, attempts 表只记录每次做题).

Unique constraint: (user_id, question_id, attempt_no) — 防同 user 同 question
重复 attempt_no insert.

Indexes:
  - (user_id, question_id, attempted_at)  时间序列查询 (DetailA 历史表 ORDER BY).
  - (user_id, attempted_at)               smart-review streak / 今日 stats.

0001 baseline drift: 本文件加 wrong_question_attempts 必须同步 0001_initial.py
_TABLES_ADDED_IN_LATER (memory `reference_alembic_0001_baseline_drift`).
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0019_wrong_question_attempts"
down_revision = "0018_notebook_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "wrong_question_attempts",
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
        # 该 (user, question) 内单调递增的 attempt 序号 (1, 2, 3, ...).
        sa.Column("attempt_no", sa.Integer(), nullable=False),
        # 用户本次选的 option key. 多选 '|' join (沿用 PracticeSessionAnswer.selected_answer).
        sa.Column("selected_option_key", sa.String(length=50), nullable=False),
        # 本次答题耗时 (毫秒). FE 没传时默认 0 (历史回填用).
        sa.Column("duration_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("attempted_at", sa.DateTime(), nullable=False),
        # 蒙对识破 / 用户手动标的错误原因 (业务 enum, 见 schemas.py WrongBookErrorReason).
        # nullable: 答对的题 + 用户未标记原因时为 NULL.
        sa.Column("error_reason", sa.String(length=32), nullable=True),
        sa.Column("is_correct", sa.Boolean(), nullable=False),
        sa.UniqueConstraint(
            "user_id",
            "question_id",
            "attempt_no",
            name="uq_attempts_user_question_attempt",
        ),
    )
    op.create_index(
        "ix_attempts_user_question_time",
        "wrong_question_attempts",
        ["user_id", "question_id", "attempted_at"],
    )
    op.create_index(
        "ix_attempts_user_time",
        "wrong_question_attempts",
        ["user_id", "attempted_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_attempts_user_time", table_name="wrong_question_attempts")
    op.drop_index(
        "ix_attempts_user_question_time", table_name="wrong_question_attempts"
    )
    # Unique constraint 随 drop_table 销毁 (sqlite ALTER DROP CONSTRAINT 不支持).
    op.drop_table("wrong_question_attempts")
