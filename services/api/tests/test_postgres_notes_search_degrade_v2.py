from __future__ import annotations

import os
from pathlib import Path
from typing import Any, cast

import pytest

from _helpers.notes_search_support import InMemoryNotesSearchClient
from _helpers.practice_content_support import build_postgres_client, register_user
from sikao_api.modules.notes_v2.infrastructure.meilisearch_client import NoteSearchHit, NoteSearchResult


def _body_json(text: str) -> dict[str, Any]:
    return {
        "type": "doc",
        "content": [{"type": "paragraph", "content": [{"type": "text", "text": text}]}],
    }


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_search_returns_503_when_backend_is_unavailable(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        app = cast(Any, client.app)
        app.state.notes_search_client = InMemoryNotesSearchClient(fail_search=True)
        register_user(client, email="notes-search-unavailable@example.com", display_name="Notes Search Unavailable")

        note = client.post(
            "/api/v2/notes",
            json={"title": "Unavailable Search Note", "bodyJson": _body_json("searchable unavailable body"), "tags": ["fallback"]},
        )
        assert note.status_code == 200, note.text

        response = client.get("/api/v2/notes/search", params={"q": "searchable"})
        assert response.status_code == 503, response.text
        assert response.json()["code"] == "search_unavailable"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_search_returns_503_for_invalid_hit_payload(tmp_path: Path) -> None:
    class InvalidHitSearchClient(InMemoryNotesSearchClient):
        def search(
            self,
            *,
            query: str,
            filter_expression: str,
            page: int,
            size: int,
        ) -> NoteSearchResult:
            return NoteSearchResult(
                hits=[NoteSearchHit(id=1, title="Broken Search Note", body_text="searchable broken body", tags=["broken"], type="free", visibility="private", linked_question_id=None, updated_at="not-a-datetime")],
                total=1,
                facet_distribution={"type": {"free": 1}, "tags": {"broken": 1}},
            )

    with build_postgres_client(tmp_path) as client:
        app = cast(Any, client.app)
        app.state.notes_search_client = InvalidHitSearchClient()
        register_user(client, email="notes-search-invalid-hit@example.com", display_name="Notes Search Invalid Hit")

        response = client.get("/api/v2/notes/search", params={"q": "searchable"})
        assert response.status_code == 503, response.text
        assert response.json()["code"] == "search_unavailable"
