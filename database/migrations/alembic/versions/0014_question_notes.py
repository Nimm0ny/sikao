"""Phase 3.7 (fenbi-merge): question_notes — 用户对单题的笔记 (markdown).

一个用户对一道题最多一条笔记 (UNIQUE on (user_id, question_id)). PUT 走
upsert. content 是 markdown 源文 (D-决策降级: 不引 tiptap, qlink 用
[[#017]] 语法; 详见 docs/plan/fenbi-merge-prototype-vs-reality.md §3.7).
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0014_question_notes"
down_revision = "0013_user_goals"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "question_notes",
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
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint(
            "user_id", "question_id", name="uq_question_notes_user_question"
        ),
    )
    op.create_index(
        "ix_question_notes_user_question",
        "question_notes",
        ["user_id", "question_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_question_notes_user_question", table_name="question_notes")
    op.drop_table("question_notes")
