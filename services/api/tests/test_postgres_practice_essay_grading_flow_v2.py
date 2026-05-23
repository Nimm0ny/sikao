from __future__ import annotations

import os
from pathlib import Path
from typing import Any, cast
from uuid import uuid4

import pytest

from _helpers.essay_grading_route_v2_support import (
    create_and_submit_essay_session,
    fake_grade_failure,
    fake_grade_success,
    seed_essay_question,
)
from _helpers.practice_content_support import build_postgres_client, register_user
from sikao_api.db.models_v2 import AuditLogV2, EssayReportV2, EssaySubmissionV2
from sikao_api.modules.llm.application.essay_grader import EssayGradingTrace


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_practice_essay_grading_roundtrip(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with build_postgres_client(tmp_path) as client:
        grade_calls = {"count": 0}

        async def counting_success(*args: Any, **kwargs: Any) -> EssayGradingTrace:
            grade_calls["count"] += 1
            return await fake_grade_success(*args, **kwargs)

        user_id = register_user(client)
        question_id = seed_essay_question(client, paper_code="ESSAY-B20-001")
        session_id = create_and_submit_essay_session(
            client,
            paper_code="ESSAY-B20-001",
            answer_text="这是申论作答正文。" * 80,
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            submission = session.query(EssaySubmissionV2).filter_by(
                practice_session_id=session_id
            ).one()
            assert submission.user_id == user_id
            assert submission.question_id == question_id
            assert submission.status == "submitted"
            submission_id = int(submission.id)

        pre_status = client.get(
            f"/api/v2/practice/essay/submissions/{submission_id}/grading-status"
        )
        assert pre_status.status_code == 200, pre_status.text
        assert pre_status.json()["status"] == "submitted"

        monkeypatch.setattr(
            "sikao_api.modules.essay_grading.application.background_grader.HomeLlmService.grade_essay",
            counting_success,
        )

        trigger = client.post(
            f"/api/v2/practice/essay/submissions/{submission_id}/grade",
            headers={"Idempotency-Key": str(uuid4())},
        )
        assert trigger.status_code == 200, trigger.text
        assert trigger.json()["status"] == "pending_grading"

        status = client.get(
            f"/api/v2/practice/essay/submissions/{submission_id}/grading-status"
        )
        assert status.status_code == 200, status.text
        assert status.json()["status"] == "graded"

        result = client.get(
            f"/api/v2/practice/essay/submissions/{submission_id}/result"
        )
        assert result.status_code == 200, result.text
        body = result.json()
        assert body["status"] == "graded"
        assert body["report"]["totalScore"] == 77.0
        assert body["report"]["llmCallId"] > 0
        assert len(body["report"]["dimensions"]) == 5
        assert len(body["referenceAnswers"]) == 1
        assert body["referenceAnswers"][0]["source"] == "ai_generated"
        assert body["referenceAnswers"][0]["status"] == "public"
        assert grade_calls["count"] == 1

        replay = client.post(
            f"/api/v2/practice/essay/submissions/{submission_id}/grade",
            headers={"Idempotency-Key": str(uuid4())},
        )
        assert replay.status_code == 200, replay.text
        assert replay.json()["status"] == "graded"
        assert grade_calls["count"] == 1

        with factory() as session:
            submission = session.get(EssaySubmissionV2, submission_id)
            report = session.query(EssayReportV2).filter_by(
                submission_id=submission_id
            ).one()
            audits = list(
                session.query(AuditLogV2)
                .filter(AuditLogV2.action == "reference.generate.auto")
                .order_by(AuditLogV2.id.asc())
            )
            assert submission is not None
            assert submission.status == "graded"
            assert report.status == "completed"
            assert float(report.score or 0) == pytest.approx(77.0)
            assert len(audits) == 1


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_practice_essay_grading_failed_then_retry(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with build_postgres_client(tmp_path) as client:
        grade_calls = {"count": 0}

        async def counting_failure(*args: Any, **kwargs: Any) -> EssayGradingTrace:
            grade_calls["count"] += 1
            return await fake_grade_failure(*args, **kwargs)

        async def counting_success(*args: Any, **kwargs: Any) -> EssayGradingTrace:
            grade_calls["count"] += 1
            return await fake_grade_success(*args, **kwargs)

        register_user(client)
        seed_essay_question(client, paper_code="ESSAY-B20-002")
        session_id = create_and_submit_essay_session(
            client,
            paper_code="ESSAY-B20-002",
            answer_text="这是申论作答正文。" * 80,
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            submission = session.query(EssaySubmissionV2).filter_by(
                practice_session_id=session_id
            ).one()
            submission_id = int(submission.id)

        monkeypatch.setattr(
            "sikao_api.modules.essay_grading.application.background_grader.HomeLlmService.grade_essay",
            counting_failure,
        )
        first = client.post(
            f"/api/v2/practice/essay/submissions/{submission_id}/grade",
            headers={"Idempotency-Key": str(uuid4())},
        )
        assert first.status_code == 200, first.text
        assert first.json()["status"] == "pending_grading"

        failed = client.get(
            f"/api/v2/practice/essay/submissions/{submission_id}/grading-status"
        )
        assert failed.status_code == 200, failed.text
        assert failed.json()["status"] == "failed"
        assert "LLMServiceError" in failed.json()["errorMessage"]
        assert grade_calls["count"] == 1

        monkeypatch.setattr(
            "sikao_api.modules.essay_grading.application.background_grader.HomeLlmService.grade_essay",
            counting_success,
        )
        second = client.post(
            f"/api/v2/practice/essay/submissions/{submission_id}/grade",
            headers={"Idempotency-Key": str(uuid4())},
        )
        assert second.status_code == 200, second.text
        assert second.json()["status"] == "pending_grading"

        graded = client.get(
            f"/api/v2/practice/essay/submissions/{submission_id}/grading-status"
        )
        assert graded.status_code == 200, graded.text
        assert graded.json()["status"] == "graded"
        assert graded.json()["report"]["totalScore"] == 77.0
        assert grade_calls["count"] == 2
