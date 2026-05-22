"""Phase-Practice WU-B11.1: practice_sessions_v2 mode + config snapshot.

Adds the three Tab 2 session shape fields:

  - practice_mode    VARCHAR(32) NOT NULL DEFAULT 'full_set'
                     enum: per_question | full_set
  - source_mode      VARCHAR(32) NOT NULL DEFAULT 'paper'
                     enum: paper | category | custom | ai_generated | daily | wrong_redo
  - config_snapshot  JSON       NOT NULL DEFAULT '{}'
                     opaque per-source picker config

server_default values backfill legacy sessions in a single batch_alter_table
block. Existing rows pre-date Tab 2 entirely and were all paper-driven
sessions in full-set mode (the only flow the old session module supported),
so the literal defaults match the historical truth without further data work.

Application-level enforcement: practice_mode + source_mode are conceptually
immutable post-create. The DB-level guarantee lives in WU-B26 once the
session lifecycle module ships; this revision keeps the contract documented
in the model docstring only.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "1015_practice_session_practice_mode"
down_revision = "1014_question_v2_indexes_and_immutable"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("practice_sessions_v2") as batch_op:
        batch_op.add_column(
            sa.Column(
                "practice_mode",
                sa.String(length=32),
                nullable=False,
                server_default="full_set",
            )
        )
        batch_op.add_column(
            sa.Column(
                "source_mode",
                sa.String(length=32),
                nullable=False,
                server_default="paper",
            )
        )
        batch_op.add_column(
            sa.Column(
                "config_snapshot",
                sa.JSON(),
                nullable=False,
                server_default=sa.text("'{}'"),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("practice_sessions_v2") as batch_op:
        batch_op.drop_column("config_snapshot")
        batch_op.drop_column("source_mode")
        batch_op.drop_column("practice_mode")
