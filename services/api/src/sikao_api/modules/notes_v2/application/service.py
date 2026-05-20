from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import NoteV2, UserV2
from sikao_api.db.schemas_v2 import NoteCreateRequestV2, NoteDetailV2, NoteItemV2, NoteListResponseV2, NoteUpdateRequestV2
from sikao_api.modules.system.application.errors import NotFoundError


class NotesServiceV2:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_notes(self, *, user: UserV2) -> NoteListResponseV2:
        items = list(
            self.session.scalars(
                select(NoteV2).where(NoteV2.user_id == user.id).order_by(NoteV2.updated_at.desc())
            )
        )
        return NoteListResponseV2(
            items=[
                NoteItemV2(
                    id=item.id,
                    title=item.title,
                    excerpt=item.body[:120],
                    status=item.status,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                )
                for item in items
            ],
            total=len(items),
            page=1,
            page_size=20,
        )

    def create_note(self, *, user: UserV2, payload: NoteCreateRequestV2) -> NoteV2:
        note = NoteV2(user_id=user.id, title=payload.title, body=payload.body)
        self.session.add(note)
        self.session.flush()
        return note

    def get_note(self, *, user: UserV2, note_id: int) -> NoteV2:
        note = self.session.scalar(
            select(NoteV2).where(NoteV2.id == note_id, NoteV2.user_id == user.id)
        )
        if note is None:
            raise NotFoundError("note not found", code="note_not_found")
        return note

    def update_note(self, *, note: NoteV2, payload: NoteUpdateRequestV2) -> NoteV2:
        note.title = payload.title
        note.body = payload.body
        note.status = payload.status
        self.session.add(note)
        return note

    @staticmethod
    def serialize_note(note: NoteV2) -> NoteDetailV2:
        return NoteDetailV2(
            id=note.id,
            title=note.title,
            body=note.body,
            status=note.status,
            created_at=note.created_at,
            updated_at=note.updated_at,
        )
