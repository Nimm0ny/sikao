from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import pytest
from sqlalchemy import select

from _helpers.practice_content_support import (
    build_postgres_client,
    register_user,
    seed_completed_session,
    seed_paper,
)
from sikao_api.db.models_v2 import PracticeSessionAnswerV2


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_practice_answers_feed_returns_recent_answers_for_current_user(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(
            client,
            email="practice-answer-feed@example.com",
            display_name="Practice Answer Feed",
        )
        seed_paper(
            client,
            paper_code="XC-PRACTICE-ANSWERS",
            title="Practice Answers",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Question 1",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
                {
                    "prompt": "Question 2",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
            ],
        )
        seed_completed_session(
            client,
            user_id=user_id,
            paper_code="XC-PRACTICE-ANSWERS",
            answer_outcomes=[False, True],
            submitted_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=1),
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            rows = list(
                session.scalars(
                    select(PracticeSessionAnswerV2)
                    .order_by(PracticeSessionAnswerV2.id.asc())
                )
            )
            assert len(rows) == 2
            rows[0].duration_seconds = 31
            rows[1].duration_seconds = 42
            session.add_all(rows)
            session.commit()

        response = client.get(
            "/api/v2/practice/answers",
            params={"limit": 10, "include_confidence": True, "include_duration": True},
        )
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["total"] == 2
        assert payload["limit"] == 10
        assert [item["questionId"] for item in payload["items"]] == [2, 1]
        assert payload["items"][0]["sessionId"] > 0
        assert payload["items"][0]["isCorrect"] is True
        assert payload["items"][0]["confidence"] is None
        assert payload["items"][0]["durationSeconds"] == 42


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_practice_answers_feed_enforces_limit_and_omits_duration_when_not_requested(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        first_user_id = register_user(
            client,
            email="practice-answer-feed-first@example.com",
            display_name="Practice Answer Feed First",
        )
        seed_paper(
            client,
            paper_code="XC-PRACTICE-ANSWERS-ISOLATION",
            title="Practice Answers Isolation",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Isolation Question 1",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
                {
                    "prompt": "Isolation Question 2",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
            ],
        )
        seed_completed_session(
            client,
            user_id=first_user_id,
            paper_code="XC-PRACTICE-ANSWERS-ISOLATION",
            answer_outcomes=[True, False],
            submitted_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=2),
        )

        response = client.get(
            "/api/v2/practice/answers",
            params={"limit": 1, "include_duration": False},
        )
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["total"] == 2
        assert len(payload["items"]) == 1
        assert payload["items"][0]["durationSeconds"] is None
