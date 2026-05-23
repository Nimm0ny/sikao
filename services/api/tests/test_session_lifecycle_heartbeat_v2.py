from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

from fastapi.testclient import TestClient

from _helpers.practice_content_support import build_client, register_user
from sikao_api.db.models_v2 import PracticeSessionV2


def _seed_session(
    client: TestClient,
    *,
    user_id: int,
    status: str,
    paused_at: datetime | None = None,
    last_heartbeat_at: datetime | None = None,
) -> int:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        row = PracticeSessionV2(
            user_id=user_id,
            track="xingce",
            entry_kind="paper",
            status=status,
            payload_json={},
            started_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=1),
            paused_at=paused_at,
            last_heartbeat_at=last_heartbeat_at,
        )
        session.add(row)
        session.commit()
        return row.id


def test_heartbeat_wakes_paused_and_records_question_pointer(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        paused_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=5)
        session_id = _seed_session(client, user_id=user_id, status="paused", paused_at=paused_at)
        response = client.post(
            f"/api/v2/practice/sessions/{session_id}/heartbeat",
            json={"currentQuestionId": 123},
        )
        assert response.status_code == 200, response.text
        assert response.json()["status"] == "in_progress"
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            row = session.get(PracticeSessionV2, session_id)
            assert row is not None
            assert row.status == "in_progress"
            assert row.paused_at is None
            assert row.paused_total_seconds >= 300
            assert row.last_heartbeat_at is not None
            assert row.config_snapshot["last_seen_question_id"] == 123


def test_heartbeat_keeps_draft_and_terminal_read_only(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        draft_id = _seed_session(client, user_id=user_id, status="draft")
        draft_response = client.post(f"/api/v2/practice/sessions/{draft_id}/heartbeat", json={})
        assert draft_response.status_code == 200, draft_response.text
        assert draft_response.json()["status"] == "draft"

        terminal_id = _seed_session(
            client,
            user_id=user_id,
            status="submitted",
            last_heartbeat_at=datetime(2026, 5, 23, 8, 0, 0),
        )
        terminal_response = client.post(f"/api/v2/practice/sessions/{terminal_id}/heartbeat", json={})
        assert terminal_response.status_code == 200, terminal_response.text
        assert terminal_response.json()["status"] == "submitted"
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            draft = session.get(PracticeSessionV2, draft_id)
            terminal = session.get(PracticeSessionV2, terminal_id)
            assert draft is not None and draft.status == "draft" and draft.last_heartbeat_at is not None
            assert terminal is not None and terminal.last_heartbeat_at == datetime(2026, 5, 23, 8, 0, 0)
