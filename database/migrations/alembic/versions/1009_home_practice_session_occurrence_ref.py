"""Add recurring occurrence ref to practice sessions."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "1009_home_practice_session_occurrence_ref"
down_revision = "1008_home_profile_session_audit_v2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("practice_sessions_v2") as batch_op:
        batch_op.add_column(
            sa.Column("linked_plan_event_occurrence_ref", sa.String(length=64), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("practice_sessions_v2") as batch_op:
        batch_op.drop_column("linked_plan_event_occurrence_ref")
