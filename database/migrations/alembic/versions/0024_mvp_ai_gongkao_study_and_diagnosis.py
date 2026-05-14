"""MVP AI gongkao (PR-2 + PR-3): extend study_plan_tasks + practice_session_answers.

PR-2 (study today page):
  - study_plan_tasks.result_payload JSONB: stores task completion result payload
    (e.g. session_id for practice tasks, record_id for essay tasks).
  - Extend study_plan_task_kind enum: add 'wrongbook_review', 'progress_review'.
    'quota_purchase' deliberately omitted (PR-7 billing, blocked on lhr approval).

PR-3 (xingce wrong-reason diagnosis):
  - practice_session_answers.elapsed_seconds INTEGER: time spent on question.
  - practice_session_answers.wrong_reason_code VARCHAR(32): AI diagnosis code
    (e.g. 'calculation_error', 'concept_gap', 'careless_mistake', 'question_misread').
  - practice_session_answers.wrong_reason_source VARCHAR(16): 'ai' | 'user'.
    DEFAULT 'ai' — set to 'user' when user overrides AI diagnosis.

No new tables. study_plan_task_kind enum extended via ALTER TYPE on PG; SQLite
workaround: new column with default (SQLite enum is VARCHAR, no ALTER TYPE).
Downgrade removes the 3 columns and drops the 2 new enum values.
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

_NEW_TASK_KINDS = ("wrongbook_review", "progress_review")


def _is_postgresql() -> bool:
    bind = op.get_bind()
    return bind.dialect.name == "postgresql"


def upgrade() -> None:
    # ── study_plan_tasks: result_payload ─────────────────────────────────
    op.add_column(
        "study_plan_tasks",
        sa.Column("result_payload", _JSONB_COMPAT, nullable=True),
    )

    # ── study_plan_task_kind enum extension ───────────────────────────────
    # PG: ALTER TYPE ... ADD VALUE (non-transactional in PG < 12; >= 12 OK).
    # SQLite: VARCHAR(32) — no enum DDL, just adding values is a no-op for the
    # underlying column; application-level validation enforces allowed values.
    if _is_postgresql():
        for kind in _NEW_TASK_KINDS:
            op.execute(
                sa.text(
                    f"ALTER TYPE study_plan_task_kind ADD VALUE IF NOT EXISTS :{kind}"
                ).bindparams(**{kind: kind})
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
    # PG: Cannot remove enum values without DROP TYPE + recreate (high risk).
    # Downgrade intentionally leaves 'wrongbook_review' and 'progress_review'
    # in the enum; they are harmless orphan values.
