from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

from fastapi.testclient import TestClient

from _helpers.practice_content_support import build_client, register_user
from sikao_api.db.models_v2 import AuditLogV2, PracticeSessionAnswerV2, PracticeSessionV2


def _seed_session(
    client: TestClient,
    *,
    user_id: int,
    track: str,
    status: str,
    started_at: datetime,
    last_activity_at: datetime | None,
) -> int:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        row = PracticeSessionV2(
            user_id=user_id,
            track=track,
            entry_kind="paper",
            status=status,
            payload_json={},
            started_at=started_at,
            last_activity_at=last_activity_at,
            paused_at=last_activity_at if status == "paused" else None,
        )
        session.add(row)
        session.flush()
        session.add(
            PracticeSessionAnswerV2(
                session_id=row.id,
                question_key=f"q-{row.id}",
                display_order=1,
                response_json={"selected": ["A"]} if status != "draft" else {},
            )
        )
        session.commit()
        return row.id


def test_session_lifecycle_active_query_and_lifecycle_owner_scope(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client, email="life@example.com", display_name="Lifecycle")
        now = datetime.now(UTC).replace(tzinfo=None)
        paused_id = _seed_session(client, user_id=user_id, track="xingce", status="paused", started_at=now - timedelta(hours=2), last_activity_at=now - timedelta(minutes=5))
        _seed_session(client, user_id=user_id, track="essay", status="draft", started_at=now - timedelta(hours=1), last_activity_at=now - timedelta(minutes=10))
        submitted_id = _seed_session(client, user_id=user_id, track="xingce", status="submitted", started_at=now - timedelta(hours=3), last_activity_at=now - timedelta(minutes=1))

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            session.add(
                AuditLogV2(
                    user_id=user_id,
                    actor_type="user",
                    actor_id="test",
                    action="session.pause",
                    target_type="practice_session_v2",
                    target_id=paused_id,
                    before={"status": "in_progress"},
                    after={"status": "paused"},
                    metadata_json={"trigger": "user_pause", "reason": "manual_pause"},
                )
            )
            session.add(
                AuditLogV2(
                    user_id=0,
                    actor_type="cron",
                    actor_id="test-cron",
                    action="session.timeout_pause",
                    target_type="practice_session_v2",
                    target_id=paused_id,
                    before={"status": "draft"},
                    after={"status": "in_progress"},
                    metadata_json=cast(Any, "bad-metadata"),
                )
            )
            session.commit()

        active = client.get("/api/v2/practice/sessions/active")
        assert active.status_code == 200, active.text
        payload = active.json()
        assert payload["count"] == 2
        assert [item["status"] for item in payload["sessions"]] == ["paused", "draft"]
        assert paused_id in [item["id"] for item in payload["sessions"]]
        assert submitted_id not in [item["id"] for item in payload["sessions"]]
        paused_payload = next(item for item in payload["sessions"] if item["id"] == paused_id)
        draft_payload = next(item for item in payload["sessions"] if item["status"] == "draft")
        assert paused_payload["progress"] == {"answered": 1, "total": 1}
        assert draft_payload["progress"] == {"answered": 0, "total": 1}

        lifecycle = client.get(f"/api/v2/practice/sessions/{paused_id}/lifecycle")
        assert lifecycle.status_code == 200, lifecycle.text
        lifecycle_payload = lifecycle.json()
        assert lifecycle_payload["status"] == "paused"
        assert lifecycle_payload["lastActivityAt"] is not None
        assert lifecycle_payload["pausedCount"] == 0
        triggers = [item["trigger"] for item in lifecycle_payload["transitions"]]
        assert "user_pause" in triggers
        assert "session.timeout_pause" in triggers

        register_user(client, email="other@example.com", display_name="Other")
        forbidden = client.get(f"/api/v2/practice/sessions/{paused_id}/lifecycle")
        assert forbidden.status_code == 404, forbidden.text
        assert forbidden.json()["code"] == "practice_session_not_found"
