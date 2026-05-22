from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from typing import Any, cast

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user
from sikao_api.db.models_v2 import AuditLogV2, PracticeSessionAnswerV2, PracticeSessionV2


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_session_lifecycle_queries(tmp_path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        now = datetime.now(UTC).replace(tzinfo=None)
        with factory() as session:
            paused = PracticeSessionV2(user_id=user_id, track="xingce", entry_kind="paper", status="paused", payload_json={}, started_at=now - timedelta(hours=2), last_activity_at=now - timedelta(minutes=5), paused_at=now - timedelta(minutes=5))
            session.add(paused)
            session.flush()
            session.add(PracticeSessionAnswerV2(session_id=paused.id, question_key="q-1", display_order=1, response_json={"selected": ["A"]}))
            session.add(
                AuditLogV2(
                    user_id=user_id,
                    actor_type="user",
                    actor_id="test",
                    action="session.pause",
                    target_type="practice_session_v2",
                    target_id=paused.id,
                    before={"status": "in_progress"},
                    after={"status": "paused"},
                    metadata_json={"trigger": "user_pause"},
                )
            )
            session.add(
                AuditLogV2(
                    user_id=0,
                    actor_type="cron",
                    actor_id="test-cron",
                    action="session.timeout_pause",
                    target_type="practice_session_v2",
                    target_id=paused.id,
                    before={"status": "draft"},
                    after={"status": "in_progress"},
                    metadata_json="bad-metadata",  # type: ignore[arg-type]
                )
            )
            session.commit()
            paused_id = paused.id

        active = client.get("/api/v2/practice/sessions/active")
        assert active.status_code == 200, active.text
        assert active.json()["count"] == 1
        assert active.json()["sessions"][0]["status"] == "paused"
        assert active.json()["sessions"][0]["progress"] == {"answered": 1, "total": 1}

        lifecycle = client.get(f"/api/v2/practice/sessions/{paused_id}/lifecycle")
        assert lifecycle.status_code == 200, lifecycle.text
        triggers = [item["trigger"] for item in lifecycle.json()["transitions"]]
        assert "user_pause" in triggers
        assert "session.timeout_pause" in triggers
