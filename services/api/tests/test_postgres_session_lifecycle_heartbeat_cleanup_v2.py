from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user
from sikao_api.db.models_v2 import PracticeSessionV2
from sikao_api.modules.session_lifecycle.application.cleanup import cleanup_stale_sessions, expire_daily_sessions


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_session_lifecycle_heartbeat_and_cleanup(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        seeded_at = datetime.now(UTC).replace(tzinfo=None)
        with factory() as session:
            paused = PracticeSessionV2(
                user_id=user_id,
                track="xingce",
                entry_kind="paper",
                status="paused",
                payload_json={},
                started_at=seeded_at - timedelta(hours=1),
                paused_at=seeded_at - timedelta(minutes=5),
            )
            stale_in_progress = PracticeSessionV2(
                user_id=user_id,
                track="xingce",
                entry_kind="paper",
                status="in_progress",
                payload_json={},
                started_at=seeded_at - timedelta(hours=2),
                last_activity_at=seeded_at - timedelta(minutes=31),
            )
            stale_daily = PracticeSessionV2(
                user_id=user_id,
                track="xingce",
                entry_kind="paper",
                status="paused",
                payload_json={},
                started_at=seeded_at - timedelta(hours=3),
                source_mode="daily",
                paused_at=seeded_at - timedelta(hours=1),
                expires_at=seeded_at - timedelta(minutes=1),
            )
            session.add_all([paused, stale_in_progress, stale_daily])
            session.commit()
            paused_id = paused.id
            stale_in_progress_id = stale_in_progress.id
            stale_daily_id = stale_daily.id

        heartbeat = client.post(
            f"/api/v2/practice/sessions/{paused_id}/heartbeat",
            json={"currentQuestionId": 321},
        )
        assert heartbeat.status_code == 200, heartbeat.text
        assert heartbeat.json()["status"] == "in_progress"

        cleanup_now = datetime.now(UTC).replace(tzinfo=None)
        with factory() as session:
            counts = cleanup_stale_sessions(session, now=cleanup_now)
            expired = expire_daily_sessions(session, now=cleanup_now)
            session.commit()
            resumed = session.get(PracticeSessionV2, paused_id)
            stale = session.get(PracticeSessionV2, stale_in_progress_id)
            daily = session.get(PracticeSessionV2, stale_daily_id)
            assert counts == {"paused": 1, "abandoned": 0, "draft_abandoned": 0}
            assert expired == 1
            assert resumed is not None
            assert resumed.status == "in_progress"
            assert resumed.paused_at is None
            assert resumed.config_snapshot["last_seen_question_id"] == 321
            assert stale is not None and stale.status == "paused"
            assert daily is not None and daily.status == "expired"
