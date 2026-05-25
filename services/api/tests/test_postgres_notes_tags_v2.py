from __future__ import annotations

import os
from pathlib import Path
from typing import Any, cast

import pytest
from sqlalchemy import select

from _helpers.practice_content_support import build_postgres_client, register_user
from sikao_api.db.models_v2 import NoteTagV2


def _app_factory(client):  # type: ignore[no-untyped-def]
    app = cast(Any, client.app)
    return app.state.db.session_factory


def _body_json(title: str, paragraph: str) -> dict[str, Any]:
    return {
        "type": "doc",
        "content": [
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": title}]},
            {"type": "paragraph", "content": [{"type": "text", "text": paragraph}]},
        ],
    }


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_note_tags_crud_rename_merge_and_system_protection(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client, email="tags@example.com", display_name="Tags User")
        note_a = client.post(
            "/api/v2/notes",
            json={"title": "Tag A", "bodyJson": _body_json("A", "alpha"), "tags": ["math", "alpha"]},
        )
        note_b = client.post(
            "/api/v2/notes",
            json={"title": "Tag B", "bodyJson": _body_json("B", "beta"), "tags": ["beta"]},
        )
        assert note_a.status_code == 200, note_a.text
        assert note_b.status_code == 200, note_b.text
        note_a_id = note_a.json()["id"]
        note_b_id = note_b.json()["id"]

        listed = client.get("/api/v2/notes/tags")
        assert listed.status_code == 200, listed.text
        assert [item["tagName"] for item in listed.json()] == ["alpha", "beta", "math"]

        added = client.post(f"/api/v2/notes/{note_b_id}/tags", json={"tagName": "math"})
        assert added.status_code == 200, added.text
        assert added.json()["status"] == "added"

        renamed = client.patch("/api/v2/notes/tags/rename", json={"oldName": "alpha", "newName": "gamma"})
        assert renamed.status_code == 200, renamed.text

        merged = client.post(
            "/api/v2/notes/tags/merge",
            json={"sourceTags": ["beta"], "targetTag": "math"},
        )
        assert merged.status_code == 200, merged.text

        listed_after_merge = client.get("/api/v2/notes/tags")
        assert listed_after_merge.status_code == 200, listed_after_merge.text
        assert listed_after_merge.json()[0]["tagName"] == "math"
        assert listed_after_merge.json()[0]["usageCount"] == 2

        removed = client.delete(f"/api/v2/notes/{note_a_id}/tags/gamma")
        assert removed.status_code == 200, removed.text
        assert removed.json()["status"] == "removed"

        factory = _app_factory(client)
        with factory() as session:
            note_a_tags = list(session.scalars(select(NoteTagV2.tag_name).where(NoteTagV2.note_id == note_a_id).order_by(NoteTagV2.id.asc())))
            note_b_tags = list(session.scalars(select(NoteTagV2.tag_name).where(NoteTagV2.note_id == note_b_id).order_by(NoteTagV2.id.asc())))
            assert note_a_tags == ["math"]
            assert note_b_tags == ["math"]

            session.add(
                NoteTagV2(
                    user_id=user_id,
                    note_id=note_a_id,
                    tag_name="weekly_review",
                    is_system=True,
                )
            )
            session.commit()

        forbidden = client.patch("/api/v2/notes/tags/rename", json={"oldName": "weekly_review", "newName": "weekly_x"})
        assert forbidden.status_code == 403, forbidden.text

        forbidden_delete = client.delete(f"/api/v2/notes/{note_a_id}/tags/weekly_review")
        assert forbidden_delete.status_code == 403, forbidden_delete.text

        forbidden_merge = client.post(
            "/api/v2/notes/tags/merge",
            json={"sourceTags": ["weekly_review"], "targetTag": "math"},
        )
        assert forbidden_merge.status_code == 403, forbidden_merge.text


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_note_tags_enforce_limit_and_rename_conflict(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client, email="limit@example.com", display_name="Tag Limit User")
        note = client.post(
            "/api/v2/notes",
            json={"title": "Limit", "bodyJson": _body_json("Limit", "body"), "tags": [f"t{i}" for i in range(10)]},
        )
        assert note.status_code == 200, note.text
        note_id = note.json()["id"]

        overflow = client.post(f"/api/v2/notes/{note_id}/tags", json={"tagName": "overflow"})
        assert overflow.status_code == 422, overflow.text
        assert overflow.json()["code"] == "tag_limit_exceeded"

        other = client.post(
            "/api/v2/notes",
            json={"title": "Other", "bodyJson": _body_json("Other", "body"), "tags": ["existing"]},
        )
        assert other.status_code == 200, other.text

        conflict = client.patch("/api/v2/notes/tags/rename", json={"oldName": "t0", "newName": "existing"})
        assert conflict.status_code == 409, conflict.text
