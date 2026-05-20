from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import NoteCreateRequestV2, NoteDetailV2, NoteListResponseV2, NoteUpdateRequestV2
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import get_current_user_v2, verify_csrf_v2
from sikao_api.modules.notes_v2.application.service import NotesServiceV2

router = APIRouter(prefix="/api/v2/notes", tags=["notes-v2-skeleton"])


@router.get("", response_model=NoteListResponseV2)
def list_notes(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> NoteListResponseV2:
    return NotesServiceV2(session).list_notes(user=user)


@router.post("", response_model=NoteDetailV2, dependencies=[Depends(verify_csrf_v2)])
def create_note(
    payload: NoteCreateRequestV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> NoteDetailV2:
    note = NotesServiceV2(session).create_note(user=user, payload=payload)
    session.commit()
    session.refresh(note)
    return NotesServiceV2.serialize_note(note)


@router.get("/{note_id}", response_model=NoteDetailV2)
def get_note(
    note_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> NoteDetailV2:
    note = NotesServiceV2(session).get_note(user=user, note_id=note_id)
    return NotesServiceV2.serialize_note(note)


@router.put("/{note_id}", response_model=NoteDetailV2, dependencies=[Depends(verify_csrf_v2)])
def update_note(
    note_id: int,
    payload: NoteUpdateRequestV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> NoteDetailV2:
    service = NotesServiceV2(session)
    note = service.get_note(user=user, note_id=note_id)
    note = service.update_note(note=note, payload=payload)
    session.commit()
    session.refresh(note)
    return NotesServiceV2.serialize_note(note)
