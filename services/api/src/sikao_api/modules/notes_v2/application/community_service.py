from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import NoteV2, UserV2
from sikao_api.db.schemas_v2 import (
    CommunityNoteItemV2,
    CommunityNoteListResponseV2,
    NoteVisibilityUpdateResponseV2,
)
from sikao_api.modules.notes_v2.domain.community_policy import assert_public_note_publishable
from sikao_api.modules.notes_v2.infrastructure.repos import NotesRepoV2
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.modules.system.application.errors import NotFoundError, ValidationError


_ALLOWED_VISIBILITY = {"private", "public"}
_ALLOWED_COMMUNITY_SORTS = {"latest", "hottest", "featured"}


class NoteCommunityServiceV2:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repo = NotesRepoV2(session)

    def update_visibility(
        self,
        *,
        user: UserV2,
        note_id: int,
        visibility: str,
    ) -> tuple[NoteV2, str]:
        note = self.repo.get_owned_note(user_id=user.id, note_id=note_id)
        if note is None:
            raise NotFoundError("note not found", code="note_not_found")
        self._validate_visibility(visibility)
        previous_visibility = note.visibility
        if visibility == "public":
            assert_public_note_publishable(body_text=note.body_text)
        note.visibility = visibility
        self.session.add(note)
        self.session.flush()
        return note, previous_visibility

    def list_community_notes(
        self,
        *,
        page: int,
        size: int,
        sort: str,
        linked_question_id: int | None,
        tags: list[str],
    ) -> CommunityNoteListResponseV2:
        self._validate_sort(sort)
        normalized_tags = self._normalize_tags(tags)
        rows, total = self.repo.list_public_notes(
            page=page,
            size=size,
            sort=sort,
            linked_question_id=linked_question_id,
            tags=normalized_tags,
        )
        tags_map = self.repo.list_note_tags_map(
            note_ids=[note.id for note, _display_name in rows]
        )
        return CommunityNoteListResponseV2(
            items=[
                CommunityNoteItemV2(
                    id=note.id,
                    title=note.title,
                    body_preview=note.body_text[:100],
                    word_count=note.word_count,
                    author_name=display_name,
                    tags=tags_map.get(note.id, []),
                    linked_question_id=note.linked_question_id,
                    reaction_count=note.reaction_count,
                    comment_count=note.comment_count,
                    is_featured=note.is_featured,
                    created_at=note.created_at,
                )
                for note, display_name in rows
            ],
            total=total,
            page=page,
            page_size=size,
        )

    def build_visibility_response(self, *, note: NoteV2) -> NoteVisibilityUpdateResponseV2:
        return NoteVisibilityUpdateResponseV2(
            id=note.id,
            visibility=note.visibility,
            updated_at=note.updated_at,
        )

    def record_visibility_audit(
        self,
        *,
        note: NoteV2,
        previous_visibility: str | None,
        request_id: str | None,
        ip: str | None,
    ) -> None:
        if previous_visibility == note.visibility:
            return
        before: dict[str, Any] = {"visibility": previous_visibility}
        after = {"visibility": note.visibility}
        diff = {
            "visibility": {
                "before": previous_visibility,
                "after": note.visibility,
            }
        }
        add_audit_log(
            self.session,
            user_id=note.user_id,
            actor_type="user",
            actor_id=str(note.user_id),
            action="notes.community.visibility_updated",
            target_type="note_v2",
            target_id=note.id,
            before=before,
            after=after,
            diff=diff,
            metadata={"noteId": note.id},
            request_id=request_id,
            ip=ip,
        )

    @staticmethod
    def _validate_visibility(value: str) -> None:
        if value not in _ALLOWED_VISIBILITY:
            raise ValidationError("unsupported note visibility", code="validation_error")

    @staticmethod
    def _validate_sort(value: str) -> None:
        if value not in _ALLOWED_COMMUNITY_SORTS:
            raise ValidationError("unsupported community sort", code="validation_error")

    @staticmethod
    def _normalize_tags(values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for raw in values:
            tag = raw.strip().lower()
            if not tag:
                raise ValidationError("tags cannot contain blank values", code="validation_error")
            if tag in seen:
                continue
            seen.add(tag)
            normalized.append(tag)
        return normalized
