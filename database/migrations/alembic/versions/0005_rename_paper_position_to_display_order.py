"""Phase 7 ARCH §7.3 P3 (KEY OBS #2): rename
practice_session_answers.paper_position → display_order.

Old column name "paper_position" implied "position within paper revision",
but cross-paper retry sessions (mode=retry_wrong_cross_paper, alembic 0004)
write synthetic batch index here. Rename to display_order to honestly express
"the order this answer shows in the session" — works for both legacy
paper-bound and new cross-paper sessions.

不动 column 数据 (类型 + 值 + index 都保留), 只改名字. SQLite 用 batch_alter_
table rebuild path; PG 直接 ALTER ... RENAME.
"""

from __future__ import annotations

from alembic import op


revision = "0005_rename_paper_position_to_display_order"
down_revision = "0004_cross_paper_retry_session"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("practice_session_answers") as batch_op:
        batch_op.alter_column("paper_position", new_column_name="display_order")


def downgrade() -> None:
    with op.batch_alter_table("practice_session_answers") as batch_op:
        batch_op.alter_column("display_order", new_column_name="paper_position")
