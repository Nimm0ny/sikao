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
