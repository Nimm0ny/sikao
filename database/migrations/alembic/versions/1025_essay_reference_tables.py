"""Phase-Practice P1: essay reference answer tables + feedback counter trigger."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "1025_essay_reference_tables"
down_revision = "1024_practice_ai_daily_preferences"
branch_labels = None
depends_on = None

_SYNC_TRIGGER_PG = """
CREATE OR REPLACE FUNCTION sync_essay_reference_feedback_counts()
RETURNS TRIGGER AS $$
DECLARE
  target_id INTEGER;
BEGIN
  target_id := COALESCE(NEW.reference_id, OLD.reference_id);
  UPDATE essay_reference_answer_v2
  SET likes_count = (
        SELECT COUNT(*) FROM essay_reference_feedback_v2
        WHERE reference_id = target_id AND action = 'like'
      ),
      favorites_count = (
        SELECT COUNT(*) FROM essay_reference_feedback_v2
        WHERE reference_id = target_id AND action = 'favorite'
      ),
      report_count = (
        SELECT COUNT(*) FROM essay_reference_feedback_v2
        WHERE reference_id = target_id AND action = 'report'
      )
  WHERE id = target_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER essay_reference_feedback_v2_sync_ins
AFTER INSERT ON essay_reference_feedback_v2
FOR EACH ROW EXECUTE FUNCTION sync_essay_reference_feedback_counts();

CREATE TRIGGER essay_reference_feedback_v2_sync_del
AFTER DELETE ON essay_reference_feedback_v2
FOR EACH ROW EXECUTE FUNCTION sync_essay_reference_feedback_counts();

CREATE TRIGGER essay_reference_feedback_v2_sync_upd
AFTER UPDATE OF action, reference_id ON essay_reference_feedback_v2
FOR EACH ROW EXECUTE FUNCTION sync_essay_reference_feedback_counts();
"""

_SYNC_TRIGGER_SQLITE = """
CREATE TRIGGER essay_reference_feedback_v2_sync_ins
AFTER INSERT ON essay_reference_feedback_v2
FOR EACH ROW
BEGIN
  UPDATE essay_reference_answer_v2
  SET likes_count = (
        SELECT COUNT(*) FROM essay_reference_feedback_v2
        WHERE reference_id = NEW.reference_id AND action = 'like'
      ),
      favorites_count = (
        SELECT COUNT(*) FROM essay_reference_feedback_v2
        WHERE reference_id = NEW.reference_id AND action = 'favorite'
      ),
      report_count = (
        SELECT COUNT(*) FROM essay_reference_feedback_v2
        WHERE reference_id = NEW.reference_id AND action = 'report'
      )
  WHERE id = NEW.reference_id;
END;

CREATE TRIGGER essay_reference_feedback_v2_sync_del
AFTER DELETE ON essay_reference_feedback_v2
FOR EACH ROW
BEGIN
  UPDATE essay_reference_answer_v2
  SET likes_count = (
        SELECT COUNT(*) FROM essay_reference_feedback_v2
        WHERE reference_id = OLD.reference_id AND action = 'like'
      ),
      favorites_count = (
        SELECT COUNT(*) FROM essay_reference_feedback_v2
        WHERE reference_id = OLD.reference_id AND action = 'favorite'
      ),
      report_count = (
        SELECT COUNT(*) FROM essay_reference_feedback_v2
        WHERE reference_id = OLD.reference_id AND action = 'report'
      )
  WHERE id = OLD.reference_id;
END;

CREATE TRIGGER essay_reference_feedback_v2_sync_upd
AFTER UPDATE OF action, reference_id ON essay_reference_feedback_v2
FOR EACH ROW
BEGIN
  UPDATE essay_reference_answer_v2
  SET likes_count = (
        SELECT COUNT(*) FROM essay_reference_feedback_v2
        WHERE reference_id = OLD.reference_id AND action = 'like'
      ),
      favorites_count = (
        SELECT COUNT(*) FROM essay_reference_feedback_v2
        WHERE reference_id = OLD.reference_id AND action = 'favorite'
      ),
      report_count = (
        SELECT COUNT(*) FROM essay_reference_feedback_v2
        WHERE reference_id = OLD.reference_id AND action = 'report'
      )
  WHERE id = OLD.reference_id;

  UPDATE essay_reference_answer_v2
  SET likes_count = (
        SELECT COUNT(*) FROM essay_reference_feedback_v2
        WHERE reference_id = NEW.reference_id AND action = 'like'
      ),
      favorites_count = (
        SELECT COUNT(*) FROM essay_reference_feedback_v2
        WHERE reference_id = NEW.reference_id AND action = 'favorite'
      ),
      report_count = (
        SELECT COUNT(*) FROM essay_reference_feedback_v2
        WHERE reference_id = NEW.reference_id AND action = 'report'
      )
  WHERE id = NEW.reference_id;
