"""Phase-Practice WU-B10.3: questions_v2 post-backfill invariants.

Final B10 revision. Backfills content_hash via the canonical helper, dedups
pre-existing collisions (oldest by id keeps its hash + active; younger rows
get content_hash NULLed and is_active flipped off so UNIQUE can land), then
adds UNIQUE(content_hash), the (source, is_active) composite index, and the
source-immutable trigger.

Spec (02-Data-Model §5.1) only mandates the PG trigger. This revision also
installs a SQLite trigger because the test bench runs on SQLite and AGENTS
H7 (fail-fast) prefers DB-level enforcement over per-call validation.
"""

from __future__ import annotations

import sys
from pathlib import Path

import sqlalchemy as sa
from alembic import op


revision = "1014_question_v2_indexes_and_immutable"
down_revision = "1013_question_v2_quality_and_ai_fields"
branch_labels = None
depends_on = None


_TRIGGER_PG = """
CREATE OR REPLACE FUNCTION protect_questions_v2_source()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.source IS DISTINCT FROM NEW.source THEN
    RAISE EXCEPTION 'questions_v2.source is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER questions_v2_source_protect
BEFORE UPDATE OF source ON questions_v2
FOR EACH ROW EXECUTE FUNCTION protect_questions_v2_source();
"""

_TRIGGER_SQLITE = """
CREATE TRIGGER questions_v2_source_protect
BEFORE UPDATE OF source ON questions_v2
FOR EACH ROW WHEN OLD.source IS NOT NEW.source
BEGIN
  SELECT RAISE(ABORT, 'questions_v2.source is immutable');
END;
"""


def _backfill_content_hash() -> None:
    # Helper module lives under services/api/src; alembic env.py adds it to
    # sys.path during normal CLI runs but we re-add defensively for direct
    # `alembic upgrade` invocations.
    api_src = Path(__file__).resolve().parents[3] / "services" / "api" / "src"
    if str(api_src) not in sys.path:
        sys.path.insert(0, str(api_src))
    from sikao_api.db.content_hash import compute_question_content_hash

    bind = op.get_bind()
    last_id = 0
    while True:
        rows = bind.execute(
            sa.text(
                "SELECT id, prompt, content_json FROM questions_v2 "
                "WHERE content_hash IS NULL AND id > :last_id "
                "ORDER BY id LIMIT 500"
            ),
            {"last_id": last_id},
        ).fetchall()
        if not rows:
            break
        for row in rows:
            digest = compute_question_content_hash(row.prompt or "", row.content_json)
            bind.execute(
                sa.text("UPDATE questions_v2 SET content_hash = :h WHERE id = :id"),
                {"h": digest, "id": row.id},
            )
        last_id = rows[-1].id

    # Dedup losers: oldest id wins, younger rows get NULL hash + is_active=0.
    # NULL hash is allowed by UNIQUE in both PG and SQLite, so this clears the
    # path for the constraint that lands next.
    bind.execute(sa.text(
        "UPDATE questions_v2 SET is_active = 0, content_hash = NULL "
        "WHERE id IN ("
        "  SELECT q.id FROM questions_v2 q "
        "  JOIN ("
        "    SELECT content_hash, MIN(id) AS keeper_id FROM questions_v2 "
        "    WHERE content_hash IS NOT NULL "
        "    GROUP BY content_hash HAVING COUNT(*) > 1"
        "  ) dup ON q.content_hash = dup.content_hash AND q.id <> dup.keeper_id"
        ")"
    ))


def upgrade() -> None:
    _backfill_content_hash()
    with op.batch_alter_table("questions_v2") as batch_op:
        batch_op.create_unique_constraint(
            "uq_questions_v2_content_hash", ["content_hash"]
        )
    op.create_index(
        "ix_questions_v2_source_active", "questions_v2", ["source", "is_active"]
    )
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        op.execute(_TRIGGER_PG)
    elif dialect == "sqlite":
        op.execute(_TRIGGER_SQLITE)
    else:
        raise RuntimeError(
            f"WU-B10.3 source-immutable trigger has no implementation for "
            f"dialect {dialect!r}; add one before running this migration."
        )


def downgrade() -> None:
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        op.execute("DROP TRIGGER IF EXISTS questions_v2_source_protect ON questions_v2")
        op.execute("DROP FUNCTION IF EXISTS protect_questions_v2_source()")
    elif dialect == "sqlite":
        op.execute("DROP TRIGGER IF EXISTS questions_v2_source_protect")
    else:
        raise RuntimeError(
            f"WU-B10.3 source-immutable trigger has no downgrade for "
            f"dialect {dialect!r}."
        )
    op.drop_index("ix_questions_v2_source_active", table_name="questions_v2")
    with op.batch_alter_table("questions_v2") as batch_op:
        batch_op.drop_constraint("uq_questions_v2_content_hash", type_="unique")
