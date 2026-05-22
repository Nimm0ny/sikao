from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

from _helpers.practice_content_support import build_client, register_user
from sikao_api.db.models_v2 import AuditLogV2, PracticeSessionV2


def _seed_session(client, *, user_id: int, status: str, paused_at: datetime | None = None) -> int:
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
        )
        session.add(row)
        session.commit()
        return row.id


def test_session_start_pause_resume_write_audit_and_timing(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        draft_id = _seed_session(client, user_id=user_id, status="draft")

        started = client.post(f"/api/v2/practice/sessions/{draft_id}/start")
        assert started.status_code == 200, started.text
        assert started.json()["status"] == "inProgress"
        assert started.json()["firstQuestionAt"] is not None

        paused = client.post(f"/api/v2/practice/sessions/{draft_id}/pause")
        assert paused.status_code == 200, paused.text
        assert paused.json()["status"] == "paused"
        assert paused.json()["pausedAt"] is not None

        resumed = client.post(f"/api/v2/practice/sessions/{draft_id}/resume")
        assert resumed.status_code == 200, resumed.text
        assert resumed.json()["status"] == "inProgress"
        assert resumed.json()["pausedTotalSeconds"] >= 0

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            audits = list(session.query(AuditLogV2).filter_by(target_type="practice_session_v2", target_id=draft_id).order_by(AuditLogV2.id.asc()))
            triggers = [audit.metadata_json.get("trigger") for audit in audits]
            assert triggers == ["user_start", "user_pause", "user_resume"]


def test_session_lifecycle_owner_and_transition_guards(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client, email="owner@example.com", display_name="Owner")
        paused_id = _seed_session(
            client,
            user_id=user_id,
            status="paused",
            paused_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=5),
        )

        invalid = client.post(f"/api/v2/practice/sessions/{paused_id}/start")
        assert invalid.status_code == 409, invalid.text
        assert invalid.json()["code"] == "INVALID_TRANSITION"

        register_user(client, email="other@example.com", display_name="Other")
        forbidden = client.post(f"/api/v2/practice/sessions/{paused_id}/resume")
        assert forbidden.status_code == 404, forbidden.text
        assert forbidden.json()["code"] == "practice_session_not_found"
