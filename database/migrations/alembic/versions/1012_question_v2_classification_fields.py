"""Phase-Practice WU-B10.1: questions_v2 source + exam classification fields.

Adds the first batch of Tab 2 question taxonomy columns:

  - source        VARCHAR(32) NOT NULL DEFAULT 'real_exam'
                  one of {real_exam, ai_generated, ai_modified}; logical immutability
                  is enforced application-side and the DB-level trigger lands in
                  WU-B10.3 once content_hash backfill is in place.
  - year          SMALLINT NULL  (provenance year; AI items keep NULL)
  - region        VARCHAR(32) NULL  (国考 / 省份 / etc.; legacy rows keep NULL)
  - exam_type     VARCHAR(32) NOT NULL DEFAULT 'other'
                  one of {national, provincial, institution, xuandiao, other}
  - category_l1   VARCHAR(32) NOT NULL DEFAULT 'uncategorized'
  - category_l2   VARCHAR(64) NULL

Plus two composite indexes that match the WU-B14 content endpoint query shapes:

  - ix_questions_v2_category              (category_l1, category_l2)
  - ix_questions_v2_year_region_exam      (year, region, exam_type)

Backfill strategy: the columns are added with NOT NULL + server_default in a
single batch_alter_table block. SQLite materialises the default for existing
rows automatically, and on PostgreSQL the column-level default fills in legacy
rows during the ALTER. The application-layer code that produces NEW rows always
provides explicit values (no reliance on the server_default at runtime); the
defaults exist purely so the migration does not require a separate batched data
migration step.

Note: Phase-Practice 02-Data-Model §2.1 documents a logical "question_v2" table
name; the actual implementation table is "questions_v2" (Practice A0 §2.1).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "1012_question_v2_classification_fields"
down_revision = "1011_merge_home_drop_and_profile_tab5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("questions_v2") as batch_op:
        batch_op.add_column(
            sa.Column(
                "source",
                sa.String(length=32),
                nullable=False,
                server_default="real_exam",
            )
        )
        batch_op.add_column(sa.Column("year", sa.SmallInteger(), nullable=True))
        batch_op.add_column(sa.Column("region", sa.String(length=32), nullable=True))
        batch_op.add_column(
            sa.Column(
                "exam_type",
                sa.String(length=32),
                nullable=False,
                server_default="other",
            )
        )
        batch_op.add_column(
            sa.Column(
                "category_l1",
                sa.String(length=32),
                nullable=False,
                server_default="uncategorized",
            )
        )
        batch_op.add_column(sa.Column("category_l2", sa.String(length=64), nullable=True))

    # Indexes are created outside the batch block so they pick up the final
    # rebuilt table on SQLite without batch_op rerunning the table copy.
    op.create_index(
        "ix_questions_v2_category",
        "questions_v2",
        ["category_l1", "category_l2"],
    )
    op.create_index(
        "ix_questions_v2_year_region_exam",
        "questions_v2",
        ["year", "region", "exam_type"],
    )


def downgrade() -> None:
    op.drop_index("ix_questions_v2_year_region_exam", table_name="questions_v2")
    op.drop_index("ix_questions_v2_category", table_name="questions_v2")

    with op.batch_alter_table("questions_v2") as batch_op:
        batch_op.drop_column("category_l2")
        batch_op.drop_column("category_l1")
        batch_op.drop_column("exam_type")
        batch_op.drop_column("region")
        batch_op.drop_column("year")
        batch_op.drop_column("source")
