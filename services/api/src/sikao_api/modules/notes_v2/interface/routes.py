from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import NoteCreateRequestV2, NoteDetailV2, NoteListResponseV2, NoteUpdateRequestV2
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import get_current_user_v2, verify_csrf_v2
from sikao_api.modules.notes_v2.application.note_service import NotesServiceV2

router = APIRouter(prefix="/api/v2/notes", tags=["notes-v2"])


@router.get("", response_model=NoteListResponseV2)
def list_notes(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=50)] = 20,
    type: str | None = None,
    visibility: str | None = None,
    linked_question_id: int | None = Query(default=None, alias="linkedQuestionId"),
    has_linked_question: bool | None = Query(default=None, alias="hasLinkedQuestion"),
    tags: str | None = None,
    sort: str = "updated_at",
    order: str = "desc",
) -> NoteListResponseV2:
    resolved_tags = [part for part in (tags or "").split(",") if part]
    return NotesServiceV2(session).list_notes(
        user=user,
        page=page,
        size=size,
        note_type=type,
        visibility=visibility,
        linked_question_id=linked_question_id,
        has_linked_question=has_linked_question,
        tags=resolved_tags,
        sort=sort,
        order=order,
    )


@router.post("", response_model=NoteDetailV2, dependencies=[Depends(verify_csrf_v2)])
def create_note(
    payload: NoteCreateRequestV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> NoteDetailV2:
    note = NotesServiceV2(session).create_note(user=user, payload=payload)
    session.commit()
    session.refresh(note)
    return NotesServiceV2(session).serialize_note(note)


@router.get("/{note_id}", response_model=NoteDetailV2)
def get_note(
    note_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> NoteDetailV2:
    service = NotesServiceV2(session)
    note = service.get_note(user=user, note_id=note_id)
    return service.serialize_note(note)


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
    return service.serialize_note(note)


@router.delete(
    "/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_csrf_v2)],
)
def delete_note(
    note_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> Response:
    service = NotesServiceV2(session)
    note = service.get_note(user=user, note_id=note_id)
    service.soft_delete_note(note=note)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
