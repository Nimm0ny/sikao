from __future__ import annotations

from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import NoteV2, UserV2
from sikao_api.db.schemas_v2 import (
    NoteCreateRequestV2,
    NoteDetailV2,
    NoteItemV2,
    NoteListResponseV2,
    NoteUpdateRequestV2,
    QuestionBriefV2,
)
from sikao_api.modules.mock_exam.application.enforcer import assert_can_create_question_note
from sikao_api.modules.notes_v2.domain.body_extractor import extract_text, extract_word_count
from sikao_api.modules.notes_v2.domain.community_policy import assert_public_note_publishable
from sikao_api.modules.notes_v2.domain.content_hash import compute_content_hash
from sikao_api.modules.notes_v2.infrastructure.repos import NotesRepoV2
from sikao_api.modules.system.application.errors import NotFoundError, ValidationError


_ALLOWED_NOTE_TYPES = {
    "free",
    "question_level",
    "ai_cause_analysis",
    "weekly_review",
    "community_bookmark",
}
_ALLOWED_VISIBILITY = {"private", "public"}
_ALLOWED_SORTS = {"updated_at", "created_at", "title"}
_ALLOWED_ORDER = {"asc", "desc"}


class NotesServiceV2:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repo = NotesRepoV2(session)

    def list_notes(
        self,
        *,
        user: UserV2,
        page: int = 1,
        size: int = 20,
        note_type: str | None = None,
        visibility: str | None = None,
        linked_question_id: int | None = None,
        has_linked_question: bool | None = None,
        tags: list[str] | None = None,
        sort: str = "updated_at",
        order: str = "desc",
    ) -> NoteListResponseV2:
        normalized_tags = self._normalize_tags(tags or [])
        self._validate_list_inputs(
            note_type=note_type,
            visibility=visibility,
            sort=sort,
            order=order,
        )
        rows, total = self.repo.list_notes(
            user_id=user.id,
            page=page,
            size=size,
            note_type=note_type,
            visibility=visibility,
            linked_question_id=linked_question_id,
            has_linked_question=has_linked_question,
            tags=normalized_tags,
            sort=sort,
            order=order,
        )
        return NoteListResponseV2(
            items=[
                NoteItemV2(
                    id=row.id,
                    title=row.title,
                    type=row.type,
                    body_preview=row.body_text[:100],
                    word_count=row.word_count,
                    linked_question_id=row.linked_question_id,
                    tags=self.repo.list_note_tags(note_id=row.id),
                    reaction_count=row.reaction_count,
                    comment_count=row.comment_count,
                    updated_at=row.updated_at,
                )
                for row in rows
            ],
            total=total,
            page=page,
            page_size=size,
        )

    def create_note(self, *, user: UserV2, payload: NoteCreateRequestV2) -> NoteV2:
        resolved_question_id = self._validate_linked_question_id(payload.linked_question_id)
        assert_can_create_question_note(
            self.session,
            user_id=user.id,
            linked_question_id=resolved_question_id,
        )
        body_text = extract_text(payload.body_json)
        word_count = extract_word_count(body_text)
        note_type = self._resolve_note_type(
            explicit_type=payload.type,
            linked_question_id=resolved_question_id,
        )
        visibility = self._validate_visibility(payload.visibility)
        if visibility == "public":
            assert_public_note_publishable(body_text=body_text)
        normalized_tags = self._normalize_tags(payload.tags)

        note = NoteV2(
            user_id=user.id,
            title=payload.title,
            body=body_text,
            status="active",
            linked_question_id=resolved_question_id,
            visibility=visibility,
            type=note_type,
            body_json=payload.body_json,
            body_text=body_text,
            word_count=word_count,
            content_hash=compute_content_hash(payload.body_json),
            reaction_count=0,
            comment_count=0,
            bookmark_count=0,
            is_featured=False,
        )
        self.session.add(note)
        self.session.flush()
        self.repo.replace_tags(note_id=note.id, user_id=user.id, tags=normalized_tags)
        return note

    def get_note(self, *, user: UserV2, note_id: int) -> NoteV2:
        note = self.repo.get_owned_note(user_id=user.id, note_id=note_id)
        if note is None:
            raise NotFoundError("note not found", code="note_not_found")
        return note

    def update_note(self, *, note: NoteV2, payload: NoteUpdateRequestV2) -> NoteV2:
        resolved_question_id = note.linked_question_id
        if "linked_question_id" in payload.model_fields_set:
            resolved_question_id = self._validate_linked_question_id(payload.linked_question_id)

        assert_can_create_question_note(
            self.session,
            user_id=note.user_id,
            linked_question_id=resolved_question_id,
        )

        if payload.title is not None:
            note.title = payload.title
        if payload.body_json is not None:
            note.body_json = payload.body_json
            note.body_text = extract_text(payload.body_json)
            note.word_count = extract_word_count(note.body_text)
            note.content_hash = compute_content_hash(payload.body_json)
            note.body = note.body_text
        if "linked_question_id" in payload.model_fields_set:
            note.linked_question_id = resolved_question_id
            note.type = self._resolve_updated_note_type(
                current_type=note.type,
                linked_question_id=resolved_question_id,
            )
        if payload.visibility is not None:
            note.visibility = self._validate_visibility(payload.visibility)
        if note.visibility == "public":
            assert_public_note_publishable(body_text=note.body_text)
        if payload.tags is not None:
            normalized_tags = self._normalize_tags(payload.tags)
            self.repo.replace_tags(note_id=note.id, user_id=note.user_id, tags=normalized_tags)
        self.session.add(note)
        self.session.flush()
        return note

    def soft_delete_note(self, *, note: NoteV2) -> None:
        note.deleted_at = self._utc_now()
        self.session.add(note)
        self.session.flush()

    def serialize_note(self, note: NoteV2) -> NoteDetailV2:
        question = None
        owner = self.repo.get_user(user_id=note.user_id)
        if note.linked_question_id is not None:
            question = self.repo.get_question(question_id=note.linked_question_id)
        return NoteDetailV2(
            id=note.id,
            title=note.title,
            type=note.type,
            visibility=note.visibility,
            body_json=note.body_json,
            body_text=note.body_text,
            word_count=note.word_count,
            linked_question_id=note.linked_question_id,
            linked_question_brief=QuestionBriefV2(
                id=question.id,
                prompt=question.prompt,
                category_l1=question.category_l1,
                category_l2=question.category_l2,
            ) if question is not None else None,
            tags=self.repo.list_note_tags(note_id=note.id),
            reaction_count=note.reaction_count,
            comment_count=note.comment_count,
            bookmark_count=note.bookmark_count,
            is_featured=note.is_featured,
            is_bookmarked=False,
            is_reacted=False,
            author_name=owner.display_name if owner is not None else None,
            created_at=note.created_at,
            updated_at=note.updated_at,
        )

    def _resolve_note_type(
        self,
        *,
        explicit_type: str | None,
        linked_question_id: int | None,
    ) -> str:
        if explicit_type is not None:
            if explicit_type not in _ALLOWED_NOTE_TYPES:
                raise ValidationError(
                    "unsupported note type",
                    code="validation_error",
                )
            return explicit_type
        if linked_question_id is not None:
            return "question_level"
        return "free"

    @staticmethod
    def _resolve_updated_note_type(
        *,
        current_type: str,
        linked_question_id: int | None,
    ) -> str:
        if current_type in {"ai_cause_analysis", "weekly_review", "community_bookmark"}:
            return current_type
        if linked_question_id is not None:
            return "question_level"
        return "free"

    def _validate_linked_question_id(self, question_id: int | None) -> int | None:
        if question_id is None:
            return None
        if self.repo.get_question(question_id=question_id) is None:
            raise ValidationError(
                "linked_question_id must reference an existing question",
                code="validation_error",
            )
        return question_id

    @staticmethod
    def _validate_visibility(value: str) -> str:
        if value not in _ALLOWED_VISIBILITY:
            raise ValidationError("unsupported note visibility", code="validation_error")
        return value

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
        if len(normalized) > 10:
            raise ValidationError("tags exceed note limit", code="tag_limit_exceeded")
        return normalized

    @staticmethod
    def _validate_list_inputs(
        *,
        note_type: str | None,
        visibility: str | None,
        sort: str,
        order: str,
    ) -> None:
        if note_type is not None and note_type not in _ALLOWED_NOTE_TYPES:
            raise ValidationError("unsupported note type filter", code="validation_error")
        if visibility is not None and visibility not in _ALLOWED_VISIBILITY:
            raise ValidationError("unsupported visibility filter", code="validation_error")
        if sort not in _ALLOWED_SORTS:
            raise ValidationError("unsupported sort field", code="validation_error")
        if order not in _ALLOWED_ORDER:
            raise ValidationError("unsupported sort order", code="validation_error")

    @staticmethod
    def _utc_now():
        from datetime import UTC, datetime

        return datetime.now(UTC).replace(tzinfo=None)
