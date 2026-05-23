from __future__ import annotations

import os
from pathlib import Path
from typing import Any, cast
from uuid import uuid4

import pytest

from _helpers.essay_grading_route_v2_support import (
    create_and_submit_essay_session,
    fake_grade_success,
    noop_store_replay,
    seed_essay_question,
)
from _helpers.practice_content_support import build_postgres_client, register_user
from sikao_api.db.models_v2 import EssaySubmissionV2


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_practice_essay_grading_cross_user_404(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client, email="essay-a@example.com", display_name="Essay A")
        seed_essay_question(client, paper_code="ESSAY-B20-003")
        session_id = create_and_submit_essay_session(
            client,
            paper_code="ESSAY-B20-003",
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
            fake_grade_success,
        )
        trigger = client.post(
            f"/api/v2/practice/essay/submissions/{submission_id}/grade",
            headers={"Idempotency-Key": str(uuid4())},
        )
        assert trigger.status_code == 200, trigger.text

        client.cookies.clear()
        register_user(client, email="essay-b@example.com", display_name="Essay B")

        response = client.get(
            f"/api/v2/practice/essay/submissions/{submission_id}/grading-status"
        )
        assert response.status_code == 404, response.text
        assert response.json()["code"] == "essay_submission_not_found"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_practice_essay_grading_enqueue_failure_marks_failed_and_retriable(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        seed_essay_question(client, paper_code="ESSAY-B20-004")
        session_id = create_and_submit_essay_session(
            client,
            paper_code="ESSAY-B20-004",
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
            "sikao_api.modules.essay_grading.interface.routes.store_replay",
            lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("boom")),
        )
        with pytest.raises(RuntimeError, match="boom"):
            client.post(
                f"/api/v2/practice/essay/submissions/{submission_id}/grade",
                headers={"Idempotency-Key": str(uuid4())},
            )

        failed = client.get(
            f"/api/v2/practice/essay/submissions/{submission_id}/grading-status"
        )
        assert failed.status_code == 200, failed.text
        assert failed.json()["status"] == "failed"
        assert "trigger enqueue failed" in failed.json()["errorMessage"]

        monkeypatch.setattr(
            "sikao_api.modules.essay_grading.interface.routes.store_replay",
            noop_store_replay,
        )
        monkeypatch.setattr(
            "sikao_api.modules.essay_grading.application.background_grader.HomeLlmService.grade_essay",
            fake_grade_success,
        )
        retry = client.post(
            f"/api/v2/practice/essay/submissions/{submission_id}/grade",
            headers={"Idempotency-Key": str(uuid4())},
        )
        assert retry.status_code == 200, retry.text
        assert retry.json()["status"] == "pending_grading"

        graded = client.get(
            f"/api/v2/practice/essay/submissions/{submission_id}/grading-status"
        )
        assert graded.status_code == 200, graded.text
        assert graded.json()["status"] == "graded"
