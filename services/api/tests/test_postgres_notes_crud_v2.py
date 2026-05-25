from __future__ import annotations

import os
from pathlib import Path
from typing import Any, cast

import pytest
from sqlalchemy import select

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import NoteTagV2, NoteV2


def _app_factory(client):  # type: ignore[no-untyped-def]
    app = cast(Any, client.app)
    return app.state.db.session_factory


def _body_json(title: str, paragraph: str, alt_text: str = "示意图") -> dict[str, Any]:
    return {
        "type": "doc",
        "content": [
            {
                "type": "heading",
                "attrs": {"level": 2},
                "content": [{"type": "text", "text": title}],
            },
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": paragraph}],
            },
            {
                "type": "image",
                "attrs": {"src": "/uploads/notes/demo.png", "alt": alt_text},
            },
        ],
    }


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_crud_flow_derives_body_fields_and_soft_deletes(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client, email="notes@example.com", display_name="Notes User")
        question_id = seed_paper(
            client,
            paper_code="XC-NOTES-CRUD-001",
            title="Notes CRUD",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Linked question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )[0]

        created = client.post(
            "/api/v2/notes",
            json={
                "title": "排列组合",
                "bodyJson": _body_json("排列组合", "捆绑法适用于相邻约束。"),
                "linkedQuestionId": question_id,
                "tags": ["math", "formula"],
                "visibility": "private",
            },
        )
        assert created.status_code == 200, created.text
        created_body = created.json()
        note_id = created_body["id"]
        assert created_body["type"] == "question_level"
        assert created_body["bodyText"]
        assert created_body["wordCount"] > 0
        assert created_body["linkedQuestionId"] == question_id
        assert created_body["linkedQuestionBrief"] is not None
        assert created_body["tags"] == ["math", "formula"]
        assert created_body["authorName"] == "Notes User"
        assert created_body["reactionCount"] == 0
        assert created_body["commentCount"] == 0
        assert created_body["bookmarkCount"] == 0

        listed = client.get("/api/v2/notes")
        assert listed.status_code == 200, listed.text
        assert listed.json()["total"] == 1
        item = listed.json()["items"][0]
        assert item["id"] == note_id
        assert item["type"] == "question_level"
        assert item["wordCount"] == created_body["wordCount"]
        assert item["linkedQuestionId"] == question_id
        assert item["tags"] == ["math", "formula"]
        assert "捆绑法适用于相邻约束" in item["bodyPreview"]

        detail = client.get(f"/api/v2/notes/{note_id}")
        assert detail.status_code == 200, detail.text
        assert detail.json()["id"] == note_id

        updated = client.put(
            f"/api/v2/notes/{note_id}",
            json={
                "title": "排列组合更新",
                "bodyJson": _body_json("更新", "插空法适用于不相邻约束。", alt_text="新图"),
                "tags": ["math"],
            },
        )
        assert updated.status_code == 200, updated.text
        updated_body = updated.json()
        assert updated_body["title"] == "排列组合更新"
        assert updated_body["type"] == "question_level"
        assert "插空法适用于不相邻约束" in updated_body["bodyText"]
        assert updated_body["tags"] == ["math"]

        factory = _app_factory(client)
        with factory() as session:
            row = session.get(NoteV2, note_id)
            assert row is not None
            assert row.body_text == updated_body["bodyText"]
            assert row.word_count == updated_body["wordCount"]
            assert row.content_hash is not None and len(row.content_hash) == 64
            tags = list(session.scalars(select(NoteTagV2.tag_name).where(NoteTagV2.note_id == note_id)))
            assert tags == ["math"]

        deleted = client.delete(f"/api/v2/notes/{note_id}")
        assert deleted.status_code == 204, deleted.text

        listed_after_delete = client.get("/api/v2/notes")
        assert listed_after_delete.status_code == 200, listed_after_delete.text
        assert listed_after_delete.json()["total"] == 0

        detail_after_delete = client.get(f"/api/v2/notes/{note_id}")
        assert detail_after_delete.status_code == 404, detail_after_delete.text
        assert detail_after_delete.json()["code"] == "note_not_found"

        with factory() as session:
            row = session.get(NoteV2, note_id)
            assert row is not None
            assert row.deleted_at is not None


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_list_filters_pagination_and_owner_isolation(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client, email="owner@example.com", display_name="Owner")
        linked_question_id = seed_paper(
            client,
            paper_code="XC-NOTES-CRUD-002",
            title="Notes filters",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Filter linked question",
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
                "title": "自由笔记 A",
                "bodyJson": _body_json("自由A", "第一条自由笔记"),
                "type": "free",
                "tags": ["alpha"],
            },
            {
                "title": "题级笔记 B",
                "bodyJson": _body_json("题级B", "第二条题级笔记"),
                "linkedQuestionId": linked_question_id,
                "tags": ["beta"],
            },
            {
                "title": "自由笔记 C",
                "bodyJson": _body_json("自由C", "第三条自由笔记"),
                "type": "free",
                "tags": ["alpha", "gamma"],
            },
        ]
        created_ids: list[int] = []
        for payload in payloads:
            response = client.post("/api/v2/notes", json=payload)
            assert response.status_code == 200, response.text
            created_ids.append(response.json()["id"])

        page_one = client.get("/api/v2/notes", params={"page": 1, "size": 1, "sort": "title", "order": "asc"})
        assert page_one.status_code == 200, page_one.text
        assert page_one.json()["total"] == 3
        assert len(page_one.json()["items"]) == 1
        assert page_one.json()["items"][0]["title"] == "自由笔记 A"

        free_only = client.get("/api/v2/notes", params={"type": "free"})
        assert free_only.status_code == 200, free_only.text
        assert free_only.json()["total"] == 2

        linked_only = client.get("/api/v2/notes", params={"linkedQuestionId": linked_question_id})
        assert linked_only.status_code == 200, linked_only.text
        assert linked_only.json()["total"] == 1
        assert linked_only.json()["items"][0]["title"] == "题级笔记 B"

        tag_filtered = client.get("/api/v2/notes", params={"tags": "alpha"})
        assert tag_filtered.status_code == 200, tag_filtered.text
        assert tag_filtered.json()["total"] == 2

        relinked = client.put(
            f"/api/v2/notes/{created_ids[0]}",
            json={
                "linkedQuestionId": linked_question_id,
            },
        )
        assert relinked.status_code == 200, relinked.text
        assert relinked.json()["type"] == "question_level"

        register_user(client, email="other@example.com", display_name="Other")
        isolated = client.get("/api/v2/notes")
        assert isolated.status_code == 200, isolated.text
        assert isolated.json()["total"] == 0

        hidden = client.get("/api/v2/notes/1")
        assert hidden.status_code == 404, hidden.text
        assert hidden.json()["code"] == "note_not_found"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_create_rejects_invalid_linked_question_id(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client, email="invalid@example.com", display_name="Invalid Link User")

        created = client.post(
            "/api/v2/notes",
            json={
                "title": "无效关联",
                "bodyJson": _body_json("无效", "无效题目关联"),
                "linkedQuestionId": 999999,
            },
        )
        assert created.status_code == 422, created.text
        assert created.json()["code"] == "validation_error"
