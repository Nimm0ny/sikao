from __future__ import annotations

import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

import pytest
from fastapi.testclient import TestClient

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import PracticeSessionAnswerV2, ReviewItemV2
from sikao_api.modules.review.application.hooks import run_review_submit_hooks


def _review_rows(client: TestClient) -> list[ReviewItemV2]:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        rows = list(session.query(ReviewItemV2).order_by(ReviewItemV2.id.asc()))
        for row in rows:
            session.expunge(row)
        return rows


def _answer_rows(client: TestClient) -> list[PracticeSessionAnswerV2]:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        rows = list(session.query(PracticeSessionAnswerV2).order_by(PracticeSessionAnswerV2.id.asc()))
        for row in rows:
            session.expunge(row)
        return rows


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_submit_wrong_answer_creates_pending_review_queue_row(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        seed_paper(
            client,
            paper_code="XC-REVIEW-QUEUE-001",
            title="Review Queue Source",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Queue me on wrong answer",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                    "correct_answer": "B",
                    "options": ["A", "B", "C", "D"],
                }
            ],
        )

        created = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": "paper",
                "paperCode": "XC-REVIEW-QUEUE-001",
                "practiceMode": "full_set",
            },
        )
        assert created.status_code == 200, created.text
        session_id = created.json()["id"]
        answer_key = created.json()["items"][0]["questionKey"]

        saved = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={"answers": [{"questionKey": answer_key, "answer": {"selected": ["A"]}}]},
        )
        assert saved.status_code == 200, saved.text
        submitted = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        assert submitted.status_code == 200, submitted.text

        answers = _answer_rows(client)
        assert len(answers) == 1
        assert answers[0].is_correct is False

        reviews = _review_rows(client)
        wrong_rows = [row for row in reviews if row.source_kind == "wrong_answer"]
        assert len(wrong_rows) == 1
        assert wrong_rows[0].status == "pending"
        assert wrong_rows[0].reason == "wrong_answer"
        assert wrong_rows[0].source_id == session_id
        assert wrong_rows[0].metadata_json["sourceSessionId"] == session_id


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_submit_wrong_answer_on_graduated_question_creates_re_failed_row(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-QUEUE-002",
            title="Review Queue Refailed",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Graduate then fail",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                    "correct_answer": "D",
                    "options": ["A", "B", "C", "D"],
                }
            ],
        )[0]

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            session.add(
                ReviewItemV2(
                    user_id=user_id,
                    source_kind="wrong_answer",
                    source_id=9001,
                    title="Graduate then fail",
                    status="graduated",
                    question_id=question_id,
                    metadata_json={"graduatedAt": datetime.now(UTC).replace(tzinfo=None).isoformat()},
                    reason="wrong_answer",
                )
            )
            session.commit()

        created = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": "paper",
                "paperCode": "XC-REVIEW-QUEUE-002",
                "practiceMode": "full_set",
            },
        )
        assert created.status_code == 200, created.text
        session_id = created.json()["id"]
        answer_key = created.json()["items"][0]["questionKey"]

        saved = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={"answers": [{"questionKey": answer_key, "answer": {"selected": ["A"]}}]},
        )
        assert saved.status_code == 200, saved.text
        submitted = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        assert submitted.status_code == 200, submitted.text

        reviews = _review_rows(client)
        wrong_rows = [row for row in reviews if row.source_kind == "wrong_answer" and row.status == "pending"]
        re_failed_rows = [row for row in reviews if row.source_kind == "re_failed" and row.status == "pending"]
        graduated_rows = [row for row in reviews if row.status == "graduated"]

        assert len(graduated_rows) == 1
        assert len(wrong_rows) == 1
        assert len(re_failed_rows) == 1
        assert re_failed_rows[0].reason is None
        assert re_failed_rows[0].source_id == session_id
        assert re_failed_rows[0].metadata_json["originalReviewItemId"] == graduated_rows[0].id
        assert re_failed_rows[0].metadata_json["triggeredFromStatus"] == "graduated"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_wrong_answer_hook_replay_does_not_duplicate_by_session_id(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-REVIEW-QUEUE-003",
            title="Review Queue Replay",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Replay once only",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                    "correct_answer": "C",
                    "options": ["A", "B", "C", "D"],
                }
            ],
        )

        created = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": "paper",
                "paperCode": "XC-REVIEW-QUEUE-003",
                "practiceMode": "full_set",
            },
        )
        assert created.status_code == 200, created.text
        session_id = created.json()["id"]
        answer_key = created.json()["items"][0]["questionKey"]

        saved = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={"answers": [{"questionKey": answer_key, "answer": {"selected": ["A"]}}]},
        )
        assert saved.status_code == 200, saved.text
        submitted = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        assert submitted.status_code == 200, submitted.text

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            row = (
                session.query(ReviewItemV2)
                .filter_by(source_kind="wrong_answer", source_id=session_id)
                .one()
            )
            row.status = "archived"
            session.add(row)
            session.commit()

        with factory() as session:
            run_review_submit_hooks(session, user_id=user_id, session_id=session_id)
            session.commit()

        reviews = _review_rows(client)
        wrong_rows = [row for row in reviews if row.source_kind == "wrong_answer" and row.source_id == session_id]
        assert len(wrong_rows) == 1


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_submit_correctness_prefers_canonical_correct_answer_field(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        seed_paper(
            client,
            paper_code="XC-REVIEW-QUEUE-004",
            title="Review Queue Canonical Answer",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Prefer canonical answer field",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                    "content_json": {
                        "stem": "Prefer canonical answer field",
                        "answerText": "A",
                        "correct_answer": "B",
                    },
                    "options": ["A", "B", "C", "D"],
                }
            ],
        )

        created = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": "paper",
                "paperCode": "XC-REVIEW-QUEUE-004",
                "practiceMode": "full_set",
            },
        )
        assert created.status_code == 200, created.text
        session_id = created.json()["id"]
        answer_key = created.json()["items"][0]["questionKey"]

        saved = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={"answers": [{"questionKey": answer_key, "answer": {"selected": ["B"]}}]},
        )
        assert saved.status_code == 200, saved.text
        submitted = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        assert submitted.status_code == 200, submitted.text

        answers = _answer_rows(client)
        assert len(answers) == 1
        assert answers[0].is_correct is True
        assert _review_rows(client) == []
