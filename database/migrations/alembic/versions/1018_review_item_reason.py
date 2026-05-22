"""Phase-Practice WU-B11.4: review_items_v2 reason column + flagged_persistent.

Adds the reason column referenced by spec 02-Data-Model §2.5. Spec described
the column as already-existing with three values (wrong_answer /
low_confidence / manual_add) plus the Tab 2 addition flagged_persistent;
the actual codebase has no reason column on review_items_v2 yet, so this
revision both creates the column AND establishes the four-value enum scope
documented in the model.

Column shape:
  reason VARCHAR(32) NULL

Nullable on purpose. Pre-1018 rows were created by Phase-Home's planning /
progress / review code paths that never wrote a reason; they keep NULL
until a future review module writer pass backfills them. Application
enforces the enum (wrong_answer / low_confidence / manual_add /
flagged_persistent) at write time; no DB-level CHECK is added — same
contract pattern as PlanV2.source.

This is the closing piece of the WU-B11 quartet (B11.1-B11.4) and the last
"existing-table extension" PR before WU-B12 starts adding new tables.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "1018_review_item_reason"
down_revision = "1017_note_v2_question_link_visibility"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("review_items_v2") as batch_op:
        batch_op.add_column(sa.Column("reason", sa.String(length=32), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("review_items_v2") as batch_op:
        batch_op.drop_column("reason")
