from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import pytest
from fastapi.testclient import TestClient

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import PracticeSessionAnswerV2, PracticeSessionV2


def _seed_started_session(client: TestClient, *, paper_code: str) -> tuple[int, int]:
    seed_paper(
        client,
        paper_code=paper_code,
        title="Timing PG",
        subject_kind="xingce",
        questions=[{"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"}],
    )
    created = client.post(
        "/api/v2/practice/sessions",
        json={"track": "xingce", "entryKind": "paper", "paperCode": paper_code},
    )
    assert created.status_code == 200, created.text
    session_id = created.json()["id"]
    answer_id = int(created.json()["items"][0]["id"])
    started = client.post(f"/api/v2/practice/sessions/{session_id}/start")
    assert started.status_code == 200, started.text
    return session_id, answer_id


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_timing_event_recorder_updates_fields(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        session_id, answer_id = _seed_started_session(client, paper_code="XC-TIMING-PG-001")
        base = datetime.now(UTC).replace(tzinfo=None)
        first = client.post(
            f"/api/v2/practice/sessions/{session_id}/timing/events",
            json={
                "events": [
                    {"type": "question_enter", "answerId": answer_id, "ts": base.isoformat()},
                    {"type": "answer_change", "answerId": answer_id, "ts": (base + timedelta(seconds=10)).isoformat(), "from": None, "to": "A"},
                ]
            },
        )
        assert first.status_code == 200, first.text
        second = client.post(
            f"/api/v2/practice/sessions/{session_id}/timing/events",
            json={
                "events": [
                    {"type": "question_leave", "answerId": answer_id, "ts": (base + timedelta(seconds=120)).isoformat()},
                ]
            },
        )
        assert second.status_code == 200, second.text

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            answer = session.get(PracticeSessionAnswerV2, answer_id)
            practice_session = session.get(PracticeSessionV2, session_id)
            assert answer is not None
            assert practice_session is not None
            assert answer.time_spent_ms == 60000
            assert practice_session.total_active_seconds == 60
