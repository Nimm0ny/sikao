from __future__ import annotations

import os
from typing import Any, cast
from uuid import uuid4

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import AiGeneratedQuestionRequestV2, QuestionV2


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_ai_questions_generate_and_session_handoff(tmp_path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        seed_paper(
            client,
            paper_code="XC-AI-GEN-PG-001",
            title="AI Generate PG Source",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Source A",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
                {
                    "prompt": "Source B",
                    "year": 2023,
                    "region": "shanghai",
                    "exam_type": "municipal",
                    "category_l1": "verbal",
                    "category_l2": "reading",
                },
            ],
        )
        response = client.post(
            "/api/v2/practice/ai-questions/generate",
            json={
                "config": {
                    "type": "xingce",
                    "categoryL1": "verbal",
                    "difficultyRange": [0.0, 1.0],
                    "count": 2,
                }
            },
            headers={"Idempotency-Key": str(uuid4())},
        )
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["status"] == "llm_generated"
        assert payload["llmGeneratedCount"] == 2

        detail = client.get(f"/api/v2/practice/ai-questions/requests/{payload['requestId']}")
        assert detail.status_code == 200, detail.text
        assert detail.json()["llmCallId"] is not None

        created_session = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": "ai_questions",
                "mode": "ai_generated",
                "config": {"aiRequestId": payload["requestId"]},
            },
        )
        assert created_session.status_code == 200, created_session.text
        assert created_session.json()["sourceMode"] == "ai_generated"
        assert len(created_session.json()["items"]) == 2

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            request_row = session.get(AiGeneratedQuestionRequestV2, payload["requestId"])
            questions = list(
                session.query(QuestionV2)
                .filter(QuestionV2.id.in_(payload["questionIds"]))
                .order_by(QuestionV2.id.asc())
            )
            assert request_row is not None
            assert request_row.llm_call_id is not None
            assert len(questions) == 2
            assert {question.source for question in questions} == {"ai_generated"}
