from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from typing import Any, cast

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user
from sikao_api.db.models_v2 import AuditLogV2, PracticeSessionV2
from sikao_api.modules.session_lifecycle.application.transition_support import apply_transition
from sikao_api.modules.system.application.errors import ConflictError


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_session_lifecycle_write_routes(tmp_path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            row = PracticeSessionV2(
                user_id=user_id,
                track="xingce",
                entry_kind="paper",
                status="draft",
                payload_json={},
                started_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=1),
            )
            session.add(row)
            session.commit()
            session_id = row.id

        started = client.post(f"/api/v2/practice/sessions/{session_id}/start")
        assert started.status_code == 200, started.text
        paused = client.post(f"/api/v2/practice/sessions/{session_id}/pause")
        assert paused.status_code == 200, paused.text
        resumed = client.post(f"/api/v2/practice/sessions/{session_id}/resume")
        assert resumed.status_code == 200, resumed.text
        discarded = client.post(f"/api/v2/practice/sessions/{session_id}/discard", json={"reason": "user_discard"})
        assert discarded.status_code == 200, discarded.text

        with factory() as session:
            audit_actions = [row.metadata_json.get("trigger") for row in session.query(AuditLogV2).filter_by(target_type="practice_session_v2", target_id=session_id).order_by(AuditLogV2.id.asc())]
            assert audit_actions == ["user_start", "user_pause", "user_resume", "user_discard"]


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_lifecycle_transition_reloads_terminal_state_before_write(tmp_path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client, email="lifecycle-race@example.com", display_name="Lifecycle Race")
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            row = PracticeSessionV2(
                user_id=user_id,
                track="xingce",
                entry_kind="paper",
                status="paused",
                payload_json={},
                started_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=1),
                paused_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=5),
            )
            session.add(row)
            session.commit()
            session_id = row.id

        with factory() as request_session:
            stale = request_session.get(PracticeSessionV2, session_id)
            assert stale is not None
            with factory() as rival_session:
                rival = rival_session.get(PracticeSessionV2, session_id)
                assert rival is not None
                rival.status = "submitted"
                rival.paused_at = None
                rival.submitted_at = datetime.now(UTC).replace(tzinfo=None)
                rival_session.add(rival)
                rival_session.commit()

            with pytest.raises(ConflictError) as exc_info:
                apply_transition(
                    request_session,
                    practice_session=stale,
                    trigger="user_resume",
                    actor="user",
                    actor_id=str(user_id),
                    request_id=None,
                )
            assert exc_info.value.code == "IMMUTABLE_TERMINAL_STATE"
