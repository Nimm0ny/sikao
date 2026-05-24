"""Review WU-R5/WU-R13: cause analysis runtime taxonomy foundation."""

from __future__ import annotations

from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

from sikao_api.modules.review.data.cause_tag_seed_v1 import CAUSE_TAG_SEED_V1


revision = "1028_review_cause_analysis_taxonomy"
down_revision = "1027_review_wu_r1_schema_foundation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("ai_cause_analysis_v2") as batch_op:
        batch_op.add_column(
            sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1"))
        )
        batch_op.add_column(
            sa.Column("updated_at", sa.DateTime(), nullable=True)
        )

    op.execute("UPDATE ai_cause_analysis_v2 SET updated_at = created_at WHERE updated_at IS NULL")
    with op.batch_alter_table("ai_cause_analysis_v2") as batch_op:
        batch_op.alter_column("updated_at", existing_type=sa.DateTime(), nullable=False)

    op.create_table(
        "cause_tag_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("severity_default", sa.String(length=16), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("taxonomy_version", sa.String(length=32), nullable=False, server_default="v1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("slug", name="uq_cause_tag_v2_slug"),
    )
    op.create_index(
        "ix_cause_tag_v2_category_order",
        "cause_tag_v2",
        ["category", "display_order"],
    )
    op.create_index(
        "ix_cause_tag_v2_active",
        "cause_tag_v2",
        ["is_active"],
    )

    cause_tag_table = sa.table(
        "cause_tag_v2",
        sa.column("slug", sa.String(length=64)),
        sa.column("name", sa.String(length=64)),
        sa.column("category", sa.String(length=32)),
        sa.column("severity_default", sa.String(length=16)),
        sa.column("description", sa.Text()),
        sa.column("display_order", sa.Integer()),
        sa.column("is_active", sa.Boolean()),
        sa.column("taxonomy_version", sa.String(length=32)),
        sa.column("created_at", sa.DateTime()),
        sa.column("updated_at", sa.DateTime()),
    )
    now = datetime.now(UTC).replace(tzinfo=None)
    op.bulk_insert(
        cause_tag_table,
        [
            {
                **row,
                "is_active": True,
                "taxonomy_version": "v1",
                "created_at": now,
                "updated_at": now,
            }
            for row in CAUSE_TAG_SEED_V1
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_cause_tag_v2_active", table_name="cause_tag_v2")
    op.drop_index("ix_cause_tag_v2_category_order", table_name="cause_tag_v2")
    op.drop_table("cause_tag_v2")

    with op.batch_alter_table("ai_cause_analysis_v2") as batch_op:
        batch_op.drop_column("updated_at")
        batch_op.drop_column("version")
