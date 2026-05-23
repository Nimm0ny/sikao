"""Phase-Practice P1: mock-exam reserve fields on practice_sessions_v2.

Adds the schema-only mock exam surface that later modules depend on:

  - exam_mode flag and limits
  - delayed-review controls
  - auto_submit_at immutability trigger
  - DB CHECK constraints that keep mock sessions internally coherent
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "1022_practice_session_mock_exam"
down_revision = "1021_practice_session_timing"
branch_labels = None
depends_on = None

_AUTO_SUBMIT_TRIGGER_PG = """
CREATE OR REPLACE FUNCTION protect_practice_sessions_v2_auto_submit_at()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.auto_submit_at IS NOT NULL
     AND OLD.auto_submit_at IS DISTINCT FROM NEW.auto_submit_at THEN
    RAISE EXCEPTION 'practice_sessions_v2.auto_submit_at is immutable once set';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER practice_sessions_v2_auto_submit_at_protect
BEFORE UPDATE OF auto_submit_at ON practice_sessions_v2
FOR EACH ROW EXECUTE FUNCTION protect_practice_sessions_v2_auto_submit_at();
"""

_AUTO_SUBMIT_TRIGGER_SQLITE = """
CREATE TRIGGER practice_sessions_v2_auto_submit_at_protect
BEFORE UPDATE OF auto_submit_at ON practice_sessions_v2
FOR EACH ROW
WHEN OLD.auto_submit_at IS NOT NULL
 AND OLD.auto_submit_at IS NOT NEW.auto_submit_at
BEGIN
  SELECT RAISE(ABORT, 'practice_sessions_v2.auto_submit_at is immutable once set');
END;
"""

_TERMINAL_TRIGGER_PG = """
CREATE OR REPLACE FUNCTION protect_practice_sessions_v2_terminal_state()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('submitted', 'abandoned', 'expired')
     AND (
       OLD.status IS DISTINCT FROM NEW.status
       OR OLD.submitted_at IS DISTINCT FROM NEW.submitted_at
       OR OLD.abandoned_at IS DISTINCT FROM NEW.abandoned_at
       OR OLD.force_submitted IS DISTINCT FROM NEW.force_submitted
       OR OLD.force_submitted_reason IS DISTINCT FROM NEW.force_submitted_reason
     ) THEN
    RAISE EXCEPTION 'practice_sessions_v2 terminal state is immutable (was %)', OLD.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER practice_sessions_v2_terminal_protect
BEFORE UPDATE ON practice_sessions_v2
FOR EACH ROW EXECUTE FUNCTION protect_practice_sessions_v2_terminal_state();
"""

_TERMINAL_TRIGGER_SQLITE = """
CREATE TRIGGER practice_sessions_v2_terminal_protect
BEFORE UPDATE ON practice_sessions_v2
FOR EACH ROW
WHEN OLD.status IN ('submitted', 'abandoned', 'expired')
 AND (
   OLD.status IS NOT NEW.status
   OR OLD.submitted_at IS NOT NEW.submitted_at
   OR OLD.abandoned_at IS NOT NEW.abandoned_at
   OR OLD.force_submitted IS NOT NEW.force_submitted
   OR OLD.force_submitted_reason IS NOT NEW.force_submitted_reason
 )
BEGIN
  SELECT RAISE(ABORT, 'practice_sessions_v2 terminal state is immutable');
END;
"""


def _create_auto_submit_trigger() -> None:
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        op.execute(_AUTO_SUBMIT_TRIGGER_PG)
        return
    if dialect == "sqlite":
        op.execute(_AUTO_SUBMIT_TRIGGER_SQLITE)
        return
    raise RuntimeError(
        "1022_practice_session_mock_exam requires auto-submit trigger support "
        f"for dialect {dialect!r}"
    )


def _drop_auto_submit_trigger() -> None:
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        op.execute("DROP TRIGGER IF EXISTS practice_sessions_v2_auto_submit_at_protect ON practice_sessions_v2")
        op.execute("DROP FUNCTION IF EXISTS protect_practice_sessions_v2_auto_submit_at()")
        return
    if dialect == "sqlite":
        op.execute("DROP TRIGGER IF EXISTS practice_sessions_v2_auto_submit_at_protect")
        return
    raise RuntimeError(
        "1022_practice_session_mock_exam requires auto-submit trigger downgrade "
        f"support for dialect {dialect!r}"
    )


def _create_terminal_trigger() -> None:
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        op.execute("DROP TRIGGER IF EXISTS practice_sessions_v2_terminal_protect ON practice_sessions_v2")
        op.execute(_TERMINAL_TRIGGER_PG)
        return
    if dialect == "sqlite":
        op.execute("DROP TRIGGER IF EXISTS practice_sessions_v2_terminal_protect")
        op.execute(_TERMINAL_TRIGGER_SQLITE)
        return
    raise RuntimeError(
        "1022_practice_session_mock_exam requires terminal trigger support "
        f"for dialect {dialect!r}"
    )


def upgrade() -> None:
    with op.batch_alter_table("practice_sessions_v2") as batch_op:
        batch_op.add_column(
            sa.Column(
                "exam_mode",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
        batch_op.add_column(sa.Column("time_limit_minutes", sa.SmallInteger(), nullable=True))
        batch_op.add_column(sa.Column("auto_submit_at", sa.DateTime(), nullable=True))
        batch_op.add_column(
            sa.Column(
                "allow_review_during",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
        batch_op.add_column(
            sa.Column(
                "allow_pause",
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            )
        )
        batch_op.add_column(sa.Column("delayed_review_until", sa.DateTime(), nullable=True))
        batch_op.create_check_constraint(
            "ck_ps_v2_mock_time_limit",
            "(exam_mode = false) OR (time_limit_minutes IS NOT NULL)",
        )
        batch_op.create_check_constraint(
            "ck_ps_v2_mock_full_set",
            "(exam_mode = false) OR (practice_mode = 'full_set')",
        )
        batch_op.create_check_constraint(
            "ck_ps_v2_mock_paper_source",
            "(exam_mode = false) OR (source_mode = 'paper')",
        )
        batch_op.create_check_constraint(
            "ck_ps_v2_mock_time_range",
            "time_limit_minutes IS NULL OR (time_limit_minutes >= 10 AND time_limit_minutes <= 360)",
        )

    op.create_index(
        "ix_practice_sessions_v2_mock_auto_submit",
        "practice_sessions_v2",
        ["exam_mode", "status", "auto_submit_at"],
    )
    _create_terminal_trigger()
    _create_auto_submit_trigger()


def downgrade() -> None:
    _drop_auto_submit_trigger()
    op.drop_index(
        "ix_practice_sessions_v2_mock_auto_submit",
        table_name="practice_sessions_v2",
    )
    with op.batch_alter_table("practice_sessions_v2") as batch_op:
        batch_op.drop_constraint("ck_ps_v2_mock_time_range", type_="check")
        batch_op.drop_constraint("ck_ps_v2_mock_paper_source", type_="check")
        batch_op.drop_constraint("ck_ps_v2_mock_full_set", type_="check")
        batch_op.drop_constraint("ck_ps_v2_mock_time_limit", type_="check")
        batch_op.drop_column("delayed_review_until")
        batch_op.drop_column("allow_pause")
        batch_op.drop_column("allow_review_during")
        batch_op.drop_column("auto_submit_at")
        batch_op.drop_column("time_limit_minutes")
        batch_op.drop_column("exam_mode")
    _create_terminal_trigger()
