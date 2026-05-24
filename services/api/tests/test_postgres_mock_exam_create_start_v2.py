from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import PracticeSessionAnswerV2, PracticeSessionV2


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
def test_postgres_mock_exam_create_start_and_countdown(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        seed_paper(
            client,
            paper_code="XC-MOCK-PG-001",
            title="Mock PG",
            subject_kind="xingce",
            questions=_mock_questions(),
        )
        created = client.post(
            "/api/v2/practice/mock-exams",
            json={"paperCode": "XC-MOCK-PG-001"},
            headers={"Idempotency-Key": "mock-create-pg-1"},
        )
        assert created.status_code == 201, created.text
        session_id = created.json()["sessionId"]

        blocked_answer = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={"answers": [{"questionKey": "1", "answer": {"selected": ["A"]}}]},
        )
        assert blocked_answer.status_code == 409, blocked_answer.text
        assert blocked_answer.json()["code"] == "mock_exam_not_started"

        started = client.post(f"/api/v2/practice/sessions/{session_id}/start")
        assert started.status_code == 200, started.text

        blocked_pause = client.post(f"/api/v2/practice/sessions/{session_id}/pause")
        assert blocked_pause.status_code == 422, blocked_pause.text
        assert blocked_pause.json()["code"] == "MOCK_PAUSE_FORBIDDEN"

        countdown = client.get(f"/api/v2/practice/sessions/{session_id}/countdown")
        assert countdown.status_code == 200, countdown.text
        assert 0 <= countdown.json()["elapsedSeconds"] <= 2
        assert 119 * 60 <= countdown.json()["remainingSeconds"] <= 120 * 60

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            practice_session = session.get(PracticeSessionV2, session_id)
            assert practice_session is not None
            assert practice_session.auto_submit_at is not None
            assert practice_session.first_question_at is not None
            assert practice_session.auto_submit_at - practice_session.first_question_at == timedelta(minutes=120)


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_mock_exam_forbids_question_linked_notes(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        seed_paper(
            client,
            paper_code="XC-MOCK-PG-NOTE-001",
            title="Mock PG Note Guard",
            subject_kind="xingce",
            questions=_mock_questions(),
        )
        other_question_id = seed_paper(
            client,
            paper_code="XC-MOCK-PG-NOTE-OTHER-001",
            title="Mock PG Note Guard Other",
            subject_kind="xingce",
            questions=[_mock_questions()[0]],
        )[0]
        created = client.post(
            "/api/v2/practice/mock-exams",
            json={"paperCode": "XC-MOCK-PG-NOTE-001"},
            headers={"Idempotency-Key": "mock-create-pg-note-1"},
        )
        assert created.status_code == 201, created.text

        session_id = created.json()["sessionId"]
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            answer = (
                session.query(PracticeSessionAnswerV2)
                .filter_by(session_id=session_id)
                .order_by(PracticeSessionAnswerV2.display_order.asc())
                .first()
            )
            assert answer is not None

        allowed_note = client.post(
            "/api/v2/notes",
            json={
                "title": "Allowed note",
                "body": "before mock exam starts",
                "linkedQuestionId": other_question_id,
                "visibility": "private",
            },
        )
        assert allowed_note.status_code == 200, allowed_note.text
        note_id = allowed_note.json()["id"]

        started = client.post(f"/api/v2/practice/sessions/{session_id}/start")
        assert started.status_code == 200, started.text

        blocked_note = client.post(
            "/api/v2/notes",
            json={
                "title": "Blocked note",
                "body": "during mock exam",
                "linkedQuestionId": other_question_id,
                "visibility": "private",
            },
        )
        assert blocked_note.status_code == 422, blocked_note.text
        assert blocked_note.json()["code"] == "MOCK_NOTES_FORBIDDEN"

        blocked_update = client.put(
            f"/api/v2/notes/{note_id}",
            json={
                "title": "Allowed note",
                "body": "edited during mock exam",
                "status": "active",
                "linkedQuestionId": other_question_id,
                "visibility": "private",
            },
        )
        assert blocked_update.status_code == 422, blocked_update.text
        assert blocked_update.json()["code"] == "MOCK_NOTES_FORBIDDEN"

        with factory() as session:
            mock_session = session.get(PracticeSessionV2, session_id)
            assert mock_session is not None
            mock_session.status = "paused"
            mock_session.paused_at = datetime.now(UTC).replace(tzinfo=None)
            session.add(mock_session)
            session.commit()

        blocked_while_paused = client.put(
            f"/api/v2/notes/{note_id}",
            json={
                "title": "Allowed note",
                "body": "edited during paused mock exam",
                "status": "active",
                "linkedQuestionId": other_question_id,
                "visibility": "private",
            },
        )
        assert blocked_while_paused.status_code == 422, blocked_while_paused.text
        assert blocked_while_paused.json()["code"] == "MOCK_NOTES_FORBIDDEN"
