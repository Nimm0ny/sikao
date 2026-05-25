from __future__ import annotations

from dataclasses import dataclass, field
import json
import re

from sikao_api.modules.notes_v2.infrastructure.meilisearch_client import (
    NoteSearchDocument,
    NoteSearchHit,
    NoteSearchResult,
    NotesSearchUnavailable,
)


@dataclass(slots=True)
class InMemoryNotesSearchClient:
    is_enabled: bool = True
    fail_init: bool = False
    fail_sync: bool = False
    fail_search: bool = False
    init_calls: int = 0
    documents: dict[int, NoteSearchDocument] = field(default_factory=dict)
    search_filters: list[str] = field(default_factory=list)

    def init_index(self) -> None:
        self.init_calls += 1
        if self.fail_init:
            raise NotesSearchUnavailable("meilisearch init failed")

    def upsert_note(self, document: NoteSearchDocument) -> None:
        if self.fail_sync:
            raise NotesSearchUnavailable("meilisearch sync failed")
        self.documents[document.id] = NoteSearchDocument(
            id=document.id,
            user_id=document.user_id,
            title=document.title,
            body_text=document.body_text,
            tags=list(document.tags),
            type=document.type,
            visibility=document.visibility,
            linked_question_id=document.linked_question_id,
            has_linked_question=document.has_linked_question,
            created_at=document.created_at,
            updated_at=document.updated_at,
        )

    def delete_note(self, note_id: int) -> None:
        if self.fail_sync:
            raise NotesSearchUnavailable("meilisearch sync failed")
        self.documents.pop(note_id, None)

    def search(
        self,
        *,
        query: str,
        filter_expression: str,
        page: int,
        size: int,
    ) -> NoteSearchResult:
        if self.fail_search:
            raise NotesSearchUnavailable("meilisearch search failed")
        self.search_filters.append(filter_expression)
        matched = [
            document
            for document in self.documents.values()
            if self._matches_query(document, query) and self._matches_filters(document, filter_expression)
        ]
        matched.sort(key=lambda item: (item.updated_at, item.id), reverse=True)
        total = len(matched)
        page_items = matched[(page - 1) * size : (page - 1) * size + size]
        facet_distribution = {
            "type": self._count_type_facets(matched),
            "tags": self._count_tag_facets(matched),
        }
        return NoteSearchResult(
            hits=[self._to_hit(document, query) for document in page_items],
            total=total,
            facet_distribution=facet_distribution,
        )

    def close(self) -> None:
        return

    @staticmethod
    def _matches_query(document: NoteSearchDocument, query: str) -> bool:
        lowered = query.lower()
        haystacks = [document.title.lower(), document.body_text.lower(), " ".join(document.tags).lower()]
        return any(lowered in haystack for haystack in haystacks)
