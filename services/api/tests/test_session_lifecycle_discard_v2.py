from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

from _helpers.practice_content_support import build_client, register_user
from sikao_api.db.models_v2 import AuditLogV2, PracticeSessionV2


def _seed_session(client, *, user_id: int, status: str) -> int:
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
        )
        session.add(row)
        session.commit()
        return row.id


def test_session_discard_marks_abandoned_and_audits_reason(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        session_id = _seed_session(client, user_id=user_id, status="in_progress")

        discarded = client.post(
            f"/api/v2/practice/sessions/{session_id}/discard",
            json={"reason": "user_discard"},
        )
        assert discarded.status_code == 200, discarded.text
        assert discarded.json()["status"] == "abandoned"
        assert discarded.json()["abandonedReason"] == "user_discard"

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            audit = session.query(AuditLogV2).filter_by(target_type="practice_session_v2", target_id=session_id).one()
            assert audit.metadata_json["trigger"] == "user_discard"
            assert audit.metadata_json["reason"] == "user_discard"
