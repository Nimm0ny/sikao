"""Phase 5.4a: add Question.subject + wrong_question_masteries table."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0002_wrong_question_mastery_and_subject"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # —— Question.subject：显式"科目"字段。首次导入 NULL，由 backfill 脚本填充。 ——
    with op.batch_alter_table("questions") as batch_op:
        batch_op.add_column(sa.Column("subject", sa.String(length=50), nullable=True))
    op.create_index("ix_questions_subject", "questions", ["subject"])

    # —— wrong_question_masteries：错题掌握度追踪表。 ——
    # 显式 op.create_table（不沿用 0001 的 Base.metadata.create_all 风格），
    # 避免存量 PG 环境重算现有 index 导致的兼容性问题。
    # Unique constraint inline in create_table — sqlite 不支持 ALTER TABLE ADD
    # CONSTRAINT, 后置 op.create_unique_constraint 会在 sqlite 跑挂. inline
    # 跨方言安全 (PG 也接受).
    op.create_table(
        "wrong_question_masteries",
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
        sa.Column(
            "mastery_level",
            sa.String(length=20),
            nullable=False,
            server_default="not_mastered",
        ),
        sa.Column("last_wrong_time", sa.DateTime(), nullable=False),
        sa.Column(
            "consecutive_correct_count",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "last_updated",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("user_id", "question_id", name="uq_mastery_user_question"),
    )
    op.create_index(
        "ix_mastery_user_question",
        "wrong_question_masteries",
        ["user_id", "question_id"],
    )
    op.create_index(
        "ix_mastery_user_updated",
        "wrong_question_masteries",
        ["user_id", "last_updated"],
    )


def downgrade() -> None:
    op.drop_index("ix_mastery_user_updated", table_name="wrong_question_masteries")
    op.drop_index("ix_mastery_user_question", table_name="wrong_question_masteries")
    # Unique constraint 随 drop_table 一起销毁 — sqlite 也不支持 ALTER DROP CONSTRAINT,
    # 这里不再单独 op.drop_constraint 保持跨方言对称.
    op.drop_table("wrong_question_masteries")

    op.drop_index("ix_questions_subject", table_name="questions")
    with op.batch_alter_table("questions") as batch_op:
        batch_op.drop_column("subject")
