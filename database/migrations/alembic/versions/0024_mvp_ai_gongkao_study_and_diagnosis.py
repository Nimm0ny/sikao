"""MVP AI gongkao (PR-2 + PR-3): extend study_plan_tasks + practice_session_answers.

PR-2 (study today page):
  - study_plan_tasks.result_payload JSONB: stores task completion result payload
    (e.g. session_id for practice tasks, record_id for essay tasks).
  - No task_kind DDL change needed: study_plan_tasks.task_kind is VARCHAR(32)
    (not a PG enum), so supported values are enforced at the application layer only.

PR-3 (xingce wrong-reason diagnosis):
  - practice_session_answers.elapsed_seconds INTEGER: time spent on question.
  - practice_session_answers.wrong_reason_code VARCHAR(32): AI diagnosis code
    (e.g. 'calculation_error', 'concept_gap', 'careless_mistake', 'question_misread').
  - practice_session_answers.wrong_reason_source VARCHAR(16): 'ai' | 'user'.
    DEFAULT 'ai' — set to 'user' when user overrides AI diagnosis.

No new tables. Downgrade removes the 4 added columns.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0024_mvp_ai_gongkao_study_and_diagnosis"
down_revision = "0023_essay_draft_sessions"
branch_labels = None
depends_on = None

_JSONB_COMPAT = sa.JSON().with_variant(JSONB(), "postgresql")


def upgrade() -> None:
    # ── study_plan_tasks: result_payload ─────────────────────────────────
    op.add_column(
        "study_plan_tasks",
        sa.Column("result_payload", _JSONB_COMPAT, nullable=True),
    )

    # ── practice_session_answers: diagnosis columns ───────────────────────
    op.add_column(
        "practice_session_answers",
        sa.Column("elapsed_seconds", sa.Integer(), nullable=True),
    )
    op.add_column(
        "practice_session_answers",
        sa.Column("wrong_reason_code", sa.String(32), nullable=True),
    )
    op.add_column(
        "practice_session_answers",
        sa.Column(
            "wrong_reason_source",
            sa.String(16),
            nullable=True,
            server_default="ai",
        ),
    )


def downgrade() -> None:
    op.drop_column("practice_session_answers", "wrong_reason_source")
    op.drop_column("practice_session_answers", "wrong_reason_code")
    op.drop_column("practice_session_answers", "elapsed_seconds")
    op.drop_column("study_plan_tasks", "result_payload")
