from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile, status
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.core.deps import get_app_settings
from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import (
    NoteCreateRequestV2,
    NoteDetailV2,
    NoteImageUploadResponseV2,
    NoteListResponseV2,
    NoteTagMutationRequestV2,
    NoteUpdateRequestV2,
    OperationAckV2,
    TagMergeRequestV2,
    TagRenameV2,
    TagWithCountV2,
)
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import get_current_user_v2, verify_csrf_v2
from sikao_api.modules.notes_v2.application.export_service import NoteExportServiceV2
from sikao_api.modules.notes_v2.application.image_service import NoteImageServiceV2
from sikao_api.modules.notes_v2.application.note_service import NotesServiceV2
from sikao_api.modules.notes_v2.application.tag_service import NoteTagServiceV2

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


@router.get("/tags", response_model=list[TagWithCountV2])
def list_tags(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> list[TagWithCountV2]:
    return NoteTagServiceV2(session).list_tags(user=user)


@router.patch("/tags/rename", response_model=OperationAckV2, dependencies=[Depends(verify_csrf_v2)])
def rename_tag(
    payload: TagRenameV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OperationAckV2:
    NoteTagServiceV2(session).rename_tag(user=user, payload=payload)
    session.commit()
    return OperationAckV2(ok=True, status="renamed")


@router.post("/tags/merge", response_model=OperationAckV2, dependencies=[Depends(verify_csrf_v2)])
def merge_tags(
    payload: TagMergeRequestV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OperationAckV2:
    NoteTagServiceV2(session).merge_tags(user=user, payload=payload)
    session.commit()
    return OperationAckV2(ok=True, status="merged")


@router.post("/{note_id}/tags", response_model=OperationAckV2, dependencies=[Depends(verify_csrf_v2)])
def add_tag(
    note_id: int,
    payload: NoteTagMutationRequestV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OperationAckV2:
    NoteTagServiceV2(session).add_tag(user=user, note_id=note_id, tag_name=payload.tag_name)
    session.commit()
    return OperationAckV2(ok=True, status="added")


@router.delete(
    "/{note_id}/tags/{tag_name}",
    response_model=OperationAckV2,
    dependencies=[Depends(verify_csrf_v2)],
)
def remove_tag(
    note_id: int,
    tag_name: str,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OperationAckV2:
    NoteTagServiceV2(session).remove_tag(user=user, note_id=note_id, tag_name=tag_name.strip().lower())
    session.commit()
    return OperationAckV2(ok=True, status="removed")


@router.post("/images", response_model=NoteImageUploadResponseV2, dependencies=[Depends(verify_csrf_v2)])
async def upload_image(
    image: Annotated[UploadFile, File()],
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    note_id: Annotated[int | None, Form()] = None,
) -> NoteImageUploadResponseV2:
    payload = await image.read()
    response = NoteImageServiceV2(session, settings).upload_image(
        user=user,
        raw_bytes=payload,
        original_filename=image.filename or "upload",
        note_id=note_id,
    )
    session.commit()
    return response


@router.get("/{note_id}", response_model=NoteDetailV2)
def get_note(
    note_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> NoteDetailV2:
    service = NotesServiceV2(session)
    note = service.get_note(user=user, note_id=note_id)
    return service.serialize_note(note)


@router.get("/{note_id}/export")
def export_note(
    note_id: int,
    format: str,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> Response:
    content, media_type, content_disposition = NoteExportServiceV2(session).export_note(
        user=user,
        note_id=note_id,
        export_format=format,
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": content_disposition},
    )


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
