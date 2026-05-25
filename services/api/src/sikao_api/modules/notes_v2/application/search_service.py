from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
import json
from typing import Callable

from sqlalchemy.orm import Session, sessionmaker

from sikao_api.core.schemas import encode_datetime
from sikao_api.db.models_v2 import NoteV2, UserV2
from sikao_api.db.schemas_v2 import NoteSearchItemV2, NoteSearchResponseV2
from sikao_api.modules.notes_v2.domain.errors import SEARCH_UNAVAILABLE
from sikao_api.modules.notes_v2.infrastructure.meilisearch_client import (
    NoteSearchDocument,
    NoteSearchHit,
    NotesSearchClientProtocol,
    NotesSearchUnavailable,
)
from sikao_api.modules.notes_v2.infrastructure.repos import NotesRepoV2
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.modules.system.application.errors import ServiceError, ValidationError


_ALLOWED_NOTE_TYPES = {
    "free",
    "question_level",
    "ai_cause_analysis",
    "weekly_review",
    "community_bookmark",
}
_ALLOWED_VISIBILITY = {"private", "public"}


@dataclass(slots=True)
class _SearchFilter:
    key: str
    values: list[str]


class NotesSearchServiceV2:
    def __init__(self, session: Session, search_client: NotesSearchClientProtocol) -> None:
        self.session = session
        self.repo = NotesRepoV2(session)
        self.search_client = search_client

    def index_note(self, *, note: NoteV2) -> None:
        self.search_client.upsert_note(self._build_document(note))

    def delete_note(self, *, note_id: int) -> None:
        self.search_client.delete_note(note_id)

    def search_notes(
        self,
        *,
        user: UserV2,
        query: str,
        filters: str | None,
        page: int,
        size: int,
    ) -> NoteSearchResponseV2:
        normalized_query = query.strip()
        if not normalized_query:
            raise ValidationError("q cannot be blank", code="validation_error")
        filter_expression = self._render_filter_expression(
            user_id=user.id,
            filters=self._parse_filters(filters),
        )
        try:
            result = self.search_client.search(
                query=normalized_query,
                filter_expression=filter_expression,
                page=page,
                size=size,
            )
            items = [self._serialize_hit(hit) for hit in result.hits]
        except NotesSearchUnavailable as exc:
            raise ServiceError(
                "notes search unavailable",
                status_code=503,
                code=SEARCH_UNAVAILABLE,
            ) from exc
        return NoteSearchResponseV2(
            items=items,
            total=result.total,
            page=page,
            page_size=size,
            facet_distribution=result.facet_distribution,
        )

    @staticmethod
    def persist_sync_failure_audit(
        *,
        session_factory: sessionmaker[Session] | Callable[[], Session],
        user_id: int,
        note_id: int,
        sync_action: str,
        error_message: str,
        request_id: str | None,
    ) -> None:
        with session_factory() as isolated_session:
            add_audit_log(
                isolated_session,
                user_id=user_id,
                actor_type="system",
                actor_id="notes.search",
                action=f"notes.search.{sync_action}_failed",
                target_type="note_v2",
                target_id=note_id,
                metadata={"error": error_message},
                request_id=request_id,
            )
            isolated_session.commit()

    def _build_document(self, note: NoteV2) -> NoteSearchDocument:
        return NoteSearchDocument(
            id=note.id,
            user_id=note.user_id,
            title=note.title,
            body_text=note.body_text,
            tags=self.repo.list_note_tags(note_id=note.id),
            type=note.type,
            visibility=note.visibility,
            linked_question_id=note.linked_question_id,
            has_linked_question=note.linked_question_id is not None,
            created_at=encode_datetime(self._normalize_utc(note.created_at)),
            updated_at=encode_datetime(self._normalize_utc(note.updated_at)),
        )

    @staticmethod
    def _normalize_utc(value: datetime) -> datetime:
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)

    @staticmethod
    def _serialize_hit(hit: NoteSearchHit) -> NoteSearchItemV2:
        highlights: list[str] = []
        if hit.formatted_title and hit.formatted_title != hit.title:
            highlights.append(hit.formatted_title)
        if hit.formatted_body_text and hit.formatted_body_text != hit.body_text:
            highlights.append(hit.formatted_body_text)
        return NoteSearchItemV2(
            id=hit.id,
            title=hit.title,
            type=hit.type,
            visibility=hit.visibility,
            body_preview=hit.body_text[:100],
            linked_question_id=hit.linked_question_id,
            tags=hit.tags,
            highlights=highlights,
            updated_at=NotesSearchServiceV2._parse_search_datetime(hit.updated_at),
        )

    @staticmethod
    def _parse_search_datetime(value: str) -> datetime:
        normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
        try:
            return datetime.fromisoformat(normalized)
        except ValueError as exc:
            raise NotesSearchUnavailable("notes search backend returned an invalid updated_at") from exc

    def _parse_filters(self, raw_filters: str | None) -> list[_SearchFilter]:
        if raw_filters is None or not raw_filters.strip():
            return []

        parsed: list[_SearchFilter] = []
        for chunk in self._split_filter_segments(raw_filters, delimiter=","):
            segment = chunk.strip()
            if not segment:
                continue
            key, separator, raw_value = segment.partition(":")
            if not separator:
                raise ValidationError("invalid filters syntax", code="validation_error")
            normalized_key = key.strip().lower()
            if normalized_key == "haslinkedquestion":
                normalized_key = "has_linked_question"
            value = raw_value.strip()
            if not value:
                raise ValidationError("filter value cannot be blank", code="validation_error")
            parsed.append(_SearchFilter(key=normalized_key, values=self._normalize_filter_values(normalized_key, value)))
        return parsed

    def _normalize_filter_values(self, key: str, raw_value: str) -> list[str]:
        decoded_value = self._decode_filter_token(raw_value)
        if key == "type":
            if decoded_value not in _ALLOWED_NOTE_TYPES:
                raise ValidationError("unsupported search type filter", code="validation_error")
            return [decoded_value]
        if key == "visibility":
            if decoded_value not in _ALLOWED_VISIBILITY:
                raise ValidationError("unsupported search visibility filter", code="validation_error")
            return [decoded_value]
        if key == "has_linked_question":
            normalized = decoded_value.lower()
            if normalized not in {"true", "false"}:
                raise ValidationError("has_linked_question must be true or false", code="validation_error")
            return [normalized]
        if key == "tags":
            normalized_tag = decoded_value.strip().lower()
            if not normalized_tag:
                raise ValidationError("tags filter cannot be blank", code="validation_error")
            return [normalized_tag]
        raise ValidationError("unsupported search filter", code="validation_error")

    @staticmethod
    def _render_filter_expression(*, user_id: int, filters: list[_SearchFilter]) -> str:
        expressions = [f"user_id = {user_id}"]
        for item in filters:
            if item.key == "type":
                expressions.append(f"type = {json.dumps(item.values[0], ensure_ascii=False)}")
                continue
            if item.key == "visibility":
                expressions.append(f"visibility = {json.dumps(item.values[0], ensure_ascii=False)}")
                continue
            if item.key == "has_linked_question":
                expressions.append(f"has_linked_question = {item.values[0]}")
                continue
            if item.key == "tags":
                tag_terms = [f"tags = {json.dumps(value, ensure_ascii=False)}" for value in item.values]
                expressions.append(f"({' OR '.join(tag_terms)})")
                continue
        return " AND ".join(expressions)
