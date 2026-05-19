from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models import (
    EssayGradingRecord,
    PracticeSession,
    PracticeSessionAnswer,
    StudyPlan,
    StudyPlanTask,
    User,
)
from sikao_api.modules.question_bank.application.exam_papers import MODE_PAPER
from tests.test_exam_api import bearer_headers, build_client, login
from tests.test_predicted_score_route import _seed_paper


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    with build_client(tmp_path) as test_client:
        yield test_client


def _db_session(client: TestClient) -> Session:
    return client.app.state.db.session_factory()


def _database_url(client: TestClient) -> str:
    return str(client.app.state.settings.database_url)


def _user_id(client: TestClient, *, username: str = "alice") -> int:
    with _db_session(client) as db:
        user_id = db.scalar(select(User.id).where(User.username == username))
    assert user_id is not None
    return int(user_id)


def _add_practice_answers(
    client: TestClient,
    *,
    user_id: int,
    answers: list[tuple[bool, datetime]],
) -> list[int]:
    paper_id, revision_id, question_ids = _seed_paper(
        _database_url(client),
        paper_code=f"P{user_id}_{len(answers)}",
        n_questions=len(answers),
    )
    completed_at = max(answered_at for _, answered_at in answers)
    with _db_session(client) as db:
        session = PracticeSession(
            mode=MODE_PAPER,
            user_id=user_id,
            paper_id=paper_id,
            paper_revision_id=revision_id,
            total_questions=len(question_ids),
            completed_at=completed_at,
        )
        db.add(session)
        db.flush()
        for order, ((is_correct, answered_at), question_id) in enumerate(
            zip(answers, question_ids, strict=True),
            start=1,
        ):
            db.add(
                PracticeSessionAnswer(
                    session_id=session.id,
                    question_id=question_id,
                    display_order=order,
                    selected_answer="A" if is_correct else "B",
                    correct_answer_snapshot="A",
                    is_correct=is_correct,
                    answered_at=answered_at,
                )
            )
        db.commit()
    return question_ids


def _add_weekly_summary_rows(
    client: TestClient,
    *,
    user_id: int,
    question_id: int,
    created_at: datetime,
) -> None:
    with _db_session(client) as db:
        plan = StudyPlan(
            user_id=user_id,
            plan_date=created_at.date(),
            generation_status="success",
        )
        db.add(plan)
        db.flush()
        db.add_all(
            [
                StudyPlanTask(
                    plan_id=plan.id,
                    task_kind="practice",
                    payload_json={},
                    display_order=1,
                    status="completed",
                    completed_at=created_at,
                    created_at=created_at,
                ),
                StudyPlanTask(
                    plan_id=plan.id,
                    task_kind="review_wrong",
                    payload_json={},
                    display_order=2,
                    status="completed",
                    completed_at=created_at,
                    created_at=created_at,
                ),
                StudyPlanTask(
                    plan_id=plan.id,
                    task_kind="essay_writing",
                    payload_json={},
                    display_order=3,
                    status="pending",
                    created_at=created_at,
                ),
            ]
        )
        db.add(
            EssayGradingRecord(
                user_id=user_id,
                question_id=question_id,
                answer_text="essay answer",
                status="completed",
                created_at=created_at,
                graded_at=created_at,
            )
        )
        db.commit()


def test_weekly_progress_fresh_user_returns_zero_summary(client: TestClient) -> None:
    token = login(client, "alice", "alice-pass")

    response = client.get("/api/v2/progress/weekly", headers=bearer_headers(token))

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["xingceAnswered"] == 0
    assert body["xingceAccuracy"] == 0.0
    assert body["essaySubmitted"] == 0
    assert body["tasksCompleted"] == 0
    assert body["tasksTotal"] == 0
    assert body["streakDays"] == 0


def test_weekly_progress_aggregates_answers_essay_and_tasks(client: TestClient) -> None:
    token = login(client, "alice", "alice-pass")
    user_id = _user_id(client)
    now = datetime.now(UTC).replace(tzinfo=None)
    question_ids = _add_practice_answers(
        client,
        user_id=user_id,
        answers=[
            (True, now - timedelta(hours=2)),
            (False, now - timedelta(hours=1)),
            (True, now),
        ],
    )
    _add_weekly_summary_rows(
        client,
        user_id=user_id,
        question_id=question_ids[0],
        created_at=now,
    )

    response = client.get("/api/v2/progress/weekly", headers=bearer_headers(token))

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["xingceAnswered"] == 3
    assert body["xingceAccuracy"] == 66.7
    assert body["essaySubmitted"] == 1
    assert body["tasksCompleted"] == 2
    assert body["tasksTotal"] == 3


def test_accuracy_trend_fresh_user_returns_zero_points(client: TestClient) -> None:
    token = login(client, "alice", "alice-pass")

    response = client.get("/api/v2/progress/accuracy-trend?days=7", headers=bearer_headers(token))

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["days"] == 7
    assert len(body["points"]) == 7
    assert all(point["answered"] == 0 for point in body["points"])
    assert all(point["accuracy"] == 0.0 for point in body["points"])


def test_accuracy_trend_groups_answers_by_day(client: TestClient) -> None:
    token = login(client, "alice", "alice-pass")
    user_id = _user_id(client)
    now = datetime.now(UTC).replace(tzinfo=None)
    today = now.date()
    yesterday = today - timedelta(days=1)
    _add_practice_answers(
        client,
        user_id=user_id,
        answers=[
            (True, datetime.combine(yesterday, datetime.min.time())),
            (False, datetime.combine(yesterday, datetime.min.time()) + timedelta(hours=1)),
            (True, now),
        ],
    )

    response = client.get("/api/v2/progress/accuracy-trend?days=7", headers=bearer_headers(token))

    assert response.status_code == 200, response.text
    points = {point["date"]: point for point in response.json()["points"]}
    assert points[str(yesterday)]["answered"] == 2
    assert points[str(yesterday)]["accuracy"] == 50.0
    assert points[str(today)]["answered"] == 1
    assert points[str(today)]["accuracy"] == 100.0
