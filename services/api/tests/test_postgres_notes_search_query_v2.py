from __future__ import annotations

import os
from pathlib import Path
from typing import Any, cast

import pytest

from _helpers.notes_search_support import InMemoryNotesSearchClient
from _helpers.practice_content_support import build_postgres_client, register_user


def _body_json(text: str) -> dict[str, Any]:
    return {
        "type": "doc",
        "content": [{"type": "paragraph", "content": [{"type": "text", "text": text}]}],
    }


def _login_user(client: Any, *, email: str) -> None:
    response = client.post(
        "/api/v2/auth/login",
        json={"identifier": email, "password": "secret123"},
    )
    assert response.status_code == 200, response.text
    csrf = response.cookies.get("csrf_token_v2")
    assert csrf is not None
    client.headers["X-CSRF-Token"] = csrf


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_search_facets_and_user_isolation(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        fake_client = InMemoryNotesSearchClient()
        app = cast(Any, client.app)
        app.state.notes_search_client = fake_client

        user_a = register_user(client, email="notes-search-a@example.com", display_name="Notes Search A")
        note_a1 = client.post(
            "/api/v2/notes",
            json={"title": "Search Alpha", "bodyJson": _body_json("searchable alpha body"), "tags": ["math", "list,item"]},
        )
        assert note_a1.status_code == 200, note_a1.text

        note_a2 = client.post(
            "/api/v2/notes",
            json={"title": "Search Beta", "bodyJson": _body_json("searchable beta body"), "type": "weekly_review", "tags": ["logic"]},
        )
        assert note_a2.status_code == 200, note_a2.text

        note_b = client.post(
            "/api/v2/notes",
            json={"title": "Search Hidden", "bodyJson": _body_json("searchable hidden body"), "tags": ["essay"]},
        )
        assert note_b.status_code == 200, note_b.text

        _login_user(client, email="notes-search-a@example.com")

        response = client.get("/api/v2/notes/search", params={"q": "searchable", "page": 1, "size": 20})
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["total"] == 2
        assert {item["title"] for item in payload["items"]} == {"Search Alpha", "Search Beta"}
        assert payload["facetDistribution"]["type"] == {"free": 1, "weekly_review": 1}
        assert payload["facetDistribution"]["tags"] == {"list,item": 1, "logic": 1, "math": 1}
        first_item = payload["items"][0]
        assert first_item["bodyPreview"]
        assert first_item["highlights"]
        assert first_item["linkedQuestionId"] is None
        assert first_item["updatedAt"].endswith("Z")
        assert fake_client.search_filters[-1] == f"user_id = {user_a}"
