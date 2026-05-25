from __future__ import annotations

import os
from pathlib import Path
from typing import Any, cast
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import AuditLogV2, RecommendationFeedbackV2
from sikao_api.modules.review.application.cause_feedback_service import CauseAnalysisFeedbackService
from test_postgres_review_cause_analysis_v2 import _group_payload, _single_payload, _stub_completion


def _feedback_rows(client) -> list[RecommendationFeedbackV2]:  # type: ignore[no-untyped-def]
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        rows = list(session.scalars(select(RecommendationFeedbackV2).order_by(RecommendationFeedbackV2.id.asc())))
        for row in rows:
            session.expunge(row)
        return rows


def _audit_actions(client) -> set[str]:  # type: ignore[no-untyped-def]
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        return {
            row.action
            for row in session.scalars(select(AuditLogV2).order_by(AuditLogV2.id.asc()))
        }


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_single_cause_feedback_persists_dimensions_and_actions(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, Any]] = []
    _stub_completion(
        monkeypatch,
        payload_by_prompt={"cause_analysis_single@v1": _single_payload("feedback single")},
        calls=calls,
    )
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-FEEDBACK-001",
            title="Cause feedback single",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Feedback single question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )[0]
        item_id = client.post("/api/v2/review/items", json={"questionId": question_id}).json()["id"]
        analysis = client.post(
            f"/api/v2/review/items/{item_id}/cause-analysis",
            headers={"Idempotency-Key": str(uuid4())},
            json={"mode": "single"},
        )
        assert analysis.status_code == 200, analysis.text
        analysis_id = analysis.json()["analysisId"]

        feedback = client.post(
            f"/api/v2/review/cause-analysis/{analysis_id}/feedback",
            json={
                "rating": "down",
                "comment": "I disagree with the tag and the first action.",
                "dimensionsDisagreed": ["concept_confusion"],
                "actionsUnhelpful": [0],
            },
        )
        assert feedback.status_code == 200, feedback.text
        assert feedback.json() == {"ok": True, "status": "stored"}

        rows = _feedback_rows(client)
        assert len(rows) == 1
        row = rows[0]
        assert row.feedback_type == "cause_analysis_single"
        assert row.analysis_id == analysis_id
        assert row.recommendation_id is None
        assert row.rating == "down"
        assert row.reason == "user_feedback"
        assert row.note == "I disagree with the tag and the first action."
        assert row.metadata_json["rating"] == "down"
        assert row.metadata_json["comment"] == "I disagree with the tag and the first action."
        assert row.metadata_json["dimensions_disagreed"] == ["concept_confusion"]
        assert row.metadata_json["actions_unhelpful"] == [0]
        assert "review.cause_analysis.feedback_submitted" in _audit_actions(client)


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_group_cause_feedback_up_vote_is_stored(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, Any]] = []
    _stub_completion(
        monkeypatch,
        payload_by_prompt={"cause_analysis_group@v1": _group_payload("feedback group")},
        calls=calls,
    )
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="XC-REVIEW-FEEDBACK-002",
            title="Cause feedback group",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Feedback group one",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
                {
                    "prompt": "Feedback group two",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
            ],
        )
        first_item = client.post("/api/v2/review/items", json={"questionId": question_ids[0]}).json()["id"]
        second_item = client.post("/api/v2/review/items", json={"questionId": question_ids[1]}).json()["id"]
        analysis = client.post(
            "/api/v2/review/cause-analysis/group",
            headers={"Idempotency-Key": str(uuid4())},
            json={"itemIds": [first_item, second_item]},
        )
        assert analysis.status_code == 200, analysis.text
        analysis_id = analysis.json()["analysisId"]

        feedback = client.post(
            f"/api/v2/review/cause-analysis/{analysis_id}/feedback",
            json={
                "rating": "up",
                "comment": "Useful summary.",
                "dimensionsDisagreed": [],
                "actionsUnhelpful": [],
            },
        )
        assert feedback.status_code == 200, feedback.text

        row = _feedback_rows(client)[0]
        assert row.feedback_type == "cause_analysis_group"
        assert row.rating == "up"
        assert row.metadata_json["dimensions_disagreed"] == []
        assert row.metadata_json["actions_unhelpful"] == []


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_cause_feedback_rejects_invalid_slug_and_action_index(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, Any]] = []
    _stub_completion(
        monkeypatch,
        payload_by_prompt={"cause_analysis_single@v1": _single_payload("feedback invalid")},
        calls=calls,
    )
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-FEEDBACK-003",
            title="Cause feedback invalid",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Feedback invalid question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )[0]
        item_id = client.post("/api/v2/review/items", json={"questionId": question_id}).json()["id"]
        analysis = client.post(
            f"/api/v2/review/items/{item_id}/cause-analysis",
            headers={"Idempotency-Key": str(uuid4())},
            json={"mode": "single"},
        )
        assert analysis.status_code == 200, analysis.text
        analysis_id = analysis.json()["analysisId"]

        invalid_slug = client.post(
            f"/api/v2/review/cause-analysis/{analysis_id}/feedback",
            json={
                "rating": "down",
                "comment": "Wrong tag",
                "dimensionsDisagreed": ["not_allowed"],
                "actionsUnhelpful": [],
            },
        )
        assert invalid_slug.status_code == 422, invalid_slug.text
        assert invalid_slug.json()["code"] == "cause_tag_invalid"

        invalid_action = client.post(
            f"/api/v2/review/cause-analysis/{analysis_id}/feedback",
            json={
                "rating": "down",
                "comment": "Wrong action index",
                "dimensionsDisagreed": [],
                "actionsUnhelpful": [4],
            },
        )
        assert invalid_action.status_code == 422, invalid_action.text
        assert invalid_action.json()["code"] == "cause_analysis_feedback_invalid"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_cause_feedback_rejects_negative_payload_on_up_vote(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, Any]] = []
    _stub_completion(
        monkeypatch,
        payload_by_prompt={"cause_analysis_single@v1": _single_payload("feedback up invalid")},
        calls=calls,
    )
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-FEEDBACK-004",
            title="Cause feedback up invalid",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Feedback up invalid question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )[0]
        item_id = client.post("/api/v2/review/items", json={"questionId": question_id}).json()["id"]
        analysis = client.post(
            f"/api/v2/review/items/{item_id}/cause-analysis",
            headers={"Idempotency-Key": str(uuid4())},
            json={"mode": "single"},
        )
        assert analysis.status_code == 200, analysis.text
        analysis_id = analysis.json()["analysisId"]

        invalid = client.post(
            f"/api/v2/review/cause-analysis/{analysis_id}/feedback",
            json={
                "rating": "up",
                "comment": "positive",
                "dimensionsDisagreed": ["concept_confusion"],
                "actionsUnhelpful": [],
            },
        )
        assert invalid.status_code == 422, invalid.text
        assert invalid.json()["code"] == "cause_analysis_feedback_invalid"


