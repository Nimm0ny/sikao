"""Phase-Practice WU-B11.3: notes_v2 question link + visibility.

Tab 4 (Phase-Notes) schema brought forward to unblock Tab 2 question-level
notes. WU-B11.3 only adds the columns + index Tab 2 needs to write
question-attached notes; the rest of the Tab 4 expansion (body_json,
content_hash, NoteTagV2, AI summary, community features, …) lands in
Phase-Notes proper.

Adds:
  - linked_question_id  INT NULL FK questions_v2.id ondelete SET NULL
                        Question this note is attached to (D-Q5).
  - visibility          VARCHAR(32) NOT NULL DEFAULT 'private'
                        D-Q17 future-proofing; Tab 2 only writes 'private'
                        but the Phase-Notes community feature later adds
                        'public' / 'shared_group'.
  - ix_notes_v2_user_question (user_id, linked_question_id)
                        Hot lookup shape: "my notes on this question" in
                        the answering view sidebar.

ondelete=SET NULL on linked_question_id rather than CASCADE: the body still
has value as a memory aid even if the original question row is deleted, and
the user can re-link or delete manually.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "1017_note_v2_question_link_visibility"
down_revision = "1016_practice_answer_flag_view_solution"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("notes_v2") as batch_op:
        batch_op.add_column(
            sa.Column(
                "linked_question_id",
                sa.Integer(),
                sa.ForeignKey(
                    "questions_v2.id",
                    name="fk_notes_v2_linked_question_id",
                    ondelete="SET NULL",
                ),
                nullable=True,
            )
        )
        batch_op.add_column(
            sa.Column(
                "visibility",
                sa.String(length=32),
                nullable=False,
                server_default="private",
            )
        )

    op.create_index(
        "ix_notes_v2_user_question",
        "notes_v2",
        ["user_id", "linked_question_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_notes_v2_user_question", table_name="notes_v2")
    with op.batch_alter_table("notes_v2") as batch_op:
        batch_op.drop_column("visibility")
        batch_op.drop_column("linked_question_id")
