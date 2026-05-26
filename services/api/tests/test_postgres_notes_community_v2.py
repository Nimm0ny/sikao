from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import pytest
from sqlalchemy import select

from _helpers.notes_search_support import InMemoryNotesSearchClient
from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import AuditLogV2, NoteV2


def _body_json(text: str) -> dict[str, Any]:
    return {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": text}],
            }
        ],
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
def test_postgres_notes_community_visibility_toggle_audits_and_syncs(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        fake_client = InMemoryNotesSearchClient()
        app = cast(Any, client.app)
        app.state.notes_search_client = fake_client

        owner_id = register_user(
            client,
            email="notes-community-owner@example.com",
            display_name="Community Owner",
        )
        created = client.post(
            "/api/v2/notes",
            json={
                "title": "Community Note",
                "bodyJson": _body_json("太短了"),
                "tags": ["community", "logic"],
            },
        )
        assert created.status_code == 200, created.text
        note_id = created.json()["id"]
        assert fake_client.documents[note_id].visibility == "private"

        too_short = client.patch(
            f"/api/v2/notes/{note_id}/visibility",
            json={"visibility": "public"},
        )
        assert too_short.status_code == 422, too_short.text
        assert too_short.json()["code"] == "content_too_short"

        long_text = "公开笔记内容用于社区发布验证。" * 4
        updated = client.put(
            f"/api/v2/notes/{note_id}",
            json={"bodyJson": _body_json(long_text)},
        )
        assert updated.status_code == 200, updated.text

        published = client.patch(
            f"/api/v2/notes/{note_id}/visibility",
            json={"visibility": "public"},
        )
        assert published.status_code == 200, published.text
        assert published.json()["visibility"] == "public"
        assert fake_client.documents[note_id].visibility == "public"

        viewer_id = register_user(
            client,
            email="notes-community-viewer@example.com",
            display_name="Community Viewer",
        )
        assert viewer_id != owner_id

        feed = client.get("/api/v2/notes/community")
        assert feed.status_code == 200, feed.text
        assert feed.json()["total"] == 1
        assert feed.json()["items"][0]["id"] == note_id
        assert feed.json()["items"][0]["authorName"] == "Community Owner"

        factory = app.state.db.session_factory
        with factory() as session:
            publish_audit = (
                session.query(AuditLogV2)
                .filter(
                    AuditLogV2.user_id == owner_id,
                    AuditLogV2.action == "notes.community.visibility_updated",
                    AuditLogV2.target_id == note_id,
                )
                .order_by(AuditLogV2.id.asc())
                .all()
            )
            assert len(publish_audit) == 1
            assert publish_audit[0].before["visibility"] == "private"
            assert publish_audit[0].after["visibility"] == "public"

        _login_user(client, email="notes-community-owner@example.com")
        hidden = client.patch(
            f"/api/v2/notes/{note_id}/visibility",
            json={"visibility": "private"},
        )
        assert hidden.status_code == 200, hidden.text
        assert fake_client.documents[note_id].visibility == "private"

        _login_user(client, email="notes-community-viewer@example.com")
        feed_after_hide = client.get("/api/v2/notes/community")
        assert feed_after_hide.status_code == 200, feed_after_hide.text
        assert feed_after_hide.json()["total"] == 0


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_community_feed_sorts_and_filters(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        owner_id = register_user(
            client,
            email="notes-community-feed-owner@example.com",
            display_name="Feed Owner",
        )
        linked_question_id = seed_paper(
            client,
            paper_code="XC-NOTES-COMMUNITY-001",
            title="Notes Community Feed",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Community linked question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )[0]

        payloads = [
            {
                "title": "Latest Note",
                "bodyJson": _body_json("最新公开笔记内容用于社区展示验证。" * 3),
                "tags": ["community", "latest"],
            },
            {
                "title": "Hot Note",
                "bodyJson": _body_json("热门公开笔记内容用于社区展示验证。" * 3),
                "tags": ["community", "hot"],
                "linkedQuestionId": linked_question_id,
            },
            {
                "title": "Featured Note",
                "bodyJson": _body_json("精选公开笔记内容用于社区展示验证。" * 3),
                "tags": ["community", "featured", "logic"],
                "linkedQuestionId": linked_question_id,
            },
            {
                "title": "Deleted Note",
                "bodyJson": _body_json("已删除公开笔记内容用于社区展示验证。" * 3),
                "tags": ["community", "logic"],
            },
        ]
        note_ids: list[int] = []
        for payload in payloads:
            response = client.post("/api/v2/notes", json=payload)
            assert response.status_code == 200, response.text
            note_ids.append(response.json()["id"])

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            notes = {
                note.id: note
                for note in session.scalars(
                    select(NoteV2).where(NoteV2.id.in_(note_ids))
                )
            }
            now = datetime.now(UTC).replace(tzinfo=None)

            latest_note = notes[note_ids[0]]
            latest_note.visibility = "public"
            latest_note.created_at = now

            hot_note = notes[note_ids[1]]
            hot_note.visibility = "public"
            hot_note.created_at = now - timedelta(hours=2)
            hot_note.reaction_count = 12
            hot_note.comment_count = 2

            featured_note = notes[note_ids[2]]
            featured_note.visibility = "public"
            featured_note.created_at = now - timedelta(hours=1)
            featured_note.reaction_count = 5
            featured_note.comment_count = 1
            featured_note.is_featured = True

            deleted_note = notes[note_ids[3]]
            deleted_note.visibility = "public"
            deleted_note.created_at = now - timedelta(hours=3)
            deleted_note.deleted_at = now - timedelta(minutes=1)

            session.commit()

        viewer_id = register_user(
            client,
            email="notes-community-feed-viewer@example.com",
            display_name="Feed Viewer",
        )
        assert viewer_id != owner_id

        latest = client.get("/api/v2/notes/community", params={"sort": "latest"})
        assert latest.status_code == 200, latest.text
        latest_titles = [item["title"] for item in latest.json()["items"]]
        assert latest_titles == ["Latest Note", "Featured Note", "Hot Note"]

        hottest = client.get("/api/v2/notes/community", params={"sort": "hottest"})
        assert hottest.status_code == 200, hottest.text
        hottest_titles = [item["title"] for item in hottest.json()["items"]]
        assert hottest_titles == ["Hot Note", "Featured Note", "Latest Note"]

        featured = client.get("/api/v2/notes/community", params={"sort": "featured"})
        assert featured.status_code == 200, featured.text
        assert [item["title"] for item in featured.json()["items"]] == ["Featured Note"]

        linked = client.get(
            "/api/v2/notes/community",
            params={"linked_question_id": linked_question_id},
        )
        assert linked.status_code == 200, linked.text
        assert {item["title"] for item in linked.json()["items"]} == {
            "Hot Note",
            "Featured Note",
        }

        linked_camel = client.get(
            "/api/v2/notes/community",
            params={"linkedQuestionId": linked_question_id},
        )
        assert linked_camel.status_code == 200, linked_camel.text
        assert {item["title"] for item in linked_camel.json()["items"]} == {
            "Hot Note",
            "Featured Note",
        }

        tagged = client.get(
            "/api/v2/notes/community",
            params={"tags": "community,logic"},
        )
        assert tagged.status_code == 200, tagged.text
        assert [item["title"] for item in tagged.json()["items"]] == ["Featured Note"]


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_update_cannot_bypass_public_visibility_gate(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        owner_id = register_user(
            client,
            email="notes-community-update-owner@example.com",
            display_name="Update Owner",
        )
        created = client.post(
            "/api/v2/notes",
            json={
                "title": "Update Gate Note",
                "bodyJson": _body_json("太短了"),
                "tags": ["community"],
            },
        )
        assert created.status_code == 200, created.text
        note_id = created.json()["id"]

        invalid_publish = client.put(
            f"/api/v2/notes/{note_id}",
            json={"visibility": "public"},
        )
        assert invalid_publish.status_code == 422, invalid_publish.text
        assert invalid_publish.json()["code"] == "content_too_short"

        published = client.put(
            f"/api/v2/notes/{note_id}",
            json={
                "visibility": "public",
                "bodyJson": _body_json("通用更新路径也必须遵守公开门槛，不能绕过五十字限制。" * 3),
            },
        )
        assert published.status_code == 200, published.text
        assert published.json()["visibility"] == "public"

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            row = (
                session.query(AuditLogV2)
                .filter(
                    AuditLogV2.user_id == owner_id,
                    AuditLogV2.action == "notes.community.visibility_updated",
                    AuditLogV2.target_id == note_id,
                )
                .order_by(AuditLogV2.id.desc())
                .one()
            )
            assert row.before["visibility"] == "private"
            assert row.after["visibility"] == "public"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_create_public_enforces_gate_and_records_audit(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        owner_id = register_user(
            client,
            email="notes-community-create-public@example.com",
            display_name="Create Public Owner",
        )

        too_short = client.post(
            "/api/v2/notes",
            json={
                "title": "Too Short Public",
                "bodyJson": _body_json("太短了"),
                "visibility": "public",
                "tags": ["community"],
            },
        )
        assert too_short.status_code == 422, too_short.text
        assert too_short.json()["code"] == "content_too_short"

        created = client.post(
            "/api/v2/notes",
            json={
                "title": "Public On Create",
                "bodyJson": _body_json("公开创建路径同样必须留下完整审计轨迹。" * 4),
                "visibility": "public",
                "tags": ["community", "create"],
            },
        )
        assert created.status_code == 200, created.text
        note_id = created.json()["id"]
        assert created.json()["visibility"] == "public"

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            row = (
                session.query(AuditLogV2)
                .filter(
                    AuditLogV2.user_id == owner_id,
                    AuditLogV2.action == "notes.community.visibility_updated",
                    AuditLogV2.target_id == note_id,
                )
                .order_by(AuditLogV2.id.desc())
                .one()
            )
            assert row.before["visibility"] is None
            assert row.after["visibility"] == "public"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_community_visibility_sync_failure_is_audited(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        fake_client = InMemoryNotesSearchClient()
        app = cast(Any, client.app)
        app.state.notes_search_client = fake_client

        owner_id = register_user(
            client,
            email="notes-community-sync-owner@example.com",
            display_name="Sync Owner",
        )
        created = client.post(
            "/api/v2/notes",
            json={
                "title": "Sync Failure Note",
                "bodyJson": _body_json("社区公开同步失败审计覆盖。" * 4),
                "tags": ["community"],
            },
        )
        assert created.status_code == 200, created.text
        note_id = created.json()["id"]

        fake_client.fail_sync = True
        published = client.patch(
            f"/api/v2/notes/{note_id}/visibility",
            json={"visibility": "public"},
        )
        assert published.status_code == 200, published.text

        factory = app.state.db.session_factory
        with factory() as session:
            row = (
                session.query(AuditLogV2)
                .filter(
                    AuditLogV2.user_id == owner_id,
                    AuditLogV2.action == "notes.search.community_visibility_failed",
                    AuditLogV2.target_id == note_id,
                )
                .order_by(AuditLogV2.id.desc())
                .one()
            )
            assert row.metadata_json["error"] == "meilisearch sync failed"
