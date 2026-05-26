from __future__ import annotations

from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import NoteV2
from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import TagMergeRequestV2, TagRenameV2, TagWithCountV2
from sikao_api.modules.notes_v2.domain.errors import TAG_LIMIT_EXCEEDED
from sikao_api.modules.notes_v2.infrastructure.repos import NotesRepoV2
from sikao_api.modules.system.application.errors import ConflictError, ForbiddenError, NotFoundError, ValidationError


class NoteTagServiceV2:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repo = NotesRepoV2(session)

    def list_tags(self, *, user: UserV2) -> list[TagWithCountV2]:
        return [
            TagWithCountV2(tag_name=tag_name, is_system=is_system, usage_count=usage_count)
            for tag_name, is_system, usage_count in self.repo.list_tag_counts(user_id=user.id)
        ]

    def add_tag(self, *, user: UserV2, note_id: int, tag_name: str) -> None:
        note = self._load_note(user=user, note_id=note_id)
        existing = self.repo.list_note_tags(note_id=note.id)
        if tag_name in existing:
            return
        if len(existing) >= 10:
            raise ValidationError("note tag limit exceeded", code=TAG_LIMIT_EXCEEDED)
        self.repo.add_note_tag(
            user_id=user.id,
            note_id=note.id,
            tag_name=tag_name,
        )

    def remove_tag(self, *, user: UserV2, note_id: int, tag_name: str) -> None:
        note = self._load_note(user=user, note_id=note_id)
        row = self.repo.get_note_tag(note_id=note.id, tag_name=tag_name)
        if row is None:
            raise NotFoundError("note tag not found", code="note_tag_not_found")
        if row.is_system:
            raise ForbiddenError("system tags cannot be modified", code="forbidden")
        existing = [value for value in self.repo.list_note_tags(note_id=note.id) if value != tag_name]
        self.repo.replace_tags(note_id=note.id, user_id=user.id, tags=existing)

    def rename_tag(self, *, user: UserV2, payload: TagRenameV2) -> None:
        if payload.old_name == payload.new_name:
            return
        rows = self.repo.list_user_tags(user_id=user.id, tag_names=[payload.old_name])
        if not rows:
            raise NotFoundError("tag not found", code="note_tag_not_found")
        if any(row.is_system for row in rows):
            raise ForbiddenError("system tags cannot be modified", code="forbidden")
        if self.repo.user_has_tag_name(user_id=user.id, tag_name=payload.new_name):
            raise ConflictError("target tag already exists", code="conflict")
        for row in rows:
            row.tag_name = payload.new_name
            self.session.add(row)
        self.session.flush()

    def merge_tags(self, *, user: UserV2, payload: TagMergeRequestV2) -> None:
        source_tags = [tag for tag in payload.source_tags if tag != payload.target_tag]
        if not source_tags:
            raise ValidationError("source tags cannot collapse to only target", code="validation_error")
        rows = self.repo.list_user_tags(user_id=user.id, tag_names=[*source_tags, payload.target_tag])
        source_rows = [row for row in rows if row.tag_name in source_tags]
        if not source_rows:
            raise NotFoundError("source tags not found", code="note_tag_not_found")
        if any(row.is_system for row in rows):
            raise ForbiddenError("system tags cannot be modified", code="forbidden")

        for row in source_rows:
            existing_target = self.repo.get_note_tag(note_id=row.note_id, tag_name=payload.target_tag)
            if existing_target is not None:
                self.session.delete(row)
                continue
            row.tag_name = payload.target_tag
            self.session.add(row)
        self.session.flush()

    def _load_note(self, *, user: UserV2, note_id: int) -> NoteV2:
        note = self.repo.get_owned_note(user_id=user.id, note_id=note_id)
        if note is None:
            raise NotFoundError("note not found", code="note_not_found")
        return note
