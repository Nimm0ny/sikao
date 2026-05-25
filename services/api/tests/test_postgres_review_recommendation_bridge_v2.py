from __future__ import annotations

import os
from pathlib import Path
from typing import Any, cast

import pytest
from sqlalchemy import select

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import PracticeSessionAnswerV2, PracticeSessionV2, RecommendationV2


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_review_add_to_plan_creates_and_reuses_pending_recommendation(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-REC-001",
            title="Review Recommendation",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Review recommendation prompt",
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

        first = client.post(f"/api/v2/review/items/{item_id}/add-to-plan")
        assert first.status_code == 200, first.text
        payload = first.json()
        assert payload["actionType"] == "review_session"
        assert payload["sourceSignals"]["linked_review_id"] == item_id
        assert payload["payload"]["config"]["review_item_ids"] == [item_id]
        assert payload["payload"]["config"]["shuffle_options"] is True

        second = client.post(f"/api/v2/review/items/{item_id}/add-to-plan")
        assert second.status_code == 200, second.text
        assert second.json()["id"] == payload["id"]

        refresh = client.post(
            "/api/v2/recommendations/refresh",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174099"},
        )
        assert refresh.status_code == 200, refresh.text
        refresh_ids = {item["id"] for item in refresh.json()["items"]}
        assert payload["id"] in refresh_ids

        history = client.get("/api/v2/recommendations/today")
        assert history.status_code == 200, history.text
        review_recommendations = [
            item for item in history.json()["items"] if item["actionType"] == "review_session"
        ]
        assert len(review_recommendations) == 1
        assert review_recommendations[0]["id"] == payload["id"]


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_review_recommendation_accept_creates_wrong_redo_session(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="XC-REVIEW-REC-002",
            title="Review Recommendation Accept",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Review recommendation accept prompt",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )
        created = client.post("/api/v2/review/items", json={"questionId": question_ids[0]})
        assert created.status_code == 200, created.text
        item_id = created.json()["id"]

        recommendation = client.post(f"/api/v2/review/items/{item_id}/add-to-plan")
        assert recommendation.status_code == 200, recommendation.text
        recommendation_id = recommendation.json()["id"]

        accepted = client.post(
            f"/api/v2/recommendations/{recommendation_id}/accept",
            json={"action": "session"},
        )
        assert accepted.status_code == 200, accepted.text
        body = accepted.json()
        assert body["status"] == "accepted_session"
        assert body["sessionId"] is not None
        assert body["redirectUrl"] == f"/practice/sessions/{body['sessionId']}"

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            recommendation_row = session.get(RecommendationV2, recommendation_id)
            practice_session = session.get(PracticeSessionV2, body["sessionId"])
            answers = list(
                session.scalars(
                    select(PracticeSessionAnswerV2).where(
                        PracticeSessionAnswerV2.session_id == body["sessionId"]
                    )
                )
            )
            assert recommendation_row is not None
            assert recommendation_row.status == "accepted_session"
            assert practice_session is not None
            assert practice_session.source_mode == "wrong_redo"
            assert practice_session.linked_recommendation_id == recommendation_id
            assert practice_session.config_snapshot["review_item_ids"] == [item_id]
            assert practice_session.config_snapshot["shuffle_options"] is True
            assert len(answers) == 1
            assert answers[0].question_id == question_ids[0]
