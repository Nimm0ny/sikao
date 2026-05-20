"""Create content v2 tables for backend rewrite phase 1."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "1002_content_v2_tables"
down_revision = "1001_identity_v2_tables"
branch_labels = None
depends_on = None

_JSONB_COMPAT = sa.JSON().with_variant(JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "papers_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("paper_code", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("subject_kind", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("paper_code", name="uq_papers_v2_code"),
    )
    op.create_index("ix_papers_v2_subject", "papers_v2", ["subject_kind"])

    op.create_table(
        "paper_revisions_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("paper_id", sa.Integer(), sa.ForeignKey("papers_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("revision_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("paper_id", "revision_number", name="uq_paper_revisions_v2_number"),
    )

    op.create_table(
        "paper_sections_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("revision_id", sa.Integer(), sa.ForeignKey("paper_revisions_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("section_key", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.UniqueConstraint("revision_id", "section_key", name="uq_paper_sections_v2_key"),
    )

    op.create_table(
        "paper_blocks_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("revision_id", sa.Integer(), sa.ForeignKey("paper_revisions_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("section_id", sa.Integer(), sa.ForeignKey("paper_sections_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("block_kind", sa.String(length=64), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
    )

    op.create_table(
        "material_groups_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("revision_id", sa.Integer(), sa.ForeignKey("paper_revisions_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("block_id", sa.Integer(), sa.ForeignKey("paper_blocks_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content_json", _JSONB_COMPAT, nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
    )

    op.create_table(
        "material_group_assets_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("material_group_id", sa.Integer(), sa.ForeignKey("material_groups_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
    )

    op.create_table(
        "questions_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("revision_id", sa.Integer(), sa.ForeignKey("paper_revisions_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("section_id", sa.Integer(), sa.ForeignKey("paper_sections_v2.id", ondelete="SET NULL"), nullable=True),
        sa.Column("block_id", sa.Integer(), sa.ForeignKey("paper_blocks_v2.id", ondelete="SET NULL"), nullable=True),
        sa.Column("material_group_id", sa.Integer(), sa.ForeignKey("material_groups_v2.id", ondelete="SET NULL"), nullable=True),
        sa.Column("item_no", sa.Integer(), nullable=False),
        sa.Column("subject_kind", sa.String(length=32), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("answer_kind", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("content_json", _JSONB_COMPAT, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("revision_id", "item_no", name="uq_questions_v2_item_no"),
    )
    op.create_index("ix_questions_v2_subject", "questions_v2", ["subject_kind"])

    op.create_table(
        "question_options_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("question_id", sa.Integer(), sa.ForeignKey("questions_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("option_key", sa.String(length=16), nullable=False),
        sa.Column("option_text", sa.Text(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.UniqueConstraint("question_id", "option_key", name="uq_question_options_v2_key"),
    )

    op.create_table(
        "question_assets_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("question_id", sa.Integer(), sa.ForeignKey("questions_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("question_assets_v2")
    op.drop_table("question_options_v2")
    op.drop_index("ix_questions_v2_subject", table_name="questions_v2")
    op.drop_table("questions_v2")
    op.drop_table("material_group_assets_v2")
    op.drop_table("material_groups_v2")
    op.drop_table("paper_blocks_v2")
    op.drop_table("paper_sections_v2")
    op.drop_table("paper_revisions_v2")
    op.drop_index("ix_papers_v2_subject", table_name="papers_v2")
    op.drop_table("papers_v2")
