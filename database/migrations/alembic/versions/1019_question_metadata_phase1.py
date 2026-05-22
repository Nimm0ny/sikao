"""Phase-Practice P1: question metadata reserve fields + phase-2 tables.

Adds the Phase-1 schema-only question metadata surface:

  - questions_v2 reserve fields:
      ability_dimensions / discrimination_index / heat_score /
      complexity_level / knowledge_tags
  - knowledge_point_v2
  - question_knowledge_point_v2

Phase 1 explicitly does NOT add endpoints or data-fill jobs. The tables stay
empty outside tests; this revision only lands the schema so later Practice /
Review work can depend on stable keys without another wide table rewrite.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB


revision = "1019_question_metadata_phase1"
down_revision = "1018_review_item_reason"
branch_labels = None
depends_on = None

_JSON_COMPAT = sa.JSON().with_variant(JSONB(), "postgresql")

_ABILITY_DIM_TRIGGER_PG = """
CREATE OR REPLACE FUNCTION validate_questions_v2_ability_dimensions()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(COALESCE(NEW.ability_dimensions::jsonb, '[]'::jsonb)) AS elem(value)
    WHERE value NOT IN ('comprehension', 'reasoning', 'calculation', 'memory', 'application')
  ) THEN
    RAISE EXCEPTION 'questions_v2.ability_dimensions contains unsupported value';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER questions_v2_ability_dim_validate_ins
BEFORE INSERT ON questions_v2
FOR EACH ROW EXECUTE FUNCTION validate_questions_v2_ability_dimensions();

CREATE TRIGGER questions_v2_ability_dim_validate_upd
BEFORE UPDATE OF ability_dimensions ON questions_v2
FOR EACH ROW EXECUTE FUNCTION validate_questions_v2_ability_dimensions();
"""

_ABILITY_DIM_TRIGGER_SQLITE = """
CREATE TRIGGER questions_v2_ability_dim_validate_ins
BEFORE INSERT ON questions_v2
FOR EACH ROW
WHEN EXISTS (
  SELECT 1
  FROM json_each(COALESCE(NEW.ability_dimensions, '[]'))
  WHERE value NOT IN ('comprehension', 'reasoning', 'calculation', 'memory', 'application')
)
BEGIN
  SELECT RAISE(ABORT, 'questions_v2.ability_dimensions contains unsupported value');
END;

CREATE TRIGGER questions_v2_ability_dim_validate_upd
BEFORE UPDATE OF ability_dimensions ON questions_v2
FOR EACH ROW
WHEN EXISTS (
  SELECT 1
  FROM json_each(COALESCE(NEW.ability_dimensions, '[]'))
  WHERE value NOT IN ('comprehension', 'reasoning', 'calculation', 'memory', 'application')
)
BEGIN
  SELECT RAISE(ABORT, 'questions_v2.ability_dimensions contains unsupported value');
