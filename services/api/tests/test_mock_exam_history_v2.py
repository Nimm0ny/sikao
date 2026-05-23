from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

from _helpers.practice_content_support import build_client, register_user, seed_essay_submission, seed_paper
from sikao_api.db.models_v2 import PaperRevisionV2, PaperV2, PracticeSessionAnswerV2, PracticeSessionV2, QuestionV2


def _mock_questions() -> list[dict[str, object]]:
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


def _seed_mock_exam_session(
    client: Any,
    *,
    user_id: int,
    paper_code: str,
    submitted_at: datetime,
    correct_count: int,
    total_active_seconds: int,
    force_submitted: bool = False,
) -> int:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        paper = session.query(PaperV2).filter_by(paper_code=paper_code).one()
        revision = (
            session.query(PaperRevisionV2)
            .filter_by(paper_id=paper.id, status="published")
            .order_by(PaperRevisionV2.revision_number.desc())
            .one()
        )
        questions = list(
            session.query(QuestionV2)
            .filter_by(revision_id=revision.id)
            .order_by(QuestionV2.item_no.asc())
        )
        practice_session = PracticeSessionV2(
            user_id=user_id,
            track=paper.subject_kind,
            entry_kind="mock_exam",
            status="submitted",
            paper_id=paper.id,
            revision_id=revision.id,
            payload_json={},
            started_at=submitted_at - timedelta(minutes=120),
            submitted_at=submitted_at,
            practice_mode="full_set",
            source_mode="paper",
            config_snapshot={"mock_exam": {"delayed_review_minutes": 0}},
            exam_mode=True,
            time_limit_minutes=120,
            total_active_seconds=total_active_seconds,
            force_submitted=force_submitted,
            force_submitted_reason="mock_exam_timeout" if force_submitted else None,
        )
        session.add(practice_session)
        session.flush()
        for index, question in enumerate(questions, start=1):
            session.add(
                PracticeSessionAnswerV2(
                    session_id=practice_session.id,
                    question_id=question.id,
                    question_key=str(question.id),
                    display_order=index,
                    response_json={"selected": ["A"]} if index <= correct_count else {},
                    is_correct=True if index <= correct_count else False,
                    answered_at=submitted_at,
                )
            )
        session.commit()
        return practice_session.id


def test_mock_exam_history_and_comparison(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-MOCK-HISTORY-001",
            title="History Mock",
            subject_kind="xingce",
            questions=_mock_questions(),
        )
        now = datetime.now(UTC).replace(tzinfo=None)
        session_ids = [
            _seed_mock_exam_session(
                client,
                user_id=user_id,
                paper_code="XC-MOCK-HISTORY-001",
                submitted_at=now - timedelta(days=offset),
                correct_count=20 + offset,
                total_active_seconds=3600 + offset * 60,
                force_submitted=(offset == 0),
            )
            for offset in range(6)
        ]

        history = client.get("/api/v2/practice/mock-exams/history", params={"period": "all"})
        assert history.status_code == 200, history.text
        payload = history.json()
        assert payload["aggregate"]["totalCount"] == 6
        assert payload["aggregate"]["bestSessionId"] in session_ids
        assert len(payload["sessions"]) == 6
        assert payload["sessions"][0]["sessionId"] == session_ids[0]
        assert payload["sessions"][0]["isForceSubmitted"] is True

        filtered = client.get(
            "/api/v2/practice/mock-exams/history",
            params={"period": "30d", "paperCode": "XC-MOCK-HISTORY-001"},
        )
        assert filtered.status_code == 200, filtered.text
        assert filtered.json()["aggregate"]["totalCount"] == 6

        comparison = client.get(f"/api/v2/practice/mock-exams/{session_ids[3]}/comparison")
        assert comparison.status_code == 200, comparison.text
        comparison_payload = comparison.json()
        assert comparison_payload["self"]["sessionId"] == session_ids[3]
        assert [item["sessionId"] for item in comparison_payload["selfHistory"]] == session_ids[4:6]
        assert comparison_payload["paperBaseline"] == {}


def test_mock_exam_history_essay_uses_completed_report_scores(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="ES-MOCK-HISTORY-001",
            title="Essay History",
            subject_kind="essay",
            questions=[
                {
                    "prompt": "Essay A",
                    "year": 2024,
                    "region": "guokao",
                    "exam_type": "national",
                    "category_l1": "argument",
                    "category_l2": "summary",
                },
                {
                    "prompt": "Essay B",
                    "year": 2024,
                    "region": "guokao",
                    "exam_type": "national",
                    "category_l1": "argument",
                    "category_l2": "proposal",
                },
            ],
        )
        submitted_at = datetime.now(UTC).replace(tzinfo=None)
        session_id = _seed_mock_exam_session(
            client,
            user_id=user_id,
            paper_code="ES-MOCK-HISTORY-001",
            submitted_at=submitted_at,
            correct_count=0,
            total_active_seconds=5400,
        )
        seed_essay_submission(
            client,
            user_id=user_id,
            question_id=question_ids[0],
            practice_session_id=session_id,
            submitted_at=submitted_at,
            score=70.0,
        )
        seed_essay_submission(
            client,
            user_id=user_id,
            question_id=question_ids[1],
            practice_session_id=session_id,
            submitted_at=submitted_at,
            score=80.0,
        )

        history = client.get("/api/v2/practice/mock-exams/history", params={"period": "all"})
        assert history.status_code == 200, history.text
        payload = history.json()
        item = payload["sessions"][0]
        assert item["sessionId"] == session_id
        assert item["totalScore"] == 75.0
        assert item["accuracy"] == 0.75
