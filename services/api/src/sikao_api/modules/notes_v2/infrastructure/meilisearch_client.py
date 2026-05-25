from __future__ import annotations

from dataclasses import dataclass
import time
from typing import Any, Protocol

import httpx

from sikao_api.core.config import Settings


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


class DisabledNotesSearchClient:
    is_enabled = False

    def init_index(self) -> None:
        return

    def upsert_note(self, document: NoteSearchDocument) -> None:
        return

    def delete_note(self, note_id: int) -> None:
        return

    def search(
        self,
        *,
        query: str,
        filter_expression: str,
        page: int,
        size: int,
    ) -> NoteSearchResult:
        raise NotesSearchUnavailable("notes search is not configured")

    def close(self) -> None:
        return


class MeilisearchNotesClient:
    is_enabled = True

    def __init__(self, settings: Settings) -> None:
        if not settings.meili_url or not settings.meili_master_key:
            raise RuntimeError("meilisearch client requires MEILI_URL and MEILI_MASTER_KEY")
        self._index_name = settings.meili_index_name
        self._timeout_seconds = settings.meili_timeout_seconds
        self._client = httpx.Client(
            base_url=settings.meili_url.rstrip("/"),
            timeout=settings.meili_timeout_seconds,
            headers={"X-Meili-API-Key": settings.meili_master_key},
        )

    def init_index(self) -> None:
        if not self._index_exists():
            task_uid = self._create_index()
            self._wait_for_task(task_uid)
        task_uid = self._update_settings()
        self._wait_for_task(task_uid)

    def upsert_note(self, document: NoteSearchDocument) -> None:
        response = self._request(
            "POST",
            f"/indexes/{self._index_name}/documents",
            json=[document.to_payload()],
            params={"primaryKey": "id"},
        )
        task_uid = self._extract_task_uid(response)
        self._wait_for_task(task_uid)

    def delete_note(self, note_id: int) -> None:
        response = self._request(
            "DELETE",
            f"/indexes/{self._index_name}/documents/{note_id}",
        )
        task_uid = self._extract_task_uid(response)
        self._wait_for_task(task_uid)
