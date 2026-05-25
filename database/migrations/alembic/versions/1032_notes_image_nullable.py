"""Notes M2: allow orphan note images before note save.

Revision ID: 1032_notes_image_nullable
Revises: 1031_notes_crud_contract
Create Date: 2026-05-25
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "1032_notes_image_nullable"
down_revision = "1031_notes_crud_contract"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("note_images_v2") as batch_op:
        batch_op.alter_column(
            "note_id",
            existing_type=sa.Integer(),
            nullable=True,
        )


def downgrade() -> None:
    orphan_count = op.get_bind().execute(
        sa.text("SELECT COUNT(*) FROM note_images_v2 WHERE note_id IS NULL")
    ).scalar_one()
    if int(orphan_count) > 0:
        raise RuntimeError(
            "cannot downgrade 1032_notes_image_nullable while orphan note images exist"
        )

    with op.batch_alter_table("note_images_v2") as batch_op:
        batch_op.alter_column(
            "note_id",
            existing_type=sa.Integer(),
            nullable=False,
        )
