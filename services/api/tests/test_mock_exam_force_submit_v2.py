from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import pytest

from _helpers.practice_content_support import build_client, register_user, seed_paper
from sikao_api.db.models_v2 import AuditLogV2, PracticeSessionV2
from sikao_api.modules.mock_exam.application.auto_submitter import auto_submit_expired_mock_exams
from sikao_api.modules.session.application.service import SessionServiceV2
from sikao_api.modules.system.application.errors import ConflictError


def _mock_questions() -> list[dict[str, Any]]:
    return [
        {
            "prompt": f"Question {index}",
            "year": 2024,
            "region": "beijing",
            "exam_type": "provincial",
            "category_l1": "verbal",
            "category_l2": "logic_fill",
        }
        for index in range(1, 31)
    ]


def test_mock_exam_force_submitter_and_delayed_review(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-MOCK-FORCE-001",
            title="Force Mock",
            subject_kind="xingce",
            questions=_mock_questions(),
        )
        created = client.post(
            "/api/v2/practice/mock-exams",
            json={
                "paperCode": "XC-MOCK-FORCE-001",
                "delayedReviewMinutes": 60,
            },
            headers={"Idempotency-Key": "mock-create-force-1"},
        )
        assert created.status_code == 201, created.text
        session_id = created.json()["sessionId"]
        started = client.post(f"/api/v2/practice/sessions/{session_id}/start")
        assert started.status_code == 200, started.text
        session_view = client.get(f"/api/v2/practice/sessions/{session_id}")
        assert session_view.status_code == 200, session_view.text
        first_question_key = session_view.json()["items"][0]["questionKey"]
        saved = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={"answers": [{"questionKey": first_question_key, "answer": {"selected": ["A"]}}]},
        )
        assert saved.status_code == 200, saved.text

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            practice_session = session.get(PracticeSessionV2, session_id)
            assert practice_session is not None
            assert practice_session.auto_submit_at is not None
            expired_now = practice_session.auto_submit_at + timedelta(seconds=1)

        with factory() as session:
            submitted = auto_submit_expired_mock_exams(session, now=expired_now)
            session.commit()
            assert submitted == [(user_id, session_id)]
            practice_session = session.get(PracticeSessionV2, session_id)
            audits = list(
                session.query(AuditLogV2)
                .filter_by(target_type="practice_session_v2", target_id=session_id)
                .order_by(AuditLogV2.id.asc())
            )
            assert practice_session is not None
            assert practice_session.status == "submitted"
            assert practice_session.force_submitted is True
            assert practice_session.force_submitted_reason == "mock_exam_timeout"
            assert practice_session.delayed_review_until is not None
            assert any(audit.action == "session.force_submitted" for audit in audits)
            assert any(audit.action == "mock_exam.force_submitted" for audit in audits)

        session_view = client.get(f"/api/v2/practice/sessions/{session_id}")
        assert session_view.status_code == 200, session_view.text
        answer_id = int(session_view.json()["items"][0]["id"])

        blocked = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers/{answer_id}/view-solution"
        )
        assert blocked.status_code == 403, blocked.text
        assert blocked.json()["code"] == "DELAYED_REVIEW_LOCKED"

        with factory() as session:
            practice_session = session.get(PracticeSessionV2, session_id)
            assert practice_session is not None
            practice_session.delayed_review_until = datetime.now(UTC).replace(tzinfo=None) - timedelta(seconds=1)
            session.add(practice_session)
            session.commit()

        unlocked = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers/{answer_id}/view-solution"
        )
        assert unlocked.status_code == 200, unlocked.text
        assert unlocked.json()["viewedSolution"] is True


def test_mock_exam_force_submitter_keeps_prior_success_when_later_row_conflicts(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-MOCK-FORCE-BATCH",
            title="Force Batch",
            subject_kind="xingce",
            questions=_mock_questions(),
        )
        created_a = client.post(
            "/api/v2/practice/mock-exams",
            json={"paperCode": "XC-MOCK-FORCE-BATCH"},
            headers={"Idempotency-Key": "mock-create-force-batch-a"},
        )
        created_b = client.post(
            "/api/v2/practice/mock-exams",
            json={"paperCode": "XC-MOCK-FORCE-BATCH"},
            headers={"Idempotency-Key": "mock-create-force-batch-b"},
        )
        session_a = created_a.json()["sessionId"]
        session_b = created_b.json()["sessionId"]
        assert client.post(f"/api/v2/practice/sessions/{session_a}/start").status_code == 200
        assert client.post(f"/api/v2/practice/sessions/{session_b}/start").status_code == 200

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            row_a = session.get(PracticeSessionV2, session_a)
            row_b = session.get(PracticeSessionV2, session_b)
            assert row_a is not None and row_b is not None
            assert row_a.auto_submit_at is not None and row_b.auto_submit_at is not None
            expired_now = max(row_a.auto_submit_at, row_b.auto_submit_at) + timedelta(seconds=1)

        original_submit = SessionServiceV2.submit
        calls = {"count": 0}

        def flaky_submit(self: SessionServiceV2, *, practice_session: PracticeSessionV2, force_submitted_reason: str | None = None) -> None:
            calls["count"] += 1
            if calls["count"] == 2:
                raise ConflictError("race", code="INVALID_TRANSITION")
            original_submit(self, practice_session=practice_session, force_submitted_reason=force_submitted_reason)

        monkeypatch.setattr(SessionServiceV2, "submit", flaky_submit)

        with factory() as session:
            submitted = auto_submit_expired_mock_exams(session, now=expired_now)
            session.commit()
            assert submitted == [(user_id, session_a)]
            first = session.get(PracticeSessionV2, session_a)
            second = session.get(PracticeSessionV2, session_b)
            assert first is not None and first.status == "submitted"
            assert second is not None and second.status == "in_progress"