END;
"""


def _create_ability_dimension_triggers() -> None:
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        op.execute(_ABILITY_DIM_TRIGGER_PG)
        return
    if dialect == "sqlite":
        for statement in _ABILITY_DIM_TRIGGER_SQLITE.strip().split(";\n\n"):
            if statement.strip():
                op.execute(statement)
        return
    raise RuntimeError(
        "1019_question_metadata_phase1 requires ability-dimension trigger "
        f"support for dialect {dialect!r}"
    )


def _drop_ability_dimension_triggers() -> None:
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        op.execute("DROP TRIGGER IF EXISTS questions_v2_ability_dim_validate_upd ON questions_v2")
        op.execute("DROP TRIGGER IF EXISTS questions_v2_ability_dim_validate_ins ON questions_v2")
        op.execute("DROP FUNCTION IF EXISTS validate_questions_v2_ability_dimensions()")
        return
    if dialect == "sqlite":
        op.execute("DROP TRIGGER IF EXISTS questions_v2_ability_dim_validate_upd")
        op.execute("DROP TRIGGER IF EXISTS questions_v2_ability_dim_validate_ins")
        return
    raise RuntimeError(
        "1019_question_metadata_phase1 requires ability-dimension trigger "
        f"downgrade support for dialect {dialect!r}"
    )


def upgrade() -> None:
    with op.batch_alter_table("questions_v2") as batch_op:
        batch_op.add_column(
            sa.Column(
                "ability_dimensions",
                _JSON_COMPAT,
                nullable=False,
                server_default=sa.text("'[]'"),
            )
        )
        batch_op.add_column(sa.Column("discrimination_index", sa.Float(), nullable=True))
        batch_op.add_column(
            sa.Column(
                "heat_score",
                sa.Float(),
                nullable=False,
                server_default="0",
            )
        )
        batch_op.add_column(sa.Column("complexity_level", sa.SmallInteger(), nullable=True))
        batch_op.add_column(
            sa.Column(
                "knowledge_tags",
                _JSON_COMPAT,
                nullable=False,
                server_default=sa.text("'[]'"),
            )
        )
        batch_op.create_check_constraint(
            "ck_q_v2_complexity_range",
            "complexity_level IS NULL OR (complexity_level >= 1 AND complexity_level <= 5)",
        )
        batch_op.create_check_constraint(
            "ck_q_v2_heat_non_negative",
            "heat_score >= 0.0",
        )

    op.create_index("ix_questions_v2_heat", "questions_v2", ["heat_score"])

    op.create_table(
        "knowledge_point_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("label", sa.String(length=128), nullable=False),
        sa.Column("category_l1", sa.String(length=32), nullable=False),
        sa.Column("category_l2", sa.String(length=64), nullable=True),
        sa.Column(
            "parent_id",
            sa.Integer(),
            sa.ForeignKey("knowledge_point_v2.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("weight_in_exam", sa.Float(), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_knowledge_point_v2_code", "knowledge_point_v2", ["code"], unique=True)
    op.create_index("ix_knowledge_point_v2_category_l1", "knowledge_point_v2", ["category_l1"])
    op.create_index("ix_knowledge_point_v2_category_l2", "knowledge_point_v2", ["category_l2"])
    op.create_index("ix_knowledge_point_v2_is_active", "knowledge_point_v2", ["is_active"])

    op.create_table(
        "question_knowledge_point_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "question_id",
            sa.Integer(),
            sa.ForeignKey("questions_v2.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "knowledge_point_id",
            sa.Integer(),
            sa.ForeignKey("knowledge_point_v2.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "weight",
            sa.Float(),
            nullable=False,
            server_default="1",
        ),
        sa.Column("annotated_by", sa.String(length=32), nullable=False),
        sa.Column("annotated_at", sa.DateTime(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.UniqueConstraint(
            "question_id",
            "knowledge_point_id",
            name="uq_qkp_v2_question_knowledge",
        ),
    )
    op.create_index(
        "ix_question_knowledge_point_v2_question_id",
        "question_knowledge_point_v2",
        ["question_id"],
    )
    op.create_index(
        "ix_question_knowledge_point_v2_knowledge_point_id",
        "question_knowledge_point_v2",
        ["knowledge_point_id"],
    )

    _create_ability_dimension_triggers()


def downgrade() -> None:
    _drop_ability_dimension_triggers()

    op.drop_index(
        "ix_question_knowledge_point_v2_knowledge_point_id",
        table_name="question_knowledge_point_v2",
    )
    op.drop_index(
        "ix_question_knowledge_point_v2_question_id",
        table_name="question_knowledge_point_v2",
    )
    op.drop_table("question_knowledge_point_v2")

    op.drop_index("ix_knowledge_point_v2_is_active", table_name="knowledge_point_v2")
    op.drop_index("ix_knowledge_point_v2_category_l2", table_name="knowledge_point_v2")
    op.drop_index("ix_knowledge_point_v2_category_l1", table_name="knowledge_point_v2")
    op.drop_index("ix_knowledge_point_v2_code", table_name="knowledge_point_v2")
    op.drop_table("knowledge_point_v2")

    op.drop_index("ix_questions_v2_heat", table_name="questions_v2")
    with op.batch_alter_table("questions_v2") as batch_op:
        batch_op.drop_constraint("ck_q_v2_heat_non_negative", type_="check")
        batch_op.drop_constraint("ck_q_v2_complexity_range", type_="check")
        batch_op.drop_column("knowledge_tags")
        batch_op.drop_column("complexity_level")
        batch_op.drop_column("heat_score")
        batch_op.drop_column("discrimination_index")
        batch_op.drop_column("ability_dimensions")
