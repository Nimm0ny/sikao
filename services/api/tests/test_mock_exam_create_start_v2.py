from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

from _helpers.practice_content_support import build_client, register_user, seed_paper
from sikao_api.db.models_v2 import AuditLogV2, PracticeSessionAnswerV2, PracticeSessionV2


def _mock_questions(*, count: int, track: str) -> list[dict[str, Any]]:
    category_l1 = "essay_expression" if track == "essay" else "verbal"
    category_l2 = "essay_argument" if track == "essay" else "logic_fill"
    return [
        {
            "prompt": f"Question {index}",
            "year": 2024,
            "region": "beijing",
            "exam_type": "provincial",
            "category_l1": category_l1,
            "category_l2": category_l2,
        }
        for index in range(1, count + 1)
    ]


def test_create_mock_exam_is_draft_and_idempotent(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-MOCK-001",
            title="Mock Xingce",
            subject_kind="xingce",
            questions=_mock_questions(count=30, track="xingce"),
        )
        headers = {"Idempotency-Key": "mock-create-1"}
        first = client.post(
            "/api/v2/practice/mock-exams",
            json={"paperCode": "XC-MOCK-001"},
            headers=headers,
        )
        second = client.post(
            "/api/v2/practice/mock-exams",
            json={"paperCode": "XC-MOCK-001"},
            headers=headers,
        )

        assert first.status_code == 201, first.text
        assert second.status_code == 201, second.text
        assert second.json() == first.json()
        assert first.json()["status"] == "draft"
        assert first.json()["timeLimitMinutes"] == 120
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            sessions = list(session.query(PracticeSessionV2).filter_by(user_id=user_id, exam_mode=True))
            assert len(sessions) == 1
            practice_session = sessions[0]
            assert practice_session.practice_mode == "full_set"
            assert practice_session.source_mode == "paper"
            assert practice_session.allow_pause is False
            assert practice_session.time_limit_minutes == 120
            assert practice_session.auto_submit_at is None
            assert practice_session.config_snapshot["mock_exam"]["delayed_review_minutes"] == 0
            answer_count = session.query(PracticeSessionAnswerV2).filter_by(session_id=practice_session.id).count()
            assert answer_count == 30


