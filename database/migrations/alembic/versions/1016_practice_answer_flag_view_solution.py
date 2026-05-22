"""Phase-Practice WU-B11.2: practice_session_answers_v2 in-session flags.

Adds three fields to practice_session_answers_v2:

  - flagged          BOOL NOT NULL DEFAULT FALSE
                     "mark as uncertain" toggle scoped to this session only;
                     cross-session persistent flags live on QuestionFlagV2.
  - viewed_solution  BOOL NOT NULL DEFAULT FALSE
                     Set when the user opened the solution panel pre-submit
                     in practice_mode=per_question. full_set sessions never
                     reach this column (route handler returns 403 first per
                     D-Q15 closed-book), but the column exists for uniform
                     post-submit result rendering.
  - view_solution_at TIMESTAMP NULL
                     Companion timestamp; remains NULL for rows where the
                     user did not view the solution.

server_default backfills all existing answers to (false, false, NULL),
which matches historical truth: pre-1016 sessions only ran in the implicit
full_set + paper mode, where viewed_solution would always be false anyway.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "1016_practice_answer_flag_view_solution"
down_revision = "1015_practice_session_practice_mode"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("practice_session_answers_v2") as batch_op:
        batch_op.add_column(
            sa.Column(
                "flagged",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("0"),
            )
        )
        batch_op.add_column(
            sa.Column(
                "viewed_solution",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("0"),
            )
        )
        batch_op.add_column(sa.Column("view_solution_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("practice_session_answers_v2") as batch_op:
        batch_op.drop_column("view_solution_at")
        batch_op.drop_column("viewed_solution")
        batch_op.drop_column("flagged")
