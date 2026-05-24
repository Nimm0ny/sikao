from __future__ import annotations

import os
from pathlib import Path
from typing import Any, cast

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import AiCauseAnalysisV2, LlmCallV2, NoteV2, ReviewItemV2, UserV2
from sikao_api.modules.review.application.queue_items import today_end_utc
from sikao_api.modules.review.application.service import graduate_review_item
from sikao_api.modules.system.application.errors import ConflictError


def _review_rows(client: TestClient) -> list[ReviewItemV2]:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        rows = list(session.query(ReviewItemV2).order_by(ReviewItemV2.id.asc()))
        for row in rows:
            session.expunge(row)
        return rows


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_review_create_list_detail_and_duplicate_manual_add(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-CRUD-001",
            title="Review CRUD Source",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Manual add me",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )[0]
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            session.add(
                NoteV2(
                    user_id=user_id,
                    title="Review note",
                    body="note body",
                    linked_question_id=question_id,
                    visibility="private",
                )
            )
            llm_call = LlmCallV2(
                user_id=user_id,
                purpose="review_cause_analysis",
                prompt_version="cause_analysis_single@v1",
                provider="mock",
                model="mock-model",
                latency_ms=1,
                request_payload={"questionId": question_id},
                parse_status="ok",
            )
            session.add(llm_call)
            session.flush()
            session.add(
                AiCauseAnalysisV2(
                    user_id=user_id,
                    scope="single",
                    question_id=question_id,
                    input_hash="existing-cause",
                    result_json={"summary": "existing"},
                    llm_call_id=llm_call.id,
                    expires_at=llm_call.created_at,
                )
            )
            session.commit()

        created = client.post("/api/v2/review/items", json={"questionId": question_id})
        assert created.status_code == 200, created.text
        assert created.json()["kind"] == "manual_add"
        assert created.json()["status"] == "pending"
        assert created.json()["questionId"] == question_id
        assert created.json()["hasUserNotes"] is True
        assert created.json()["hasCauseAnalysis"] is True

        listed = client.get("/api/v2/review/items")
        assert listed.status_code == 200, listed.text
        assert listed.json()["total"] == 1
        assert listed.json()["items"][0]["kind"] == "manual_add"

        detail = client.get(f"/api/v2/review/items/{created.json()['id']}")
        assert detail.status_code == 200, detail.text
        payload = detail.json()
        assert payload["item"]["kind"] == "manual_add"
        assert payload["item"]["hasUserNotes"] is True
        assert payload["item"]["hasCauseAnalysis"] is True
        assert payload["srsState"]["algorithmVersion"] == "simple_v1"
        assert payload["history"][0]["outcome"] == "created"
        assert {action["key"] for action in payload["actions"]} >= {"graduate", "archive", "redo"}

        duplicate = client.post("/api/v2/review/items", json={"questionId": question_id})
        assert duplicate.status_code == 409, duplicate.text
        assert duplicate.json()["code"] == "review_item_already_active"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_review_archive_restore_and_batch_actions(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="XC-REVIEW-CRUD-002",
            title="Review CRUD Batch",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "First item",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
                {
                    "prompt": "Second item",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
            ],
        )

        first = client.post("/api/v2/review/items", json={"questionId": question_ids[0]})
        second = client.post("/api/v2/review/items", json={"questionId": question_ids[1]})
        assert first.status_code == 200, first.text
        assert second.status_code == 200, second.text
        first_id = first.json()["id"]
        second_id = second.json()["id"]

        archived = client.patch(f"/api/v2/review/items/{first_id}/archive")
        assert archived.status_code == 200, archived.text
        assert archived.json()["status"] == "archived"

        active_list = client.get("/api/v2/review/items")
        assert active_list.status_code == 200, active_list.text
        assert [item["id"] for item in active_list.json()["items"]] == [second_id]

        restored = client.patch(f"/api/v2/review/items/{first_id}/restore")
        assert restored.status_code == 200, restored.text
        assert restored.json()["status"] == "pending"
        assert restored.json()["correctStreak"] == 0

        batch_archived = client.post(
            "/api/v2/review/items/batch",
            json={"itemIds": [first_id, second_id], "action": "archive"},
        )
        assert batch_archived.status_code == 200, batch_archived.text
        assert batch_archived.json()["affectedCount"] == 2

        archived_list = client.get("/api/v2/review/items", params={"status": "archived"})
        assert archived_list.status_code == 200, archived_list.text
        assert archived_list.json()["total"] == 2

        batch_restored = client.post(
            "/api/v2/review/items/batch",
            json={"itemIds": [first_id, second_id], "action": "restore"},
        )
        assert batch_restored.status_code == 200, batch_restored.text
        assert batch_restored.json()["affectedCount"] == 2

        rows = _review_rows(client)
        assert all(row.status == "pending" for row in rows)


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_review_graduate_filters_and_dashboard_consumer(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="XC-REVIEW-CRUD-003",
            title="Review CRUD Graduate",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Graduate item",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
                {
                    "prompt": "Pending item",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
            ],
        )

        graduated = client.post("/api/v2/review/items", json={"questionId": question_ids[0]})
        pending = client.post("/api/v2/review/items", json={"questionId": question_ids[1]})
        assert graduated.status_code == 200, graduated.text
        assert pending.status_code == 200, pending.text

        promoted = client.patch(f"/api/v2/review/items/{graduated.json()['id']}/graduate")
        assert promoted.status_code == 200, promoted.text
        assert promoted.json()["status"] == "probationary"
        assert promoted.json()["correctStreak"] == 4
        assert promoted.json()["nextReviewAt"] is not None

        detail = client.get(f"/api/v2/review/items/{graduated.json()['id']}")
        assert detail.status_code == 200, detail.text
        assert detail.json()["history"][0]["outcome"] == "mark_resolved"

        filtered = client.get(
            "/api/v2/review/items",
            params={"status": "probationary", "order_by": "correct_streak", "order_dir": "desc"},
        )
        assert filtered.status_code == 200, filtered.text
        assert filtered.json()["total"] == 1
        assert filtered.json()["items"][0]["id"] == graduated.json()["id"]

        dashboard = client.get("/api/v2/dashboard/today/review")
        assert dashboard.status_code == 200, dashboard.text
        assert dashboard.json()["total"] == 1
        ids = {item["id"] for item in dashboard.json()["items"]}
        assert ids == {pending.json()["id"]}


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_review_list_normalizes_legacy_flagged_rows(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-CRUD-LEGACY",
            title="Review CRUD Legacy",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Legacy flagged row",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )[0]
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            session.add(
                ReviewItemV2(
                    user_id=user_id,
                    source_kind="question_flag",
                    source_id=question_id,
                    title="Legacy flagged row",
                    status="resolved",
                    question_id=question_id,
                    metadata_json={},
                    reason="flagged_persistent",
                )
            )
            session.commit()

        archived = client.get(
            "/api/v2/review/items",
            params={"status": "archived", "sourceKind": "flagged_persistent"},
        )
        assert archived.status_code == 200, archived.text
        assert archived.json()["total"] == 1
        row = archived.json()["items"][0]
        assert row["kind"] == "flagged_persistent"
        assert row["status"] == "archived"

        dashboard = client.get("/api/v2/dashboard/today/review")
        assert dashboard.status_code == 200, dashboard.text
        assert dashboard.json()["total"] == 0


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_review_mutations_enforce_owner_scope(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client, email="owner@example.com", display_name="Owner")
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-CRUD-OWNER",
            title="Review CRUD Owner",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Owner row",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )[0]
        created = client.post("/api/v2/review/items", json={"questionId": question_id})
        assert created.status_code == 200, created.text
        item_id = created.json()["id"]

        register_user(client, email="other@example.com", display_name="Other")

        forbidden_archive = client.patch(f"/api/v2/review/items/{item_id}/archive")
        assert forbidden_archive.status_code == 404, forbidden_archive.text
        assert forbidden_archive.json()["code"] == "review_item_not_found"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_today_review_includes_item_due_later_today(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-CRUD-DUE",
            title="Review CRUD Due Today",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Due later today",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )[0]
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            session.add(
                ReviewItemV2(
                    user_id=user_id,
                    source_kind="manual_add",
                    source_id=question_id,
                    title="Due later today",
                    status="in_progress",
                    question_id=question_id,
                    metadata_json={"algorithm_version": "simple_v1"},
                    next_review_at=today_end_utc(),
                    reason="manual_add",
                )
            )
            session.commit()

        dashboard = client.get("/api/v2/dashboard/today/review")
        assert dashboard.status_code == 200, dashboard.text
        assert dashboard.json()["total"] == 1

        detail = client.get(f"/api/v2/review/items/{dashboard.json()['items'][0]['id']}")
        assert detail.status_code == 200, detail.text
        assert detail.json()["srsState"]["isDueToday"] is True
        assert detail.json()["srsState"]["intervalDays"] == 1


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_review_graduate_detects_version_conflict(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client, email="cas@example.com", display_name="Cas Owner")
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-CRUD-CAS",
            title="Review CRUD CAS",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "CAS item",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )[0]
        created = client.post("/api/v2/review/items", json={"questionId": question_id})
        assert created.status_code == 200, created.text
        item_id = created.json()["id"]

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session_a:
            owner = session_a.scalar(select(UserV2).where(UserV2.display_name == "Cas Owner"))
            assert owner is not None
            stale_row = session_a.get(ReviewItemV2, item_id)
            assert stale_row is not None

            with factory() as session_b:
                fresh_row = session_b.get(ReviewItemV2, item_id)
                assert fresh_row is not None
                fresh_row.version += 1
                session_b.add(fresh_row)
                session_b.commit()

            with pytest.raises(ConflictError) as excinfo:
                graduate_review_item(session_a, user=owner, item_id=item_id)
            assert excinfo.value.code == "review_item_optimistic_lock"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_probationary_without_next_review_is_not_due_today_in_detail(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client, email="probation@example.com", display_name="Probation User")
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-CRUD-PROB",
            title="Review CRUD Probationary",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Probationary stale row",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )[0]
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            row = ReviewItemV2(
                user_id=user_id,
                source_kind="re_failed",
                source_id=question_id,
                title="Probationary stale row",
                status="probationary",
                question_id=question_id,
                metadata_json={"algorithm_version": "simple_v1"},
                correct_streak=4,
                next_review_at=None,
            )
            session.add(row)
            session.commit()
            item_id = row.id

        detail = client.get(f"/api/v2/review/items/{item_id}")
        assert detail.status_code == 200, detail.text
        assert detail.json()["srsState"]["isDueToday"] is False