END;
"""


def _create_feedback_sync_triggers() -> None:
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        op.execute(_SYNC_TRIGGER_PG)
        return
    if dialect == "sqlite":
        raw_connection = op.get_bind().connection.dbapi_connection
        raw_connection.executescript(_SYNC_TRIGGER_SQLITE)
        return
    raise RuntimeError(
        "1025_essay_reference_tables requires feedback trigger support for "
        f"dialect {dialect!r}"
    )


def _drop_feedback_sync_triggers() -> None:
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        op.execute("DROP TRIGGER IF EXISTS essay_reference_feedback_v2_sync_del ON essay_reference_feedback_v2")
        op.execute("DROP TRIGGER IF EXISTS essay_reference_feedback_v2_sync_ins ON essay_reference_feedback_v2")
        op.execute("DROP TRIGGER IF EXISTS essay_reference_feedback_v2_sync_upd ON essay_reference_feedback_v2")
        op.execute("DROP FUNCTION IF EXISTS sync_essay_reference_feedback_counts()")
        return
    if dialect == "sqlite":
        op.execute("DROP TRIGGER IF EXISTS essay_reference_feedback_v2_sync_del")
        op.execute("DROP TRIGGER IF EXISTS essay_reference_feedback_v2_sync_ins")
        op.execute("DROP TRIGGER IF EXISTS essay_reference_feedback_v2_sync_upd")
        return
    raise RuntimeError(
        "1025_essay_reference_tables requires feedback trigger downgrade "
        f"support for dialect {dialect!r}"
    )


def upgrade() -> None:
    op.create_table(
        "essay_reference_answer_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "question_id",
            sa.Integer(),
            sa.ForeignKey("questions_v2.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column(
            "created_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users_v2.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_by_admin",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("likes_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("favorites_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("report_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("quality_score", sa.Float(), nullable=False, server_default="5"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.Column("ai_self_audit_passed", sa.Boolean(), nullable=True),
        sa.Column("ai_generated_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_essay_ref_answer_v2_question_status",
        "essay_reference_answer_v2",
        ["question_id", "status"],
    )
    op.create_index(
        "ix_essay_reference_answer_v2_question_id",
        "essay_reference_answer_v2",
        ["question_id"],
    )

    op.create_table(
        "essay_reference_feedback_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "reference_id",
            sa.Integer(),
            sa.ForeignKey("essay_reference_answer_v2.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users_v2.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("note", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint(
            "reference_id",
            "user_id",
            "action",
            name="uq_essay_ref_feedback_v2",
        ),
    )
    op.create_index(
        "ix_essay_reference_feedback_v2_reference_id",
        "essay_reference_feedback_v2",
        ["reference_id"],
    )
    op.create_index(
        "ix_essay_reference_feedback_v2_user_id",
        "essay_reference_feedback_v2",
        ["user_id"],
    )
    _create_feedback_sync_triggers()


def downgrade() -> None:
    _drop_feedback_sync_triggers()
    op.drop_index(
        "ix_essay_reference_feedback_v2_user_id",
        table_name="essay_reference_feedback_v2",
    )
    op.drop_index(
        "ix_essay_reference_feedback_v2_reference_id",
        table_name="essay_reference_feedback_v2",
    )
    op.drop_table("essay_reference_feedback_v2")

    op.drop_index(
        "ix_essay_ref_answer_v2_question_status",
        table_name="essay_reference_answer_v2",
    )
    op.drop_index(
        "ix_essay_reference_answer_v2_question_id",
        table_name="essay_reference_answer_v2",
    )
    op.drop_table("essay_reference_answer_v2")
