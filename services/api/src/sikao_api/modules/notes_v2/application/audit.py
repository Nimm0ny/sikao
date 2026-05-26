from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from sikao_api.core.schemas import encode_datetime
from sikao_api.db.models_v2 import NoteV2
from sikao_api.modules.notes_v2.infrastructure.repos import NotesRepoV2
from sikao_api.modules.system.application.audit_v2 import add_audit_log


def serialize_note_audit_state(session: Session, *, note: NoteV2) -> dict[str, Any]:
    repo = NotesRepoV2(session)
    return {
        "title": note.title,
        "type": note.type,
        "visibility": note.visibility,
        "linkedQuestionId": note.linked_question_id,
        "wordCount": note.word_count,
        "contentHash": note.content_hash,
        "tags": repo.list_note_tags(note_id=note.id),
        "deletedAt": encode_datetime(note.deleted_at) if note.deleted_at is not None else None,
    }


def log_note_created(
    session: Session,
    *,
    note: NoteV2,
    request_id: str | None,
    ip: str | None,
) -> None:
    add_audit_log(
        session,
        user_id=note.user_id,
        actor_type="user",
        actor_id=str(note.user_id),
        action="notes.created",
        target_type="note_v2",
        target_id=note.id,
        after=serialize_note_audit_state(session, note=note),
        metadata={"noteId": note.id},
        request_id=request_id,
        ip=ip,
    )


def log_note_updated(
    session: Session,
    *,
    note: NoteV2,
    before: dict[str, Any],
    request_id: str | None,
    ip: str | None,
) -> None:
    add_audit_log(
        session,
        user_id=note.user_id,
        actor_type="user",
        actor_id=str(note.user_id),
        action="notes.updated",
        target_type="note_v2",
        target_id=note.id,
        before=before,
        after=serialize_note_audit_state(session, note=note),
        metadata={"noteId": note.id},
        request_id=request_id,
        ip=ip,
    )


def log_note_soft_deleted(
    session: Session,
    *,
    note: NoteV2,
    before: dict[str, Any],
    request_id: str | None,
    ip: str | None,
) -> None:
    add_audit_log(
        session,
        user_id=note.user_id,
        actor_type="user",
        actor_id=str(note.user_id),
        action="notes.soft_deleted",
        target_type="note_v2",
        target_id=note.id,
        before=before,
        after=serialize_note_audit_state(session, note=note),
        metadata={"noteId": note.id},
        request_id=request_id,
        ip=ip,
    )


def log_note_image_uploaded(
    session: Session,
    *,
    user_id: int,
    image_id: int,
    note_id: int | None,
    file_path: str,
    request_id: str | None,
    ip: str | None,
) -> None:
    add_audit_log(
        session,
        user_id=user_id,
        actor_type="user",
        actor_id=str(user_id),
        action="notes.image.uploaded",
        target_type="note_image_v2",
        target_id=image_id,
        after={"noteId": note_id, "filePath": file_path},
        metadata={"noteId": note_id, "imageId": image_id},
        request_id=request_id,
        ip=ip,
    )


def log_note_ai_summary_confirmed(
    session: Session,
    *,
    user_id: int,
    note_id: int,
    review_item_ids: list[int],
    prompt_version: str,
    request_id: str | None,
    ip: str | None,
) -> None:
    add_audit_log(
        session,
        user_id=user_id,
        actor_type="user",
        actor_id=str(user_id),
        action="notes.ai_summary.confirmed",
        target_type="note_v2",
        target_id=note_id,
        after={"reviewItemIds": list(review_item_ids)},
        metadata={
            "noteId": note_id,
            "reviewItemIds": list(review_item_ids),
            "promptVersion": prompt_version,
        },
        request_id=request_id,
        ip=ip,
    )


def log_note_weekly_review_generated(
    session: Session,
    *,
    user_id: int,
    note_id: int,
    llm_call_id: int | None,
    request_id: str | None,
    ip: str | None,
) -> None:
    add_audit_log(
        session,
        user_id=user_id,
        actor_type="user",
        actor_id=str(user_id),
        action="notes.weekly_review.generated",
        target_type="note_v2",
        target_id=note_id,
        after={"llmCallId": llm_call_id},
        metadata={"noteId": note_id, "llmCallId": llm_call_id},
        request_id=request_id,
        ip=ip,
    )
