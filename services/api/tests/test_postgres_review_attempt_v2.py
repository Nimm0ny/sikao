from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from pathlib import Path
from typing import Any, cast

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import ReviewItemV2, UserV2
from sikao_api.db.schemas_v2 import ReviewAttemptSubmitV2
from sikao_api.modules.review.application.service import submit_review_attempt
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
def test_postgres_review_attempt_correct_records_context_and_hash(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-ATTEMPT-001",
            title="Review Attempt Correct",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Pick the correct option",
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

        attempted = client.post(
            f"/api/v2/review/items/{item_id}/attempt",
            json={
                "isCorrect": True,
                "userAnswer": "B",
                "confidence": "likely",
                "recallText": "I can restate the rule",
            },
        )
        assert attempted.status_code == 200, attempted.text
        payload = attempted.json()
        assert payload["item"]["status"] == "in_progress"
        assert payload["item"]["correctStreak"] == 1
        assert payload["history"][0]["outcome"] == "correct"
        assert payload["history"][0]["notesJson"]["confidence"] == "likely"
        assert payload["history"][0]["notesJson"]["userAnswer"] == "B"
        assert payload["history"][0]["notesJson"]["submittedConfidence"] == "likely"
        assert payload["history"][0]["notesJson"]["effectiveConfidence"] == "likely"
        assert payload["history"][0]["notesJson"]["usedRecall"] is True
        assert payload["history"][0]["notesJson"]["recallText"] == "I can restate the rule"

        rows = _review_rows(client)
        assert len(rows) == 1
        metadata = rows[0].metadata_json
        assert metadata["last_answer_hash"] == sha256(b"B").hexdigest()
        assert metadata["used_recall"] is True
        assert metadata["last_confidence"] == "likely"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_review_attempt_certain_incorrect_marks_mismatch(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-ATTEMPT-002",
            title="Review Attempt Mismatch",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Certain but wrong",
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

        attempted = client.post(
            f"/api/v2/review/items/{item_id}/attempt",
            json={
                "isCorrect": False,
                "userAnswer": "A",
                "confidence": "certain",
                "recallText": None,
            },
        )
        assert attempted.status_code == 200, attempted.text
        payload = attempted.json()
        outcomes = [entry["outcome"] for entry in payload["history"][:3]]
        assert "incorrect" in outcomes
        assert "confidence_mismatch" in outcomes
        assert payload["item"]["status"] == "in_progress"
        assert payload["history"][0]["notesJson"]["confidence"] == "certain"
        assert payload["metadata"]["confidence_mismatch_count"] == 1
        assert payload["metadata"]["forced_cause_analysis_pending"] is True
        assert payload["metadata"]["last_confidence"] == "certain"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_review_attempt_null_confidence_defaults_likely_and_counts_skip(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-ATTEMPT-003",
            title="Review Attempt Skip",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Skip confidence once",
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

        attempted = client.post(
            f"/api/v2/review/items/{item_id}/attempt",
            json={
                "isCorrect": True,
                "userAnswer": "C",
                "confidence": None,
                "recallText": None,
            },
        )
        assert attempted.status_code == 200, attempted.text
        payload = attempted.json()
        assert payload["history"][0]["notesJson"]["confidence"] is None
        assert payload["history"][0]["notesJson"]["confidenceSkipped"] is True
        assert payload["history"][0]["notesJson"]["submittedConfidence"] is None
        assert payload["history"][0]["notesJson"]["effectiveConfidence"] == "likely"
        assert payload["metadata"]["confidence_skipped_count"] == 1
        assert payload["metadata"]["last_confidence"] == "likely"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_probationary_attempt_requires_due_and_failed_creates_re_failed(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-ATTEMPT-004",
            title="Review Attempt Probation",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Probation check question",
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
                    source_kind="wrong_answer",
                    source_id=901,
                    title="Probation check question",
                    status="probationary",
                    question_id=question_id,
                    metadata_json={"algorithm_version": "simple_v1", "debt_status": "ramp_up_protected"},
                    correct_streak=4,
                    next_review_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(days=2),
                    reason="wrong_answer",
                )
            )
            session.commit()

        original_item = _review_rows(client)[0]
        not_due = client.post(
            f"/api/v2/review/items/{original_item.id}/attempt",
            json={
                "isCorrect": False,
                "userAnswer": "D",
                "confidence": "likely",
                "recallText": None,
            },
        )
        assert not_due.status_code == 409, not_due.text
        assert not_due.json()["code"] == "review_item_not_due"

        with factory() as session:
            row = session.get(ReviewItemV2, original_item.id)
            assert row is not None
            row.next_review_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=1)
            session.add(row)
            session.commit()

        attempted = client.post(
            f"/api/v2/review/items/{original_item.id}/attempt",
            json={
                "isCorrect": False,
                "userAnswer": "D",
                "confidence": "likely",
                "recallText": None,
            },
        )
        assert attempted.status_code == 200, attempted.text
        payload = attempted.json()
        assert payload["item"]["status"] == "probationary"
        assert payload["item"]["nextReviewAt"] is None
        assert payload["history"][0]["outcome"] == "probation_failed"
        assert payload["history"][0]["notesJson"]["confidence"] == "likely"
        re_failed_new_item_id = payload["history"][0]["notesJson"]["reFailedNewItemId"]
        assert isinstance(re_failed_new_item_id, int)

        rows = _review_rows(client)
        probationary_rows = [row for row in rows if row.id == original_item.id]
        re_failed_rows = [row for row in rows if row.source_kind == "re_failed"]
        assert len(probationary_rows) == 1
        assert probationary_rows[0].next_review_at is None
        assert probationary_rows[0].metadata_json["probation_failed_at"]
        assert len(re_failed_rows) == 1
        assert re_failed_rows[0].source_id == original_item.id
        assert re_failed_rows[0].metadata_json["originalReviewItemId"] == original_item.id
        assert re_failed_rows[0].metadata_json["fromProbationCheck"] is True


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_review_attempt_rejects_skip_when_confidence_is_forced(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-ATTEMPT-006",
            title="Review Attempt Forced Confidence",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Forced confidence question",
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
                    source_kind="wrong_answer",
                    source_id=902,
                    title="Forced confidence question",
                    status="in_progress",
                    question_id=question_id,
                    metadata_json={"algorithm_version": "simple_v1", "confidence_mismatch_count": 1},
                    correct_streak=1,
                    next_review_at=datetime.now(UTC).replace(tzinfo=None),
                    reason="wrong_answer",
                )
            )
            session.commit()

        item_id = _review_rows(client)[0].id
        attempted = client.post(
            f"/api/v2/review/items/{item_id}/attempt",
            json={
                "isCorrect": True,
                "userAnswer": "A",
                "confidence": None,
                "recallText": None,
            },
        )
        assert attempted.status_code == 409, attempted.text
        assert attempted.json()["code"] == "review_attempt_confidence_required"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_review_attempt_detects_version_conflict(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client, email="attempt-cas@example.com", display_name="Attempt Cas Owner")
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-ATTEMPT-005",
            title="Review Attempt CAS",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "CAS me",
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
            owner = session_a.scalar(select(UserV2).where(UserV2.display_name == "Attempt Cas Owner"))
            assert owner is not None
            stale_row = session_a.get(ReviewItemV2, item_id)
            assert stale_row is not None

            with factory() as session_b:
                fresh_row = session_b.get(ReviewItemV2, item_id)
                assert fresh_row is not None
                fresh_row.version += 1
                session_b.add(fresh_row)
                session_b.commit()

            payload = ReviewAttemptSubmitV2(
                is_correct=True,
                user_answer="B",
                confidence="likely",
                recall_text=None,
            )
            with pytest.raises(ConflictError) as excinfo:
                submit_review_attempt(session_a, user=owner, item_id=item_id, payload=payload)
            assert excinfo.value.code == "review_item_optimistic_lock"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_review_attempt_rejects_skip_after_repeated_confidence_skips(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-ATTEMPT-007",
            title="Review Attempt Skip Threshold",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Skip threshold question",
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
                    source_kind="wrong_answer",
                    source_id=903,
                    title="Skip threshold question",
                    status="in_progress",
                    question_id=question_id,
                    metadata_json={"algorithm_version": "simple_v1", "confidence_skipped_count": 5},
                    correct_streak=1,
                    next_review_at=datetime.now(UTC).replace(tzinfo=None),
                    reason="wrong_answer",
                )
            )
            session.commit()

        item_id = _review_rows(client)[0].id
        attempted = client.post(
            f"/api/v2/review/items/{item_id}/attempt",
            json={
                "isCorrect": True,
                "userAnswer": "A",
                "confidence": None,
                "recallText": None,
            },
        )
        assert attempted.status_code == 409, attempted.text
        assert attempted.json()["code"] == "review_attempt_confidence_required"
