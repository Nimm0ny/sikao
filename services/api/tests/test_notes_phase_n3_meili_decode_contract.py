from __future__ import annotations

import pytest
import httpx
from pathlib import Path

from sikao_api.core.config import Settings
from sikao_api.modules.notes_v2.application.search_service import NotesSearchServiceV2
from sikao_api.modules.notes_v2.infrastructure.meilisearch_client import (
    MeilisearchNotesClient,
    NotesSearchUnavailable,
)


def test_notes_search_decode_hit_and_response_contract() -> None:
    hit = MeilisearchNotesClient._decode_hit(
        {
            "id": 42,
            "title": "Search Title",
            "body_text": "searchable body text",
            "tags": ["math", "logic"],
            "type": "free",
            "visibility": "private",
            "linked_question_id": 7,
            "updated_at": "2026-05-26T00:00:00Z",
            "_formatted": {
                "title": "<em>Search</em> Title",
                "body_text": "<em>searchable</em> body text",
            },
        }
    )

    item = NotesSearchServiceV2._serialize_hit(hit)
    payload = item.model_dump(mode="json")
    assert payload["id"] == 42
    assert payload["title"] == "Search Title"
    assert payload["type"] == "free"
    assert payload["visibility"] == "private"
    assert payload["bodyPreview"] == "searchable body text"
    assert payload["linkedQuestionId"] == 7
    assert payload["highlights"] == ["<em>Search</em> Title", "<em>searchable</em> body text"]
    assert payload["updatedAt"] == "2026-05-26T00:00:00Z"


def test_notes_search_decode_hit_rejects_invalid_payload() -> None:
    invalid_payloads = [
        {
            "id": "bad-id",
            "title": "Broken",
            "body_text": "broken",
            "tags": ["ok"],
            "type": "free",
            "visibility": "private",
            "updated_at": "2026-05-26T00:00:00Z",
        },
        {
            "id": 1,
            "title": {"bad": "title"},
            "body_text": "broken",
            "tags": ["ok"],
            "type": "free",
            "visibility": "private",
            "updated_at": "2026-05-26T00:00:00Z",
        },
        {
            "id": 1,
            "title": "Broken",
            "body_text": ["bad-body"],
            "tags": ["ok"],
            "type": "free",
            "visibility": "private",
            "updated_at": "2026-05-26T00:00:00Z",
        },
        {
            "id": 1,
            "title": "Broken",
            "body_text": "broken",
            "tags": "not-a-list",
            "type": "free",
            "visibility": "private",
            "updated_at": "2026-05-26T00:00:00Z",
        },
        {
            "id": 1,
            "title": "Broken",
            "body_text": "broken",
            "tags": ["ok"],
            "type": {"bad": "type"},
            "visibility": "private",
            "updated_at": "2026-05-26T00:00:00Z",
        },
        {
            "id": 1,
            "title": "Broken",
            "body_text": "broken",
            "tags": ["ok"],
            "type": "free",
            "visibility": False,
            "updated_at": "2026-05-26T00:00:00Z",
        },
        {
            "id": 1,
            "title": "Broken",
            "body_text": "broken",
            "tags": ["ok"],
            "type": "free",
            "visibility": "private",
            "linked_question_id": "7",
            "updated_at": "2026-05-26T00:00:00Z",
        },
    ]

    for payload in invalid_payloads:
        with pytest.raises(NotesSearchUnavailable):
            MeilisearchNotesClient._decode_hit(payload)


def test_notes_search_search_rejects_invalid_metadata_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = MeilisearchNotesClient(
        Settings(
            app_env="test",
            database_url="postgresql+psycopg://postgres@127.0.0.1:15433/postgres",
            upload_dir=Path("var/uploads"),
            import_tmp_dir=Path("var/imports"),
            jwt_secret="decode-contract-secret",
            meili_url="http://meili.test",
            meili_master_key="decode-contract-key",
        )
    )
    response = httpx.Response(
        200,
        request=httpx.Request("POST", "http://meili.test/indexes/notes/search"),
        json={
            "hits": [],
            "estimatedTotalHits": "oops",
            "facetDistribution": {"type": {"free": "bad-count"}},
        },
    )
    monkeypatch.setattr(client, "_request", lambda *args, **kwargs: response)
    with pytest.raises(NotesSearchUnavailable):
        client.search(query="searchable", filter_expression="user_id = 1", page=1, size=20)
    client.close()
