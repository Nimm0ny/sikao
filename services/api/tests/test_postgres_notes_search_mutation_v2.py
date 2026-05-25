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


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_search_update_delete_and_filter_validation(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        fake_client = InMemoryNotesSearchClient()
        app = cast(Any, client.app)
        app.state.notes_search_client = fake_client

        user_id = register_user(client, email="notes-search-main@example.com", display_name="Notes Search Main")
        note_a1 = client.post(
            "/api/v2/notes",
            json={"title": "Search Alpha", "bodyJson": _body_json("searchable alpha body"), "tags": ["math", "list,item"]},
        )
        assert note_a1.status_code == 200, note_a1.text
        note_a1_id = note_a1.json()["id"]

        note_a2 = client.post(
            "/api/v2/notes",
            json={"title": "Search Beta", "bodyJson": _body_json("searchable beta body"), "type": "weekly_review", "tags": ["logic"]},
        )
        assert note_a2.status_code == 200, note_a2.text
        note_a2_id = note_a2.json()["id"]

        updated = client.put(
            f"/api/v2/notes/{note_a1_id}",
            json={"title": "Updated Search Alpha", "bodyJson": _body_json("updated searchable alpha body"), "tags": ["updated", "list,item"]},
        )
        assert updated.status_code == 200, updated.text
        assert fake_client.documents[note_a1_id].title == "Updated Search Alpha"
        assert fake_client.documents[note_a1_id].tags == ["updated", "list,item"]

        deleted = client.delete(f"/api/v2/notes/{note_a2_id}")
        assert deleted.status_code == 204, deleted.text
        assert note_a2_id not in fake_client.documents

        filtered = client.get(
            "/api/v2/notes/search",
            params={"q": "updated", "filters": 'type:free,tags:"list,item",tags:updated', "page": 1, "size": 20},
        )
        assert filtered.status_code == 200, filtered.text
        payload = filtered.json()
        assert payload["total"] == 1
        assert payload["items"][0]["title"] == "Updated Search Alpha"
        assert payload["facetDistribution"]["type"] == {"free": 1}
        assert payload["facetDistribution"]["tags"] == {"list,item": 1, "updated": 1}
        assert fake_client.search_filters[-1] == (
            f'user_id = {user_id} AND type = "free" AND (tags = "list,item") AND (tags = "updated")'
        )

        invalid_filter = client.get("/api/v2/notes/search", params={"q": "updated", "filters": "owner:someone"})
        assert invalid_filter.status_code == 422, invalid_filter.text

        empty_tag_filter = client.get("/api/v2/notes/search", params={"q": "updated", "filters": 'tags:"   "'})
        assert empty_tag_filter.status_code == 422, empty_tag_filter.text
