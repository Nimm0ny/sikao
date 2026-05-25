from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import NoteV2, UserV2
from sikao_api.modules.system.application.errors import NotFoundError, ValidationError


@dataclass(frozen=True, slots=True)
class AiSummaryInputV2:
    note_id: int
    title: str
    body_text: str
    linked_question_id: int | None
    content_hash: str


class AiSummaryServiceV2:
    def __init__(self, session: Session) -> None:
        self.session = session

    def build_summary_input(self, *, user: UserV2, note_id: int) -> AiSummaryInputV2:
        note = self._load_owned_note(user=user, note_id=note_id)
        if not note.body_text.strip():
            raise ValidationError("note body_text cannot be blank", code="validation_error")
        if not note.content_hash:
            raise ValidationError("note content_hash is required", code="validation_error")
        return AiSummaryInputV2(
            note_id=note.id,
            title=note.title,
            body_text=note.body_text[:2000],
            linked_question_id=note.linked_question_id,
            content_hash=note.content_hash,
        )

    def _load_owned_note(self, *, user: UserV2, note_id: int) -> NoteV2:
        note = self.session.scalar(
            select(NoteV2).where(
                NoteV2.id == note_id,
                NoteV2.user_id == user.id,
                NoteV2.deleted_at.is_(None),
            )
        )
        if note is None:
            raise NotFoundError("note not found", code="note_not_found")
        return note
