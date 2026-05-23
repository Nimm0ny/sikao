from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
import os
from pathlib import Path
from typing import Any, cast
from uuid import uuid4

import pytest
from starlette.requests import Request

from _helpers.essay_grading_route_v2_support import (
    fake_reference_archived,
    fake_reference_success,
    seed_essay_question,
    seed_reference_answer,
)
from _helpers.practice_content_support import build_postgres_client, register_user
from sikao_api.db.models_v2 import EssayReferenceAnswerV2
from sikao_api.modules.essay_grading.application.reference_generator_runner import (
    generate_reference_answer_for_question,
)
from sikao_api.modules.essay_grading.interface.routes import identifier_by_user_id
from sikao_api.modules.llm.application.reference_answer_generator import ReferenceAnswerTrace


def test_identifier_by_user_id_prefers_v2_auth_context() -> None:
    request = Request(
        {
            "type": "http",
            "headers": [],
            "client": ("127.0.0.1", 8000),
            "state": {},
        }
    )
    request.state.current_user_v2_id = 42
    assert asyncio.run(identifier_by_user_id(request)) == "user:42"


def test_identifier_by_user_id_falls_back_to_ip() -> None:
    request = Request(
        {
            "type": "http",
            "headers": [],
            "client": ("203.0.113.8", 8000),
            "state": {},
        }
    )
    assert asyncio.run(identifier_by_user_id(request)) == "ip:203.0.113.8"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_reference_generate_archived_result_stays_hidden(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with build_postgres_client(tmp_path) as client:
        async def reference_archived(*args: Any, **kwargs: Any) -> ReferenceAnswerTrace:
            return await fake_reference_archived(*args, **kwargs)

        register_user(client)
        question_id = seed_essay_question(client, paper_code="ESSAY-REF-004")
        monkeypatch.setattr(
            "sikao_api.modules.essay_grading.application.reference_generator_runner.HomeLlmService.generate_reference_answer",
            reference_archived,
        )
        queued = client.post(
            "/api/v2/practice/essay/reference-answers/generate",
            headers={"Idempotency-Key": str(uuid4())},
            json={"questionId": question_id},
        )
        assert queued.status_code == 200, queued.text
        assert queued.json()["status"] == "queued"

        listed = client.get(
            f"/api/v2/practice/essay/questions/{question_id}/reference-answers"
        )
        assert listed.status_code == 200, listed.text
        assert listed.json() == []

        exists = client.post(
            "/api/v2/practice/essay/reference-answers/generate",
            headers={"Idempotency-Key": str(uuid4())},
            json={"questionId": question_id},
        )
        assert exists.status_code == 200, exists.text
        assert exists.json()["status"] == "exists"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_reference_feedback_hidden_rows_are_not_mutable(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_id = seed_essay_question(client, paper_code="ESSAY-REF-005")
        archived_id = seed_reference_answer(
            client,
            question_id=question_id,
            source="ai_generated",
            status="archived",
            quality_score=5.0,
            content="Archived AI",
        )
        response = client.post(
            f"/api/v2/practice/essay/reference-answers/{archived_id}/like"
        )
        assert response.status_code == 404, response.text
        assert response.json()["code"] == "reference_answer_not_found"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_reference_feedback_delete_missing_404(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_id = seed_essay_question(client, paper_code="ESSAY-REF-006")
        reference_id = seed_reference_answer(
            client,
            question_id=question_id,
            source="official",
            status="public",
            quality_score=5.0,
            content="Official public",
        )
        response = client.delete(
            f"/api/v2/practice/essay/reference-answers/{reference_id}/favorite"
        )
        assert response.status_code == 404, response.text
        assert response.json()["code"] == "reference_feedback_not_found"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_reference_generation_runner_deduplicates_concurrent_ai_writes(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with build_postgres_client(tmp_path) as client:
        async def delayed_reference_success(*args: Any, **kwargs: Any) -> ReferenceAnswerTrace:
            await asyncio.sleep(0.05)
            return await fake_reference_success(*args, **kwargs)

        user_id = register_user(client)
        question_id = seed_essay_question(client, paper_code="ESSAY-REF-008")
        monkeypatch.setattr(
            "sikao_api.modules.essay_grading.application.reference_generator_runner.HomeLlmService.generate_reference_answer",
            delayed_reference_success,
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        settings = app.state.settings

        def run_once() -> int | None:
            session = factory()
            try:
                row = asyncio.run(
                    generate_reference_answer_for_question(
                        session=session,
                        settings=settings,
                        user_id=user_id,
                        question_id=question_id,
                        actor_type="system",
                        actor_id="reference-concurrency-test",
                        action="reference.generate.auto",
                        request_id=None,
                    )
                )
                session.commit()
                return None if row is None else int(row.id)
            finally:
                session.close()

        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [executor.submit(run_once), executor.submit(run_once)]
            results = [future.result() for future in futures]

        assert sum(result is not None for result in results) == 1

        with factory() as session:
            rows = list(
                session.query(EssayReferenceAnswerV2)
                .filter_by(question_id=question_id, source="ai_generated")
                .order_by(EssayReferenceAnswerV2.id.asc())
            )
            assert len(rows) == 1
