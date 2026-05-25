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

    def search(
        self,
        *,
        query: str,
        filter_expression: str,
        page: int,
        size: int,
    ) -> NoteSearchResult:
        response = self._request(
            "POST",
            f"/indexes/{self._index_name}/search",
            json={
                "q": query,
                "filter": filter_expression,
                "facets": ["type", "tags"],
                "attributesToHighlight": ["title", "body_text"],
                "limit": size,
                "offset": (page - 1) * size,
            },
        )
        payload = self._decode_json(response)
        hits = [self._decode_hit(raw_hit) for raw_hit in payload.get("hits", [])]
        total_value = payload.get("estimatedTotalHits")
        if total_value is None:
            total_value = payload.get("totalHits", 0)
        total = self._coerce_int(total_value, field_name="estimatedTotalHits")
        raw_facets = payload.get("facetDistribution") or {}
        if not isinstance(raw_facets, dict):
            raise NotesSearchUnavailable("notes search backend returned an invalid facetDistribution")
        facet_distribution: dict[str, dict[str, int]] = {}
        for name, values in raw_facets.items():
            if not isinstance(values, dict):
                raise NotesSearchUnavailable(
                    f"notes search backend returned an invalid facetDistribution.{name}"
                )
            facet_distribution[str(name)] = {
                str(value): self._coerce_int(count, field_name=f"facetDistribution.{name}.{value}")
                for value, count in values.items()
            }
        return NoteSearchResult(
            hits=hits,
            total=total,
            facet_distribution=facet_distribution,
        )

    def close(self) -> None:
        self._client.close()

    def _index_exists(self) -> bool:
        response = self._request(
            "GET",
            f"/indexes/{self._index_name}",
            allowed_statuses=(200, 404),
        )
        return response.status_code == 200

    def _create_index(self) -> int:
        response = self._request(
            "POST",
            "/indexes",
            json={"uid": self._index_name, "primaryKey": "id"},
        )
        return self._extract_task_uid(response)

    def _update_settings(self) -> int:
        response = self._request(
            "PATCH",
            f"/indexes/{self._index_name}/settings",
            json={
                "searchableAttributes": ["title", "body_text", "tags"],
                "filterableAttributes": [
                    "user_id",
                    "type",
                    "has_linked_question",
                    "visibility",
                    "tags",
                    "created_at",
                ],
                "sortableAttributes": ["created_at", "updated_at"],
                "faceting": {"maxValuesPerFacet": 100},
                "typoTolerance": {
                    "enabled": True,
                    "minWordSizeForTypos": {"oneTypo": 3, "twoTypos": 6},
                },
            },
        )
        return self._extract_task_uid(response)

    def _wait_for_task(self, task_uid: int) -> None:
        deadline = time.monotonic() + self._timeout_seconds
        while True:
            response = self._request("GET", f"/tasks/{task_uid}")
            payload = self._decode_json(response)
            status = str(payload.get("status") or "")
            if status == "succeeded":
                return
            if status in {"failed", "canceled"}:
                raise NotesSearchUnavailable(
                    f"meilisearch task {task_uid} did not succeed: status={status}"
                )
            if time.monotonic() >= deadline:
                raise NotesSearchUnavailable(f"meilisearch task {task_uid} timed out")
            time.sleep(0.05)

    def _request(
        self,
        method: str,
        path: str,
        *,
        json: Any | None = None,
        params: dict[str, Any] | None = None,
        allowed_statuses: tuple[int, ...] = (200, 202),
    ) -> httpx.Response:
        try:
            response = self._client.request(method, path, json=json, params=params)
        except httpx.HTTPError as exc:
            raise NotesSearchUnavailable("notes search backend unavailable") from exc
        if response.status_code not in allowed_statuses:
            raise NotesSearchUnavailable(
                f"notes search backend returned unexpected status {response.status_code}"
            )
        return response

    @staticmethod
    def _decode_json(response: httpx.Response) -> dict[str, Any]:
        try:
            payload = response.json()
        except ValueError as exc:
            raise NotesSearchUnavailable("notes search backend returned invalid JSON") from exc
        if not isinstance(payload, dict):
            raise NotesSearchUnavailable("notes search backend returned a non-object payload")
        return payload

    @classmethod
    def _extract_task_uid(cls, response: httpx.Response) -> int:
        payload = cls._decode_json(response)
        task_uid = payload.get("taskUid")
        if not isinstance(task_uid, int):
            raise NotesSearchUnavailable("notes search backend omitted taskUid")
        return task_uid

    @staticmethod
    def _decode_hit(raw_hit: Any) -> NoteSearchHit:
        if not isinstance(raw_hit, dict):
            raise NotesSearchUnavailable("notes search backend returned an invalid hit")
        try:
            formatted = raw_hit.get("_formatted")
            formatted_dict = formatted if isinstance(formatted, dict) else {}
            raw_tags = raw_hit.get("tags", [])
            tags = MeilisearchNotesClient._require_str_list(raw_tags, field_name="tags")
            linked_question_id = MeilisearchNotesClient._optional_int(
                raw_hit.get("linked_question_id"),
                field_name="linked_question_id",
            )
            return NoteSearchHit(
                id=MeilisearchNotesClient._require_int(raw_hit["id"], field_name="id"),
                title=MeilisearchNotesClient._require_str(raw_hit["title"], field_name="title"),
                body_text=MeilisearchNotesClient._require_str(raw_hit["body_text"], field_name="body_text"),
                tags=tags,
                type=MeilisearchNotesClient._require_str(raw_hit["type"], field_name="type"),
                visibility=MeilisearchNotesClient._require_str(raw_hit["visibility"], field_name="visibility"),
                linked_question_id=linked_question_id,
                updated_at=MeilisearchNotesClient._require_str(raw_hit["updated_at"], field_name="updated_at"),
                formatted_title=MeilisearchNotesClient._optional_str(
                    formatted_dict.get("title"),
                    field_name="_formatted.title",
                ),
                formatted_body_text=MeilisearchNotesClient._optional_str(
                    formatted_dict.get("body_text"),
                    field_name="_formatted.body_text",
                ),
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise NotesSearchUnavailable("notes search backend returned an invalid hit") from exc

    @staticmethod
    def _require_str(value: Any, *, field_name: str) -> str:
        if not isinstance(value, str):
            raise TypeError(f"{field_name} must be a string")
        return value

    @staticmethod
    def _optional_str(value: Any, *, field_name: str) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            raise TypeError(f"{field_name} must be a string")
        return value

    @staticmethod
    def _optional_int(value: Any, *, field_name: str) -> int | None:
        if value is None:
            return None
        if not isinstance(value, int) or isinstance(value, bool):
            raise TypeError(f"{field_name} must be an integer")
        return value

    @staticmethod
    def _require_int(value: Any, *, field_name: str) -> int:
        if not isinstance(value, int) or isinstance(value, bool):
            raise TypeError(f"{field_name} must be an integer")
        return value

    @staticmethod
    def _require_str_list(value: Any, *, field_name: str) -> list[str]:
        if not isinstance(value, list):
            raise TypeError(f"{field_name} must be a list")
        if not all(isinstance(item, str) for item in value):
            raise TypeError(f"{field_name} entries must be strings")
        return list(value)

    @staticmethod
    def _coerce_int(value: Any, *, field_name: str) -> int:
        if not isinstance(value, int) or isinstance(value, bool):
            raise NotesSearchUnavailable(f"notes search backend returned an invalid {field_name}")
        return value


def build_notes_search_client(settings: Settings) -> NotesSearchClientProtocol:
    if not settings.meili_url:
        return DisabledNotesSearchClient()
    return MeilisearchNotesClient(settings)
