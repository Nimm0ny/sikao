from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

from fastapi.testclient import TestClient

from _helpers.practice_content_support import build_client, register_user, seed_paper
from sikao_api.db.models_v2 import PracticeSessionAnswerV2, PracticeSessionV2


def _seed_started_session(client: TestClient, *, user_id: int, paper_code: str) -> tuple[int, int]:
    seed_paper(
        client,
        paper_code=paper_code,
        title="Timing Paper",
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


def test_timing_events_update_answer_and_session_fields(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        session_id, answer_id = _seed_started_session(client, user_id=user_id, paper_code="XC-TIMING-001")
        base = datetime.now(UTC).replace(tzinfo=None)
        response = client.post(
            f"/api/v2/practice/sessions/{session_id}/timing/events",
            json={
                "events": [
                    {"type": "question_enter", "answerId": answer_id, "ts": base.isoformat()},
                    {"type": "answer_change", "answerId": answer_id, "ts": (base + timedelta(seconds=10)).isoformat(), "from": None, "to": "A"},
                    {"type": "answer_change", "answerId": answer_id, "ts": (base + timedelta(seconds=15)).isoformat(), "from": "A", "to": "B"},
                    {"type": "question_leave", "answerId": answer_id, "ts": (base + timedelta(seconds=30)).isoformat()},
                ]
            },
        )
        assert response.status_code == 200, response.text
        assert response.json() == {"accepted": 4, "rejected": 0, "lastAckEventIdx": 3}

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            answer = session.get(PracticeSessionAnswerV2, answer_id)
            practice_session = session.get(PracticeSessionV2, session_id)
            assert answer is not None
            assert practice_session is not None
            assert answer.time_spent_ms == 30000
            assert answer.visit_count == 1
            assert answer.answer_change_count == 1
            assert answer.first_seen_at == base
            assert answer.first_answered_at == base + timedelta(seconds=10)
            assert answer.last_modified_at == base + timedelta(seconds=15)
            assert practice_session.first_question_at is not None
            assert practice_session.first_question_at <= base
            assert practice_session.last_activity_at == base + timedelta(seconds=30)
            assert practice_session.total_active_seconds == 30


def test_timing_events_carry_open_interval_across_batches(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        session_id, answer_id = _seed_started_session(client, user_id=user_id, paper_code="XC-TIMING-002")
        base = datetime.now(UTC).replace(tzinfo=None)
        first = client.post(
            f"/api/v2/practice/sessions/{session_id}/timing/events",
            json={"events": [{"type": "question_enter", "answerId": answer_id, "ts": base.isoformat()}]},
        )
        assert first.status_code == 200, first.text
        second = client.post(
            f"/api/v2/practice/sessions/{session_id}/timing/events",
            json={"events": [{"type": "question_leave", "answerId": answer_id, "ts": (base + timedelta(seconds=20)).isoformat()}]},
        )
        assert second.status_code == 200, second.text

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            answer = session.get(PracticeSessionAnswerV2, answer_id)
            practice_session = session.get(PracticeSessionV2, session_id)
            assert answer is not None
            assert practice_session is not None
            assert answer.time_spent_ms == 20000
            assert practice_session.total_active_seconds == 20


def test_timing_events_preserve_open_interval_on_early_leave_and_clamp_long_visit(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        session_id, answer_id = _seed_started_session(client, user_id=user_id, paper_code="XC-TIMING-005")
        base = datetime.now(UTC).replace(tzinfo=None)

        enter = client.post(
            f"/api/v2/practice/sessions/{session_id}/timing/events",
            json={"events": [{"type": "question_enter", "answerId": answer_id, "ts": base.isoformat()}]},
        )
        assert enter.status_code == 200, enter.text
        early_leave = client.post(
            f"/api/v2/practice/sessions/{session_id}/timing/events",
            json={"events": [{"type": "question_leave", "answerId": answer_id, "ts": (base - timedelta(seconds=1)).isoformat()}]},
        )
        assert early_leave.status_code == 200, early_leave.text
        valid_leave = client.post(
            f"/api/v2/practice/sessions/{session_id}/timing/events",
            json={"events": [{"type": "question_leave", "answerId": answer_id, "ts": (base + timedelta(seconds=120)).isoformat()}]},
        )
        assert valid_leave.status_code == 200, valid_leave.text

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            answer = session.get(PracticeSessionAnswerV2, answer_id)
            practice_session = session.get(PracticeSessionV2, session_id)
            assert answer is not None
            assert practice_session is not None
            assert answer.time_spent_ms == 60000
            assert practice_session.total_active_seconds == 60


def test_timing_events_reject_invalid_batches(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        session_id, answer_id = _seed_started_session(client, user_id=user_id, paper_code="XC-TIMING-003")
        base = datetime.now(UTC).replace(tzinfo=None)

        invalid_order = client.post(
            f"/api/v2/practice/sessions/{session_id}/timing/events",
            json={
                "events": [
                    {"type": "question_leave", "answerId": answer_id, "ts": (base + timedelta(seconds=2)).isoformat()},
                    {"type": "question_enter", "answerId": answer_id, "ts": base.isoformat()},
                ]
            },
        )
        assert invalid_order.status_code == 422, invalid_order.text
        assert invalid_order.json()["code"] == "EVENT_ORDER_VIOLATION"

        too_large = client.post(
            f"/api/v2/practice/sessions/{session_id}/timing/events",
            json={
                "events": [
                    {"type": "question_enter", "answerId": answer_id, "ts": (base + timedelta(seconds=index)).isoformat()}
                    for index in range(201)
                ]
            },
        )
        assert too_large.status_code == 400, too_large.text
        assert too_large.json()["code"] == "PAYLOAD_TOO_LARGE"


def test_timing_events_reject_stale_and_terminal_sessions(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        session_id, answer_id = _seed_started_session(client, user_id=user_id, paper_code="XC-TIMING-004")
        base = datetime.now(UTC).replace(tzinfo=None)

        first = client.post(
            f"/api/v2/practice/sessions/{session_id}/timing/events",
            json={"events": [{"type": "answer_change", "answerId": answer_id, "ts": base.isoformat(), "from": None, "to": "A"}]},
        )
        assert first.status_code == 200, first.text

        stale = client.post(
            f"/api/v2/practice/sessions/{session_id}/timing/events",
            json={"events": [{"type": "answer_change", "answerId": answer_id, "ts": (base - timedelta(seconds=61)).isoformat(), "from": "A", "to": "B"}]},
        )
        assert stale.status_code == 422, stale.text
        assert stale.json()["code"] == "STALE_EVENT"

        submitted = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        assert submitted.status_code == 200, submitted.text
        blocked = client.post(
            f"/api/v2/practice/sessions/{session_id}/timing/events",
            json={"events": [{"type": "question_enter", "answerId": answer_id, "ts": (base + timedelta(seconds=5)).isoformat()}]},
        )
        assert blocked.status_code == 409, blocked.text
        assert blocked.json()["code"] == "SESSION_NOT_WRITABLE"
