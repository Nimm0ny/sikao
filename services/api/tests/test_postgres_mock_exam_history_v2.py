from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user, seed_essay_submission, seed_paper
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


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_mock_exam_history(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-MOCK-HISTORY-PG-001",
            title="History PG",
            subject_kind="xingce",
            questions=_mock_questions(),
        )
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            paper = session.query(PaperV2).filter_by(paper_code="XC-MOCK-HISTORY-PG-001").one()
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
            submitted_at = datetime.now(UTC).replace(tzinfo=None)
            practice_session = PracticeSessionV2(
                user_id=user_id,
                track="xingce",
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
                total_active_seconds=3600,
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
                        response_json={"selected": ["A"]},
                        is_correct=(index % 2 == 0),
                        answered_at=submitted_at,
                    )
                )
            session.commit()
            session_id = practice_session.id

        history = client.get("/api/v2/practice/mock-exams/history", params={"period": "all"})
        assert history.status_code == 200, history.text
        assert history.json()["aggregate"]["totalCount"] == 1

        comparison = client.get(f"/api/v2/practice/mock-exams/{session_id}/comparison")
        assert comparison.status_code == 200, comparison.text
        assert comparison.json()["self"]["sessionId"] == session_id


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_mock_exam_history_essay_score(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="ES-MOCK-HISTORY-PG-001",
            title="Essay History PG",
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
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            paper = session.query(PaperV2).filter_by(paper_code="ES-MOCK-HISTORY-PG-001").one()
            revision = (
                session.query(PaperRevisionV2)
                .filter_by(paper_id=paper.id, status="published")
                .order_by(PaperRevisionV2.revision_number.desc())
                .one()
            )
            submitted_at = datetime.now(UTC).replace(tzinfo=None)
            practice_session = PracticeSessionV2(
                user_id=user_id,
                track="essay",
                entry_kind="mock_exam",
                status="submitted",
                paper_id=paper.id,
                revision_id=revision.id,
                payload_json={},
                started_at=submitted_at - timedelta(minutes=180),
                submitted_at=submitted_at,
                practice_mode="full_set",
                source_mode="paper",
                config_snapshot={"mock_exam": {"delayed_review_minutes": 0}},
                exam_mode=True,
                time_limit_minutes=180,
                total_active_seconds=7200,
            )
            session.add(practice_session)
            session.commit()
            session_id = practice_session.id
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
        item = history.json()["sessions"][0]
        assert item["sessionId"] == session_id
        assert item["totalScore"] == 75.0
        assert item["accuracy"] == 0.75
