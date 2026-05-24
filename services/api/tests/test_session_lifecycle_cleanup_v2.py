from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

from fastapi.testclient import TestClient

from _helpers.practice_content_support import build_client, register_user
from sikao_api.db.models_v2 import PracticeSessionV2
from sikao_api.modules.session_lifecycle.application import cleanup as cleanup_module
from sikao_api.modules.session_lifecycle.application.cleanup import cleanup_stale_sessions, expire_daily_sessions
from sikao_api.modules.system.application.errors import ConflictError


def _seed_session(client: TestClient, **kwargs: Any) -> int:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        row = PracticeSessionV2(payload_json={}, **kwargs)
        session.add(row)
        session.commit()
        return row.id


def test_session_lifecycle_cleanup_and_daily_expire(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        now = datetime.now(UTC).replace(tzinfo=None)
        paused_cutoff = now - timedelta(minutes=31)
        in_progress_id = _seed_session(
            client,
            user_id=user_id,
            track="xingce",
            entry_kind="paper",
            status="in_progress",
            started_at=now - timedelta(hours=2),
            last_heartbeat_at=paused_cutoff,
            exam_mode=False,
        )
        in_progress_without_heartbeat_id = _seed_session(
            client,
            user_id=user_id,
            track="xingce",
            entry_kind="paper",
            status="in_progress",
            started_at=now - timedelta(hours=2),
            last_activity_at=now - timedelta(minutes=31),
            exam_mode=False,
        )
        mixed_anchor_id = _seed_session(
            client,
            user_id=user_id,
            track="xingce",
            entry_kind="paper",
            status="in_progress",
            started_at=now - timedelta(hours=2),
            last_heartbeat_at=now - timedelta(minutes=40),
            last_activity_at=now - timedelta(minutes=31),
            exam_mode=False,
        )
        mock_exam_id = _seed_session(
            client,
            user_id=user_id,
            track="xingce",
            entry_kind="paper",
            status="in_progress",
            started_at=now - timedelta(hours=2),
            last_heartbeat_at=paused_cutoff,
            exam_mode=True,
            time_limit_minutes=120,
        )
        paused_id = _seed_session(
            client,
            user_id=user_id,
            track="xingce",
            entry_kind="paper",
            status="paused",
            started_at=now - timedelta(hours=30),
            paused_at=now - timedelta(hours=25),
            last_heartbeat_at=now - timedelta(hours=25),
        )
        paused_recent_id = _seed_session(
            client,
            user_id=user_id,
            track="xingce",
            entry_kind="paper",
            status="paused",
            started_at=now - timedelta(hours=30),
            paused_at=now - timedelta(minutes=10),
            last_heartbeat_at=now - timedelta(hours=25),
            last_activity_at=now - timedelta(minutes=10),
        )
        draft_id = _seed_session(
            client,
            user_id=user_id,
            track="xingce",
            entry_kind="paper",
            status="draft",
            started_at=now - timedelta(hours=3),
        )
        daily_id = _seed_session(
            client,
            user_id=user_id,
            track="xingce",
            entry_kind="paper",
            status="paused",
            started_at=now - timedelta(hours=3),
            source_mode="daily",
            paused_at=now - timedelta(hours=1),
            expires_at=now - timedelta(minutes=1),
        )
        daily_draft_id = _seed_session(
            client,
            user_id=user_id,
            track="xingce",
            entry_kind="paper",
            status="draft",
            source_mode="daily",
            started_at=now - timedelta(hours=3),
            expires_at=now - timedelta(minutes=1),
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            counts = cleanup_stale_sessions(session, now=now)
            expired = expire_daily_sessions(session, now=now)
            session.commit()
            assert counts == {"paused": 3, "abandoned": 1, "draft_abandoned": 1}
            assert expired == 2
            stale_with_heartbeat = session.get(PracticeSessionV2, in_progress_id)
            stale_without_heartbeat = session.get(PracticeSessionV2, in_progress_without_heartbeat_id)
            mixed_anchor = session.get(PracticeSessionV2, mixed_anchor_id)
            assert stale_with_heartbeat is not None and stale_with_heartbeat.status == "paused"
            assert stale_with_heartbeat.paused_at == now - timedelta(minutes=1)
            assert stale_without_heartbeat is not None and stale_without_heartbeat.status == "paused"
            assert stale_without_heartbeat.paused_at == now - timedelta(minutes=1)
            assert mixed_anchor is not None and mixed_anchor.status == "paused"
            assert mixed_anchor.paused_at == now - timedelta(minutes=1)
            assert session.get(PracticeSessionV2, mock_exam_id).status == "in_progress"
            assert session.get(PracticeSessionV2, paused_id).status == "abandoned"
            assert session.get(PracticeSessionV2, paused_recent_id).status == "paused"
            assert session.get(PracticeSessionV2, draft_id).status == "abandoned"
            assert session.get(PracticeSessionV2, daily_id).status == "expired"
            assert session.get(PracticeSessionV2, daily_draft_id).status == "expired"


def test_session_lifecycle_cleanup_rechecks_locked_rows(tmp_path: Path, monkeypatch) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client, email="recheck@example.com", display_name="Recheck User")
        now = datetime.now(UTC).replace(tzinfo=None)
        stale_id = _seed_session(
            client,
            user_id=user_id,
            track="xingce",
            entry_kind="paper",
            status="in_progress",
            started_at=now - timedelta(hours=2),
            last_activity_at=now - timedelta(minutes=31),
            exam_mode=False,
        )
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        original_lock = cleanup_module._lock_session
        touched = {"done": False}

        def lock_and_revive(session, *, session_id: int):
            row = original_lock(session, session_id=session_id)
            if row is not None and row.id == stale_id and not touched["done"]:
                row.last_activity_at = now
                session.add(row)
                touched["done"] = True
            return row

        monkeypatch.setattr(cleanup_module, "_lock_session", lock_and_revive)

        with factory() as session:
            counts = cleanup_stale_sessions(session, now=now)
            session.commit()
            refreshed = session.get(PracticeSessionV2, stale_id)
            assert counts == {"paused": 0, "abandoned": 0, "draft_abandoned": 0}
            assert refreshed is not None and refreshed.status == "in_progress"


def test_session_lifecycle_cleanup_continues_after_single_conflict(tmp_path: Path, monkeypatch) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client, email="continue@example.com", display_name="Continue User")
        now = datetime.now(UTC).replace(tzinfo=None)
        first_id = _seed_session(
            client,
            user_id=user_id,
            track="xingce",
            entry_kind="paper",
            status="in_progress",
            started_at=now - timedelta(hours=2),
            last_activity_at=now - timedelta(minutes=31),
            exam_mode=False,
        )
        second_id = _seed_session(
            client,
            user_id=user_id,
            track="xingce",
            entry_kind="paper",
            status="in_progress",
            started_at=now - timedelta(hours=2),
            last_activity_at=now - timedelta(minutes=31),
            exam_mode=False,
        )
        original_apply = cleanup_module.apply_transition

        def flaky_apply(*args, **kwargs):
            practice_session = kwargs["practice_session"]
            if practice_session.id == first_id:
                raise ConflictError("race", code="INVALID_TRANSITION")
            return original_apply(*args, **kwargs)

        monkeypatch.setattr(cleanup_module, "apply_transition", flaky_apply)

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            counts = cleanup_stale_sessions(session, now=now)
            session.commit()
            first = session.get(PracticeSessionV2, first_id)
            second = session.get(PracticeSessionV2, second_id)
            assert counts == {"paused": 1, "abandoned": 0, "draft_abandoned": 0}
            assert first is not None and first.status == "in_progress"
            assert second is not None and second.status == "paused"
