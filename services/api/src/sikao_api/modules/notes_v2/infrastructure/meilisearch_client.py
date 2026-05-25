from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


class NotesSearchUnavailable(RuntimeError):
    pass


@dataclass(slots=True)
class NoteSearchDocument:
    id: int
    user_id: int
    title: str
    body_text: str
    tags: list[str]
    type: str
    visibility: str
    linked_question_id: int | None
    has_linked_question: bool
    created_at: str
    updated_at: str

    def to_payload(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "body_text": self.body_text,
            "tags": list(self.tags),
            "type": self.type,
            "visibility": self.visibility,
            "linked_question_id": self.linked_question_id,
            "has_linked_question": self.has_linked_question,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


@dataclass(slots=True)
class NoteSearchHit:
    id: int
    title: str
    body_text: str
    tags: list[str]
    type: str
    visibility: str
    linked_question_id: int | None
    updated_at: str
    formatted_title: str | None = None
    formatted_body_text: str | None = None


@dataclass(slots=True)
class NoteSearchResult:
    hits: list[NoteSearchHit]
    total: int
    facet_distribution: dict[str, dict[str, int]]


class NotesSearchClientProtocol(Protocol):
    is_enabled: bool

    def init_index(self) -> None: ...

    def upsert_note(self, document: NoteSearchDocument) -> None: ...

    def delete_note(self, note_id: int) -> None: ...

    def search(
        self,
        *,
        query: str,
        filter_expression: str,
        page: int,
        size: int,
    ) -> NoteSearchResult: ...

    def close(self) -> None: ...
