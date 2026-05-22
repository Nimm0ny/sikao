"""Phase-Practice P1: practice_sessions_v2 lifecycle reserve fields.

Schema-only foundation for the later session_lifecycle module:

  - status-adjacent timestamps and reasons
  - self-recovery pointer
  - lifecycle CHECK constraints
  - terminal-state immutability trigger

No routes or state-machine services land here; this revision only establishes
the columns and fail-fast DB invariants that later modules will build on.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "1020_practice_session_lifecycle"
down_revision = "1019_question_metadata_phase1"
branch_labels = None
depends_on = None

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


def _create_terminal_trigger() -> None:
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        op.execute(_TERMINAL_TRIGGER_PG)
        return
    if dialect == "sqlite":
        op.execute(_TERMINAL_TRIGGER_SQLITE)
        return
    raise RuntimeError(
        "1020_practice_session_lifecycle requires terminal trigger support "
        f"for dialect {dialect!r}"
    )


def _drop_terminal_trigger() -> None:
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        op.execute("DROP TRIGGER IF EXISTS practice_sessions_v2_terminal_protect ON practice_sessions_v2")
        op.execute("DROP FUNCTION IF EXISTS protect_practice_sessions_v2_terminal_state()")
        return
    if dialect == "sqlite":
        op.execute("DROP TRIGGER IF EXISTS practice_sessions_v2_terminal_protect")
        return
    raise RuntimeError(
        "1020_practice_session_lifecycle requires terminal trigger downgrade "
        f"support for dialect {dialect!r}"
    )


def upgrade() -> None:
    with op.batch_alter_table("practice_sessions_v2") as batch_op:
        batch_op.add_column(sa.Column("paused_at", sa.DateTime(), nullable=True))
        batch_op.add_column(
            sa.Column("paused_count", sa.Integer(), nullable=False, server_default="0")
        )
        batch_op.add_column(sa.Column("last_heartbeat_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("expires_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("abandoned_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("abandoned_reason", sa.String(length=64), nullable=True))
        batch_op.add_column(
            sa.Column(
                "force_submitted",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
        batch_op.add_column(
            sa.Column("force_submitted_reason", sa.String(length=64), nullable=True)
        )
        batch_op.add_column(
            sa.Column(
                "recovered_from_session_id",
                sa.Integer(),
                sa.ForeignKey(
                    "practice_sessions_v2.id",
                    name="fk_ps_v2_recovered_from_session_id",
                    ondelete="SET NULL",
                ),
                nullable=True,
            )
        )
        batch_op.create_check_constraint(
            "ck_ps_v2_paused_status",
            "(status = 'paused' AND paused_at IS NOT NULL) OR "
            "(status != 'paused' AND paused_at IS NULL)",
        )
        batch_op.create_check_constraint(
            "ck_ps_v2_abandoned_reason",
            "(status != 'abandoned') OR (abandoned_reason IS NOT NULL)",
        )
        batch_op.create_check_constraint(
            "ck_ps_v2_force_submit_reason",
            "(force_submitted = false) OR (force_submitted_reason IS NOT NULL)",
        )

    _create_terminal_trigger()


def downgrade() -> None:
    _drop_terminal_trigger()

    with op.batch_alter_table("practice_sessions_v2") as batch_op:
        batch_op.drop_constraint("ck_ps_v2_force_submit_reason", type_="check")
        batch_op.drop_constraint("ck_ps_v2_abandoned_reason", type_="check")
        batch_op.drop_constraint("ck_ps_v2_paused_status", type_="check")
        batch_op.drop_column("recovered_from_session_id")
        batch_op.drop_column("force_submitted_reason")
        batch_op.drop_column("force_submitted")
        batch_op.drop_column("abandoned_reason")
        batch_op.drop_column("abandoned_at")
        batch_op.drop_column("expires_at")
        batch_op.drop_column("last_heartbeat_at")
        batch_op.drop_column("paused_count")
        batch_op.drop_column("paused_at")