def test_create_mock_exam_rejects_ineligible_paper_and_countdown_non_mock(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        seed_paper(
            client,
            paper_code="XC-MOCK-SHORT",
            title="Short Paper",
            subject_kind="xingce",
            questions=_mock_questions(count=5, track="xingce"),
        )
        create_short = client.post(
            "/api/v2/practice/mock-exams",
            json={"paperCode": "XC-MOCK-SHORT"},
            headers={"Idempotency-Key": "mock-create-2"},
        )
        assert create_short.status_code == 422, create_short.text
        assert create_short.json()["code"] == "PAPER_NOT_MOCK_ELIGIBLE"

        seed_paper(
            client,
            paper_code="XC-NORMAL-001",
            title="Normal Session Paper",
            subject_kind="xingce",
            questions=_mock_questions(count=30, track="xingce"),
        )
        normal = client.post(
            "/api/v2/practice/sessions",
            json={"track": "xingce", "entryKind": "paper", "paperCode": "XC-NORMAL-001"},
        )
        assert normal.status_code == 200, normal.text
        countdown = client.get(f"/api/v2/practice/sessions/{normal.json()['id']}/countdown")
        assert countdown.status_code == 404, countdown.text
        assert countdown.json()["code"] == "NOT_MOCK_EXAM"


def test_start_mock_exam_sets_auto_submit_at_and_countdown(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="ESSAY-MOCK-001",
            title="Essay Mock",
            subject_kind="essay",
            questions=_mock_questions(count=30, track="essay"),
        )
        created = client.post(
            "/api/v2/practice/mock-exams",
            json={
                "paperCode": "ESSAY-MOCK-001",
                "timeLimitMinutes": 150,
                "delayedReviewMinutes": 60,
            },
            headers={"Idempotency-Key": "mock-create-3"},
        )
        assert created.status_code == 201, created.text
        session_id = created.json()["sessionId"]

        started = client.post(f"/api/v2/practice/sessions/{session_id}/start")
        assert started.status_code == 200, started.text
        assert started.json()["status"] == "in_progress"
        assert started.json()["firstQuestionAt"] is not None

        countdown = client.get(f"/api/v2/practice/sessions/{session_id}/countdown")
        assert countdown.status_code == 200, countdown.text
        assert countdown.json()["status"] == "in_progress"
        assert 0 <= countdown.json()["elapsedSeconds"] <= 2
        assert 149 * 60 <= countdown.json()["remainingSeconds"] <= 150 * 60

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            practice_session = session.get(PracticeSessionV2, session_id)
            audits = list(
                session.query(AuditLogV2)
                .filter_by(target_type="practice_session_v2", target_id=session_id)
                .order_by(AuditLogV2.id.asc())
            )
            assert practice_session is not None
            assert practice_session.user_id == user_id
            assert practice_session.auto_submit_at is not None
            assert practice_session.first_question_at is not None
            assert practice_session.delayed_review_until is None
            assert practice_session.config_snapshot["mock_exam"]["delayed_review_minutes"] == 60
            assert practice_session.auto_submit_at - practice_session.first_question_at == timedelta(minutes=150)
            assert any(audit.action == "mock_exam.started" for audit in audits)


def test_mock_exam_rejects_answers_before_start_and_pause_after_start(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        seed_paper(
            client,
            paper_code="XC-MOCK-STRICT-001",
            title="Strict Mock",
            subject_kind="xingce",
            questions=_mock_questions(count=30, track="xingce"),
        )
        created = client.post(
            "/api/v2/practice/mock-exams",
            json={"paperCode": "XC-MOCK-STRICT-001"},
            headers={"Idempotency-Key": "mock-create-4"},
        )
        assert created.status_code == 201, created.text
        session_id = created.json()["sessionId"]

        blocked_answer = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={"answers": [{"questionKey": "1", "answer": {"selected": ["A"]}}]},
        )
        assert blocked_answer.status_code == 409, blocked_answer.text
        assert blocked_answer.json()["code"] == "mock_exam_not_started"

        blocked_submit = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        assert blocked_submit.status_code == 409, blocked_submit.text
        assert blocked_submit.json()["code"] == "INVALID_TRANSITION"

        started = client.post(f"/api/v2/practice/sessions/{session_id}/start")
        assert started.status_code == 200, started.text

        blocked_pause = client.post(f"/api/v2/practice/sessions/{session_id}/pause")
        assert blocked_pause.status_code == 422, blocked_pause.text
        assert blocked_pause.json()["code"] == "MOCK_PAUSE_FORBIDDEN"


def test_mock_exam_forbids_question_linked_notes_but_normal_sessions_allow_them(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        seed_paper(
            client,
            paper_code="XC-MOCK-NOTE-001",
            title="Mock Note Guard",
            subject_kind="xingce",
            questions=_mock_questions(count=30, track="xingce"),
        )
        other_question_id = seed_paper(
            client,
            paper_code="XC-MOCK-NOTE-OTHER-001",
            title="Mock Note Guard Other",
            subject_kind="xingce",
            questions=[_mock_questions(count=1, track="xingce")[0]],
        )[0]

        normal = client.post(
            "/api/v2/practice/sessions",
            json={"track": "xingce", "entryKind": "paper", "paperCode": "XC-MOCK-NOTE-001"},
        )
        assert normal.status_code == 200, normal.text
        normal_session_id = normal.json()["id"]
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            normal_answer = (
                session.query(PracticeSessionAnswerV2)
                .filter_by(session_id=normal_session_id)
                .order_by(PracticeSessionAnswerV2.display_order.asc())
                .first()
            )
            assert normal_answer is not None

        allowed_note = client.post(
            "/api/v2/notes",
            json={
                "title": "Allowed note",
                "body": "outside mock exam",
                "linkedQuestionId": other_question_id,
                "visibility": "private",
            },
        )
        assert allowed_note.status_code == 200, allowed_note.text
        assert allowed_note.json()["linkedQuestionId"] == other_question_id
        assert allowed_note.json()["visibility"] == "private"
        note_id = allowed_note.json()["id"]

        created = client.post(
            "/api/v2/practice/mock-exams",
            json={"paperCode": "XC-MOCK-NOTE-001"},
            headers={"Idempotency-Key": "mock-create-note-1"},
        )
        assert created.status_code == 201, created.text
        session_id = created.json()["sessionId"]

        started = client.post(f"/api/v2/practice/sessions/{session_id}/start")
        assert started.status_code == 200, started.text

        blocked_note = client.post(
            "/api/v2/notes",
            json={
                "title": "Blocked note",
                "body": "during mock exam",
                "linkedQuestionId": other_question_id,
                "visibility": "private",
            },
        )
        assert blocked_note.status_code == 422, blocked_note.text
        assert blocked_note.json()["code"] == "MOCK_NOTES_FORBIDDEN"

        blocked_update = client.put(
            f"/api/v2/notes/{note_id}",
            json={
                "title": "Allowed note",
                "body": "edited during mock exam",
                "status": "active",
                "linkedQuestionId": other_question_id,
                "visibility": "private",
            },
        )
        assert blocked_update.status_code == 422, blocked_update.text
        assert blocked_update.json()["code"] == "MOCK_NOTES_FORBIDDEN"

        with factory() as session:
            mock_session = session.get(PracticeSessionV2, session_id)
            assert mock_session is not None
            mock_session.status = "paused"
            mock_session.paused_at = datetime.now(UTC).replace(tzinfo=None)
            session.add(mock_session)
            session.commit()

        blocked_while_paused = client.put(
            f"/api/v2/notes/{note_id}",
            json={
                "title": "Allowed note",
                "body": "edited during paused mock exam",
                "status": "active",
                "linkedQuestionId": other_question_id,
                "visibility": "private",
            },
        )
        assert blocked_while_paused.status_code == 422, blocked_while_paused.text
        assert blocked_while_paused.json()["code"] == "MOCK_NOTES_FORBIDDEN"
