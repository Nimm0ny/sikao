from __future__ import annotations

import os
from datetime import timedelta
from pathlib import Path
from typing import Any, cast

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import PracticeSessionV2
from sikao_api.modules.mock_exam.application.auto_submitter import auto_submit_expired_mock_exams


def _mock_questions() -> list[dict[str, Any]]:
    return [
        {
            "prompt": f"Question {index}",
            "year": 2024,
            "region": "beijing",
            "exam_type": "provincial",
            "category_l1": "verbal",
            "category_l2": "logic_fill",
        }
        for index in range(1, 31)
    ]


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_mock_exam_force_submitter(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-MOCK-FORCE-PG-001",
            title="Force PG",
            subject_kind="xingce",
            questions=_mock_questions(),
        )
        created = client.post(
            "/api/v2/practice/mock-exams",
            json={"paperCode": "XC-MOCK-FORCE-PG-001"},
            headers={"Idempotency-Key": "mock-create-force-pg-1"},
        )
        assert created.status_code == 201, created.text
        session_id = created.json()["sessionId"]
        started = client.post(f"/api/v2/practice/sessions/{session_id}/start")
        assert started.status_code == 200, started.text

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            practice_session = session.get(PracticeSessionV2, session_id)
            assert practice_session is not None
            assert practice_session.auto_submit_at is not None
            expired_now = practice_session.auto_submit_at + timedelta(seconds=1)
            practice_session.status = "paused"
            practice_session.paused_at = practice_session.auto_submit_at - timedelta(minutes=1)
            session.add(practice_session)
            session.commit()

        with factory() as session:
            submitted = auto_submit_expired_mock_exams(session, now=expired_now)
            session.commit()
            assert submitted == [(user_id, session_id)]
            practice_session = session.get(PracticeSessionV2, session_id)
            assert practice_session is not None
            assert practice_session.status == "submitted"
            assert practice_session.force_submitted is True
            assert practice_session.force_submitted_reason == "mock_exam_timeout"
