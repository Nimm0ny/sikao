from __future__ import annotations

import os
from pathlib import Path
from typing import Any, cast

import pytest

from _helpers.notes_search_support import InMemoryNotesSearchClient
from _helpers.practice_content_support import build_postgres_client, register_user
from sikao_api.db.models_v2 import AuditLogV2
from sikao_api.modules.notes_v2.application.search_service import NotesSearchServiceV2


def _body_json(text: str) -> dict[str, Any]:
    return {
        "type": "doc",
        "content": [{"type": "paragraph", "content": [{"type": "text", "text": text}]}],
    }


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_search_records_create_and_delete_audit(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        fake_client = InMemoryNotesSearchClient(fail_sync=True)
        app = cast(Any, client.app)
        app.state.notes_search_client = fake_client
        user_id = register_user(client, email="notes-search-audit@example.com", display_name="Notes Search Audit")

        created = client.post(
            "/api/v2/notes",
            json={"title": "Audit Search Note", "bodyJson": _body_json("searchable audit body"), "tags": ["audit"]},
        )
        assert created.status_code == 200, created.text
        note_id = created.json()["id"]

        factory = app.state.db.session_factory
        with factory() as session:
            create_row = (
                session.query(AuditLogV2)
                .filter(AuditLogV2.user_id == user_id, AuditLogV2.action == "notes.search.create_failed", AuditLogV2.target_id == note_id)
                .one()
            )
            assert create_row.metadata_json["error"] == "meilisearch sync failed"

        fake_client.fail_sync = False
        client.put(
            f"/api/v2/notes/{note_id}",
            json={"title": "Delete Audit Search Note", "bodyJson": _body_json("searchable delete body"), "tags": ["delete"]},
        )
        fake_client.fail_sync = True
        deleted = client.delete(f"/api/v2/notes/{note_id}")
        assert deleted.status_code == 204, deleted.text

        with factory() as session:
            delete_row = (
                session.query(AuditLogV2)
                .filter(AuditLogV2.user_id == user_id, AuditLogV2.action == "notes.search.delete_failed", AuditLogV2.target_id == note_id)
                .one()
            )
            assert delete_row.metadata_json["error"] == "meilisearch sync failed"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_search_audit_failure_still_returns_success(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with build_postgres_client(tmp_path) as client:
        fake_client = InMemoryNotesSearchClient(fail_sync=True)
        app = cast(Any, client.app)
        app.state.notes_search_client = fake_client
        register_user(client, email="notes-search-audit-fail@example.com", display_name="Notes Search Audit Fail")

        def _boom(**_: Any) -> None:
            raise RuntimeError("audit write failed")

        monkeypatch.setattr(NotesSearchServiceV2, "persist_sync_failure_audit", staticmethod(_boom))

        response = client.post(
            "/api/v2/notes",
            json={"title": "Audit Failure Search Note", "bodyJson": _body_json("searchable audit failure body"), "tags": ["audit"]},
        )
        assert response.status_code == 200, response.text
