"""Phase-Practice P5: question report user foundation."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB


revision = "1026_question_report"
down_revision = "1025_essay_reference_tables"
branch_labels = None
depends_on = None

_ACTIVE_REPORT_WHERE = sa.text(
    "status IN ('pending', 'acknowledged') AND deleted_at IS NULL"
)
_JSON_COMPAT = sa.JSON().with_variant(JSONB(), "postgresql")

_TERMINAL_TRIGGER_PG = """
CREATE OR REPLACE FUNCTION protect_qreport_v2_terminal_state()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('resolved_fixed', 'resolved_invalid', 'resolved_duplicate')
     AND (
       OLD.status IS DISTINCT FROM NEW.status
       OR OLD.handled_by_admin_id IS DISTINCT FROM NEW.handled_by_admin_id
       OR OLD.handled_at IS DISTINCT FROM NEW.handled_at
       OR OLD.admin_response IS DISTINCT FROM NEW.admin_response
       OR OLD.duplicate_of_report_id IS DISTINCT FROM NEW.duplicate_of_report_id
       OR OLD.applied_fix IS DISTINCT FROM NEW.applied_fix
     ) THEN
    RAISE EXCEPTION 'question_report_v2 terminal state is immutable (was %)', OLD.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER qreport_v2_terminal_protect
BEFORE UPDATE ON question_report_v2
FOR EACH ROW EXECUTE FUNCTION protect_qreport_v2_terminal_state();
"""

_TERMINAL_TRIGGER_SQLITE = """
CREATE TRIGGER qreport_v2_terminal_protect
BEFORE UPDATE ON question_report_v2
FOR EACH ROW
WHEN OLD.status IN ('resolved_fixed', 'resolved_invalid', 'resolved_duplicate')
 AND (
   OLD.status IS NOT NEW.status
   OR OLD.handled_by_admin_id IS NOT NEW.handled_by_admin_id
   OR OLD.handled_at IS NOT NEW.handled_at
   OR OLD.admin_response IS NOT NEW.admin_response
   OR OLD.duplicate_of_report_id IS NOT NEW.duplicate_of_report_id
   OR OLD.applied_fix IS NOT NEW.applied_fix
 )
BEGIN
  SELECT RAISE(ABORT, 'question_report_v2 terminal state is immutable');
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
        "1026_question_report requires terminal trigger support "
        f"for dialect {dialect!r}"
    )


def _drop_terminal_trigger() -> None:
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        op.execute(
            "DROP TRIGGER IF EXISTS qreport_v2_terminal_protect ON question_report_v2"
        )
        op.execute("DROP FUNCTION IF EXISTS protect_qreport_v2_terminal_state()")
        return
    if dialect == "sqlite":
        op.execute("DROP TRIGGER IF EXISTS qreport_v2_terminal_protect")
        return
    raise RuntimeError(
        "1026_question_report requires terminal trigger downgrade support "
        f"for dialect {dialect!r}"
    )


def upgrade() -> None:
    op.create_table(
        "question_report_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users_v2.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "question_id",
            sa.Integer(),
            sa.ForeignKey("questions_v2.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("description", sa.String(length=1000), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column(
            "handled_by_admin_id",
            sa.Integer(),
            sa.ForeignKey("users_v2.id"),
            nullable=True,
        ),
        sa.Column("handled_at", sa.DateTime(), nullable=True),
        sa.Column("admin_response", sa.String(length=1000), nullable=True),
        sa.Column(
            "duplicate_of_report_id",
            sa.Integer(),
            sa.ForeignKey("question_report_v2.id"),
            nullable=True,
        ),
        sa.Column("applied_fix", _JSON_COMPAT, nullable=True),
        sa.Column(
            "source_session_id",
            sa.Integer(),
            sa.ForeignKey("practice_sessions_v2.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("selected_answer_at_report", _JSON_COMPAT, nullable=True),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint(
            "length(description) >= 10 AND length(description) <= 1000",
            name="ck_qreport_v2_desc_len",
        ),
        sa.CheckConstraint(
            "(status NOT IN ('resolved_fixed', 'resolved_invalid', 'resolved_duplicate')) "
            "OR (handled_by_admin_id IS NOT NULL AND handled_at IS NOT NULL AND admin_response IS NOT NULL)",
            name="ck_qreport_v2_resolved_admin",
        ),
        sa.CheckConstraint(
            "((status = 'resolved_fixed' AND applied_fix IS NOT NULL) "
            "OR (status != 'resolved_fixed' AND applied_fix IS NULL))",
            name="ck_qreport_v2_fix_when_fixed",
        ),
        sa.CheckConstraint(
            "((status = 'resolved_duplicate' AND duplicate_of_report_id IS NOT NULL) "
            "OR (status != 'resolved_duplicate' AND duplicate_of_report_id IS NULL))",
            name="ck_qreport_v2_dup_when_dup",
        ),
    )
    op.create_index("ix_qreport_v2_user_id", "question_report_v2", ["user_id"])
    op.create_index("ix_qreport_v2_question_id", "question_report_v2", ["question_id"])
    op.create_index(
        "ix_qreport_v2_status_created",
        "question_report_v2",
        ["status", "created_at"],
    )
    op.create_index(
        "uq_qreport_v2_active_user_q_cat",
        "question_report_v2",
        ["user_id", "question_id", "category"],
        unique=True,
        sqlite_where=_ACTIVE_REPORT_WHERE,
        postgresql_where=_ACTIVE_REPORT_WHERE,
    )
    _create_terminal_trigger()


def downgrade() -> None:
    _drop_terminal_trigger()
    op.drop_index("uq_qreport_v2_active_user_q_cat", table_name="question_report_v2")
    op.drop_index("ix_qreport_v2_status_created", table_name="question_report_v2")
    op.drop_index("ix_qreport_v2_question_id", table_name="question_report_v2")
    op.drop_index("ix_qreport_v2_user_id", table_name="question_report_v2")
    op.drop_table("question_report_v2")
