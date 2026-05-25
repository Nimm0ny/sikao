"""Notes M1: extend NoteV2 and add Notes support tables.

Revision ID: 1031_notes_crud_contract
Revises: 1030_review_cause_feedback_contract
Create Date: 2026-05-25
"""

from __future__ import annotations

import re

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "1031_notes_crud_contract"
down_revision = "1030_review_cause_feedback_contract"
branch_labels = None
depends_on = None


JSONB_COMPAT = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def _compute_word_count(body_text: str) -> int:
    cjk_count = sum(1 for char in body_text if "\u4e00" <= char <= "\u9fff")
    non_cjk = re.sub(r"[\u4e00-\u9fff]", " ", body_text)
    non_cjk_words = [part for part in non_cjk.split() if part]
    return cjk_count + len(non_cjk_words)


def upgrade() -> None:
    with op.batch_alter_table("notes_v2") as batch_op:
        batch_op.add_column(
            sa.Column("type", sa.String(length=32), nullable=False, server_default="free")
        )
        batch_op.add_column(sa.Column("body_json", JSONB_COMPAT, nullable=True))
        batch_op.add_column(
            sa.Column("body_text", sa.Text(), nullable=False, server_default="")
        )
        batch_op.add_column(
            sa.Column("word_count", sa.Integer(), nullable=False, server_default="0")
        )
        batch_op.add_column(sa.Column("content_hash", sa.String(length=64), nullable=True))
        batch_op.add_column(
            sa.Column("reaction_count", sa.Integer(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("comment_count", sa.Integer(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("bookmark_count", sa.Integer(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("is_featured", sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch_op.add_column(sa.Column("deleted_at", sa.DateTime(), nullable=True))

    op.execute(
        sa.text(
            """
            UPDATE notes_v2
            SET body_text = COALESCE(body, ''),
                type = CASE
                    WHEN linked_question_id IS NOT NULL THEN 'question_level'
                    ELSE 'free'
                END,
                reaction_count = 0,
                comment_count = 0,
                bookmark_count = 0,
                is_featured = false
            """
        )
    )
    connection = op.get_bind()
    legacy_rows = connection.execute(
        sa.text("SELECT id, body_text FROM notes_v2")
    ).mappings()
    for row in legacy_rows:
        connection.execute(
            sa.text(
                """
                UPDATE notes_v2
                SET word_count = :word_count
                WHERE id = :note_id
                """
            ),
            {
                "note_id": row["id"],
                "word_count": _compute_word_count(str(row["body_text"] or "")),
            },
        )

    op.create_index("ix_notes_v2_user_type", "notes_v2", ["user_id", "type"])
    op.create_index("ix_notes_v2_user_visibility", "notes_v2", ["user_id", "visibility"])
    op.create_index("ix_notes_v2_linked_question", "notes_v2", ["linked_question_id"])
    op.create_index(
        "ix_notes_v2_community_feed",
        "notes_v2",
        ["visibility", "created_at"],
        unique=False,
        postgresql_where=sa.text("visibility = 'public' AND deleted_at IS NULL"),
        sqlite_where=sa.text("visibility = 'public' AND deleted_at IS NULL"),
    )

    op.create_table(
        "note_tags_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("note_id", sa.Integer(), sa.ForeignKey("notes_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tag_name", sa.String(length=64), nullable=False),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("note_id", "tag_name", name="uq_note_tag_per_note"),
    )
    op.create_index("ix_note_tags_v2_user_tag", "note_tags_v2", ["user_id", "tag_name"])
    op.create_index("ix_note_tags_v2_note", "note_tags_v2", ["note_id"])

    op.create_table(
        "note_images_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("note_id", sa.Integer(), sa.ForeignKey("notes_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_path", sa.String(length=512), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("mime_type", sa.String(length=64), nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_note_images_v2_note", "note_images_v2", ["note_id"])

    op.create_table(
        "note_reactions_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("note_id", sa.Integer(), sa.ForeignKey("notes_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(length=16), nullable=False, server_default="like"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "note_id", "type", name="uq_note_reaction"),
    )
    op.create_index("ix_note_reactions_v2_note", "note_reactions_v2", ["note_id"])

    op.create_table(
        "note_comments_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("note_id", sa.Integer(), sa.ForeignKey("notes_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "parent_comment_id",
            sa.Integer(),
            sa.ForeignKey("note_comments_v2.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("path", sa.String(length=128), nullable=False),
        sa.Column("depth", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint("depth BETWEEN 1 AND 3", name="ck_comment_depth"),
    )
    op.create_index("ix_note_comments_v2_note_created", "note_comments_v2", ["note_id", "created_at"])
    op.create_index("ix_note_comments_v2_path", "note_comments_v2", ["note_id", "path"])

    op.create_table(
        "note_bookmarks_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("note_id", sa.Integer(), sa.ForeignKey("notes_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "note_id", name="uq_note_bookmark"),
    )
    op.create_index("ix_note_bookmarks_v2_user", "note_bookmarks_v2", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_note_bookmarks_v2_user", table_name="note_bookmarks_v2")
    op.drop_table("note_bookmarks_v2")

    op.drop_index("ix_note_comments_v2_path", table_name="note_comments_v2")
    op.drop_index("ix_note_comments_v2_note_created", table_name="note_comments_v2")
    op.drop_table("note_comments_v2")

    op.drop_index("ix_note_reactions_v2_note", table_name="note_reactions_v2")
    op.drop_table("note_reactions_v2")

    op.drop_index("ix_note_images_v2_note", table_name="note_images_v2")
    op.drop_table("note_images_v2")

    op.drop_index("ix_note_tags_v2_note", table_name="note_tags_v2")
    op.drop_index("ix_note_tags_v2_user_tag", table_name="note_tags_v2")
    op.drop_table("note_tags_v2")

    op.drop_index("ix_notes_v2_community_feed", table_name="notes_v2")
    op.drop_index("ix_notes_v2_linked_question", table_name="notes_v2")
    op.drop_index("ix_notes_v2_user_visibility", table_name="notes_v2")
    op.drop_index("ix_notes_v2_user_type", table_name="notes_v2")

    with op.batch_alter_table("notes_v2") as batch_op:
        batch_op.drop_column("deleted_at")
        batch_op.drop_column("is_featured")
        batch_op.drop_column("bookmark_count")
        batch_op.drop_column("comment_count")
        batch_op.drop_column("reaction_count")
        batch_op.drop_column("content_hash")
        batch_op.drop_column("word_count")
        batch_op.drop_column("body_text")
        batch_op.drop_column("body_json")
        batch_op.drop_column("type")
