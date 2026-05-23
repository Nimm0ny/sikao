from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

from fastapi.testclient import TestClient

from _helpers.practice_content_support import build_client, register_user, seed_paper
from sikao_api.db.models_v2 import AuditLogV2, PracticeSessionAnswerV2, PracticeSessionV2, QuestionTimingBaselineV2
from sikao_api.modules.mock_exam.application.auto_submitter import auto_submit_expired_mock_exams


def _seed_started_session(client: TestClient, *, user_id: int, paper_code: str) -> tuple[int, int]:
    seed_paper(
        client,
        paper_code=paper_code,
        title="Timing Submit Hook",
        subject_kind="xingce",
        questions=[
            {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
            {"prompt": "B", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading"},
        ],
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


def test_submit_timing_hook_clamps_open_intervals_and_marks_overtime(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        session_id, answer_id = _seed_started_session(client, user_id=user_id, paper_code="XC-TIMING-HOOK-001")
        base = datetime.now(UTC).replace(tzinfo=None)
        first = client.post(
            f"/api/v2/practice/sessions/{session_id}/timing/events",
            json={
                "events": [
                    {"type": "question_enter", "answerId": answer_id, "ts": (base - timedelta(seconds=120)).isoformat()},
                    {"type": "answer_change", "answerId": answer_id, "ts": (base - timedelta(seconds=110)).isoformat(), "from": None, "to": "A"},
                ]
            },
        )
        assert first.status_code == 200, first.text

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            answers = list(
                session.query(PracticeSessionAnswerV2)
                .filter_by(session_id=session_id)
                .order_by(PracticeSessionAnswerV2.display_order.asc())
            )
            assert len(answers) == 2
            baselines = [
                QuestionTimingBaselineV2(
                    question_id=answers[0].question_id or 0,
                    p50_ms=10000,
                    p90_ms=20000,
                    p95_ms=30000,
                    mean_ms=15000,
                    sample_size=40,
                ),
                QuestionTimingBaselineV2(
                    question_id=answers[1].question_id or 0,
                    p50_ms=10000,
                    p90_ms=20000,
                    p95_ms=30000,
                    mean_ms=15000,
                    sample_size=10,
                ),
            ]
            session.add_all(baselines)
            practice_session = session.get(PracticeSessionV2, session_id)
            assert practice_session is not None
            practice_session.started_at = base - timedelta(seconds=120)
            session.add(practice_session)
            session.commit()

        submitted = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        assert submitted.status_code == 200, submitted.text

        with factory() as session:
            answers = list(
                session.query(PracticeSessionAnswerV2)
                .filter_by(session_id=session_id)
                .order_by(PracticeSessionAnswerV2.display_order.asc())
            )
            practice_session = session.get(PracticeSessionV2, session_id)
            audits = list(
                session.query(AuditLogV2)
                .filter_by(target_type="practice_session_v2", target_id=session_id)
                .order_by(AuditLogV2.id.asc())
            )
            assert practice_session is not None
            assert answers[0].time_spent_ms == 60000
            assert answers[0].is_overtime is True
            assert answers[1].is_overtime is False
            assert practice_session.total_active_seconds == 60
            timing_state = practice_session.payload_json.get("_timing_state")
            assert timing_state == {"open_intervals": {}}
            assert any(audit.action == "timing.session_clamped_intervals" for audit in audits)


def test_submit_timing_hook_excludes_paused_span_from_active_time(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        session_id, answer_id = _seed_started_session(client, user_id=user_id, paper_code="XC-TIMING-HOOK-002")
        base = datetime.now(UTC).replace(tzinfo=None)
        first = client.post(
            f"/api/v2/practice/sessions/{session_id}/timing/events",
            json={
                "events": [
                    {"type": "question_enter", "answerId": answer_id, "ts": (base - timedelta(seconds=40)).isoformat()},
                ]
            },
        )
        assert first.status_code == 200, first.text

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            answer = session.get(PracticeSessionAnswerV2, answer_id)
            assert answer is not None
            session.add(
                QuestionTimingBaselineV2(
                    question_id=answer.question_id or 0,
                    p50_ms=10000,
                    p90_ms=20000,
                    p95_ms=30000,
                    mean_ms=15000,
                    sample_size=40,
                )
            )
            practice_session = session.get(PracticeSessionV2, session_id)
            assert practice_session is not None
            practice_session.started_at = base - timedelta(seconds=40)
            practice_session.status = "paused"
            practice_session.paused_at = base - timedelta(seconds=10)
            session.add(practice_session)
            session.commit()

        submitted = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        assert submitted.status_code == 200, submitted.text

        with factory() as session:
            answer = session.get(PracticeSessionAnswerV2, answer_id)
            practice_session = session.get(PracticeSessionV2, session_id)
            assert answer is not None
            assert practice_session is not None
            assert answer.time_spent_ms == 30000
            assert practice_session.total_active_seconds == 30
            assert practice_session.paused_total_seconds == 10
            assert practice_session.total_active_seconds + practice_session.paused_total_seconds <= 40


def test_submit_timing_hook_recomputes_overtime_after_budget_reduction(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        session_id, answer_id = _seed_started_session(client, user_id=user_id, paper_code="XC-TIMING-HOOK-003")
        base = datetime.now(UTC).replace(tzinfo=None)
        first = client.post(
            f"/api/v2/practice/sessions/{session_id}/timing/events",
            json={"events": [{"type": "question_enter", "answerId": answer_id, "ts": (base - timedelta(seconds=120)).isoformat()}]},
        )
        assert first.status_code == 200, first.text

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            answer = session.get(PracticeSessionAnswerV2, answer_id)
            assert answer is not None
            session.add(
                QuestionTimingBaselineV2(
                    question_id=answer.question_id or 0,
                    p50_ms=10000,
                    p90_ms=20000,
                    p95_ms=42000,
                    mean_ms=15000,
                    sample_size=40,
                )
            )
            practice_session = session.get(PracticeSessionV2, session_id)
            assert practice_session is not None
            practice_session.started_at = base - timedelta(seconds=50)
            session.add(practice_session)
            session.commit()

        submitted = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        assert submitted.status_code == 200, submitted.text

        with factory() as session:
            answer = session.get(PracticeSessionAnswerV2, answer_id)
            practice_session = session.get(PracticeSessionV2, session_id)
            assert answer is not None
            assert practice_session is not None
            assert answer.time_spent_ms == 50000
            assert answer.is_overtime is False
            assert practice_session.total_active_seconds == 50


def test_mock_exam_timeout_submit_clips_post_deadline_timing(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-TIMING-MOCK-001",
            title="Timing Mock Hook",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
                {"prompt": "B", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading"},
            ],
        )
        created = client.post(
            "/api/v2/practice/mock-exams",
            json={"paperCode": "XC-TIMING-MOCK-001"},
            headers={"Idempotency-Key": "timing-mock-hook-1"},
        )
        assert created.status_code == 201, created.text
        session_id = created.json()["sessionId"]
        started = client.post(f"/api/v2/practice/sessions/{session_id}/start")
        assert started.status_code == 200, started.text

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            practice_session = session.get(PracticeSessionV2, session_id)
            answer = (
                session.query(PracticeSessionAnswerV2)
                .filter_by(session_id=session_id)
                .order_by(PracticeSessionAnswerV2.display_order.asc())
                .first()
            )
            assert practice_session is not None
            assert answer is not None
            assert practice_session.auto_submit_at is not None
            session.add(
                QuestionTimingBaselineV2(
                    question_id=answer.question_id or 0,
                    p50_ms=10000,
                    p90_ms=20000,
                    p95_ms=30000,
                    mean_ms=15000,
                    sample_size=40,
                )
            )
            session.commit()
            deadline = practice_session.auto_submit_at
            answer_id = answer.id

        events = client.post(
            f"/api/v2/practice/sessions/{session_id}/timing/events",
            json={
                "events": [
                    {"type": "question_enter", "answerId": answer_id, "ts": (deadline - timedelta(seconds=30)).isoformat()},
                    {"type": "question_leave", "answerId": answer_id, "ts": (deadline + timedelta(seconds=10)).isoformat()},
                ]
            },
        )
        assert events.status_code == 200, events.text

        with factory() as session:
            submitted = auto_submit_expired_mock_exams(session, now=deadline + timedelta(seconds=1))
            session.commit()
            assert submitted == [(user_id, session_id)]
            answer = session.get(PracticeSessionAnswerV2, answer_id)
            practice_session = session.get(PracticeSessionV2, session_id)
            assert answer is not None
            assert practice_session is not None
            assert answer.time_spent_ms == 30000
            assert practice_session.total_active_seconds == 30
