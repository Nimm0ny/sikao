"""Phase 7 ARCH §7.2 Pages P2: practice_sessions cross-paper retry support.

Cross-paper retry session 的 questions 来自多个 paper_revision, 不能绑定
单一 revision. 改动:
- paper_id + paper_revision_id 改 nullable. 用 paper_revision_id IS NULL 当
  cross-paper marker. 业务路径 (submit / complete / result) 在 service 层 dispatch.
- 加 retry_question_ids_json TEXT NULL — cross-paper session 持 batch allowlist
  (B-review B4 修: 防 user 提交 batch 外的题污染 session).

不动 FK ON DELETE CASCADE 行为 — paper 删除还会触发 session 删除. cross-
paper session 不绑 paper, ON DELETE CASCADE 触发不到, 但 user 删除仍会 cascade
PracticeSession (via user_id FK), 数据不漏.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0004_cross_paper_retry_session"
down_revision = "0003_auth_recovery_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # batch_alter_table 让 sqlite ALTER COLUMN nullable 走 rebuild path.
    with op.batch_alter_table("practice_sessions") as batch_op:
        batch_op.alter_column("paper_id", nullable=True)
        batch_op.alter_column("paper_revision_id", nullable=True)
        batch_op.add_column(
            sa.Column("retry_question_ids_json", sa.Text(), nullable=True)
        )


def downgrade() -> None:
    # 回退前必须保证没 cross-paper retry session 行 (paper_revision_id IS NULL),
    # 否则 ALTER NOT NULL 会失败. ops 自查 / 手清.
    with op.batch_alter_table("practice_sessions") as batch_op:
        batch_op.drop_column("retry_question_ids_json")
        batch_op.alter_column("paper_id", nullable=False)
        batch_op.alter_column("paper_revision_id", nullable=False)
