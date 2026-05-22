"""Phase-Practice WU-B10.2: questions_v2 quality signals + AI source fields.

Adds the second batch of Tab 2 question taxonomy columns. WU-B10.1 covered
classification (source / exam_type / category); this revision covers the
quality signals the recommender / picker rank on, the AI provenance back-
reference, and the dedup hash column (UNIQUE constraint deferred to B10.3
so legacy backfill can run between).

Columns added:

  - historical_accuracy   FLOAT   NOT NULL DEFAULT 0.0   ([0.0, 1.0])
  - answer_count          INT     NOT NULL DEFAULT 0
  - quality_score         FLOAT   NOT NULL DEFAULT 5.0   ([0.0, 5.0]; AI only)
  - report_count          INT     NOT NULL DEFAULT 0
  - is_active             BOOL    NOT NULL DEFAULT TRUE  (single-col index)
  - content_hash          VARCHAR(32) NULL    (UNIQUE comes in B10.3)
  - ai_source_question_id INT     NULL FK questions_v2.id ondelete SET NULL
  - ai_self_audit_passed  BOOL    NULL
  - ai_generated_at       TIMESTAMP NULL

Single index added: ix_questions_v2_is_active. Composite indexes that mix
is_active with source (`ix_questions_v2_source_active`) are added in WU-B10.3
together with the content_hash UNIQUE constraint and the source-immutable
trigger so all "post-backfill invariants" land in one revision.

server_default values backfill legacy rows in a single batch_alter_table
block (consistent with WU-B10.1). New rows always provide explicit values
from the application layer; defaults exist purely for the migration.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "1013_question_v2_quality_and_ai_fields"
down_revision = "1012_question_v2_classification_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("questions_v2") as batch_op:
        batch_op.add_column(
            sa.Column(
                "historical_accuracy",
                sa.Float(),
                nullable=False,
                server_default="0",
            )
        )
        batch_op.add_column(
            sa.Column(
                "answer_count",
                sa.Integer(),
                nullable=False,
                server_default="0",
            )
        )
        batch_op.add_column(
            sa.Column(
                "quality_score",
                sa.Float(),
                nullable=False,
                server_default="5",
            )
        )
        batch_op.add_column(
            sa.Column(
                "report_count",
                sa.Integer(),
                nullable=False,
                server_default="0",
            )
        )
        batch_op.add_column(
            sa.Column(
                "is_active",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("1"),
            )
        )
        batch_op.add_column(sa.Column("content_hash", sa.String(length=32), nullable=True))
        batch_op.add_column(
            sa.Column(
                "ai_source_question_id",
                sa.Integer(),
                sa.ForeignKey(
                    "questions_v2.id",
                    name="fk_questions_v2_ai_source_question_id",
                    ondelete="SET NULL",
                ),
                nullable=True,
            )
        )
        batch_op.add_column(sa.Column("ai_self_audit_passed", sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column("ai_generated_at", sa.DateTime(), nullable=True))

    op.create_index("ix_questions_v2_is_active", "questions_v2", ["is_active"])


def downgrade() -> None:
    op.drop_index("ix_questions_v2_is_active", table_name="questions_v2")
    with op.batch_alter_table("questions_v2") as batch_op:
        batch_op.drop_column("ai_generated_at")
        batch_op.drop_column("ai_self_audit_passed")
        batch_op.drop_column("ai_source_question_id")
        batch_op.drop_column("content_hash")
        batch_op.drop_column("is_active")
        batch_op.drop_column("report_count")
        batch_op.drop_column("quality_score")
        batch_op.drop_column("answer_count")
        batch_op.drop_column("historical_accuracy")
