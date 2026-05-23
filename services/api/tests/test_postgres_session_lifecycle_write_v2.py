from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from typing import Any, cast

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user
from sikao_api.db.models_v2 import AuditLogV2, PracticeSessionV2


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
