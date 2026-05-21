"""Tab 5 Profile Phase: account deletion soft-delete + audit table.

Adds:
- users_v2.deleted_at + deletion_reason (soft-delete columns)
- account_deletion_jobs_v2 table (cron job + audit record)
  FK user_id is SET NULL on hard-delete so the job survives as audit.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "1010_profile_tab5_account_deletion"
down_revision = "1009_home_practice_session_occurrence_ref"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users_v2") as batch_op:
        batch_op.add_column(sa.Column("deleted_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("deletion_reason", sa.String(length=255), nullable=True))
        batch_op.create_index("ix_users_v2_deleted_at", ["deleted_at"])

    op.create_table(
        "account_deletion_jobs_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("user_public_id", sa.String(length=36), nullable=True),
        sa.Column("requested_at", sa.DateTime(), nullable=False),
        sa.Column("hard_delete_at", sa.DateTime(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users_v2.id"],
            name="fk_account_deletion_jobs_v2_user_id_users_v2",
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("user_id", name="uq_account_deletion_jobs_v2_user_id"),
    )


def downgrade() -> None:
    op.drop_table("account_deletion_jobs_v2")
    with op.batch_alter_table("users_v2") as batch_op:
        batch_op.drop_index("ix_users_v2_deleted_at")
        batch_op.drop_column("deletion_reason")
        batch_op.drop_column("deleted_at")
