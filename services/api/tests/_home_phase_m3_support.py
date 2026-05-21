from __future__ import annotations

from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Iterator

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import (
    AuditLogV2,
    PaperRevisionV2,
    PaperV2,
    PlanEventV2,
    PracticeSessionAnswerV2,
    PracticeSessionV2,
    ProfileGoalV2,
    ProgressSnapshotV2,
    QuestionV2,
    ReviewItemV2,
    UserV2,
    WeaknessSnapshotV2,
)
from sikao_api.main import create_app


@contextmanager
def build_client(tmp_path: Path) -> Iterator[tuple[TestClient, FastAPI]]:
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'home-m3-dashboard.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="home-m3-dashboard-secret",
        app_version="home-m3-test",
        git_sha="home-m3-sha",
        image_tag="home-m3-tag",
        build_time="2026-05-21T00:00:00Z",
        schema_version="home-m3-schema",
    )
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as client:
        yield client, app


def register(client: TestClient, *, email: str = "alice@example.com") -> None:
    response = client.post(
        "/api/v2/auth/register/email",
        json={"email": email, "password": "secret123", "displayName": "Alice"},
    )
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = response.cookies["csrf_token_v2"]


def load_user(app: FastAPI) -> UserV2:
    session = app.state.db.session_factory()
    try:
        user = session.scalar(select(UserV2).where(UserV2.display_name == "Alice"))
        assert user is not None
        session.expunge(user)
        return user
    finally:
        session.close()


def seed_question(app: FastAPI, *, subject_kind: str, item_no: int) -> int:
    session = app.state.db.session_factory()
    try:
        paper = PaperV2(
            paper_code=f"paper-{subject_kind}-{item_no}",
            title=f"{subject_kind} paper",
            subject_kind="xingce",
        )
        session.add(paper)
        session.flush()
        revision = PaperRevisionV2(paper_id=paper.id, revision_number=1, status="published")
        session.add(revision)
        session.flush()
        question = QuestionV2(
            revision_id=revision.id,
            item_no=item_no,
            subject_kind=subject_kind,
            prompt=f"{subject_kind} question {item_no}",
            answer_kind="single_choice",
            status="published",
            content_json={},
        )
        session.add(question)
        session.commit()
        return question.id
    finally:
        session.close()


def seed_practice_session(
    app: FastAPI,
    *,
    user_id: int,
    started_at: datetime,
    status: str,
    submitted_at: datetime | None = None,
) -> int:
    session = app.state.db.session_factory()
    try:
        row = PracticeSessionV2(
            user_id=user_id,
            track="xingce",
            entry_kind="manual",
            status=status,
            started_at=started_at,
            submitted_at=submitted_at,
            payload_json={"subject": "yanyu"},
        )
        session.add(row)
        session.commit()
        return row.id
    finally:
        session.close()


def seed_answer(
    app: FastAPI,
    *,
    session_id: int,
    question_id: int,
    question_key: str,
    display_order: int,
    answered_at: datetime,
    is_correct: bool,
) -> None:
    session = app.state.db.session_factory()
    try:
        session.add(
            PracticeSessionAnswerV2(
                session_id=session_id,
                question_id=question_id,
                question_key=question_key,
                display_order=display_order,
                response_json={"selected": "A"},
                is_correct=is_correct,
                answered_at=answered_at,
            )
        )
        session.commit()
    finally:
        session.close()


def seed_review_item(app: FastAPI, *, user_id: int, title: str, updated_at: datetime) -> None:
    session = app.state.db.session_factory()
    try:
        row = ReviewItemV2(
            user_id=user_id,
            source_kind="wrong_question",
            source_id=None,
            title=title,
            status="pending",
            metadata_json={},
            created_at=updated_at - timedelta(days=1),
            updated_at=updated_at,
        )
        session.add(row)
        session.commit()
    finally:
        session.close()


def seed_exam_targets(app: FastAPI, *, user_id: int) -> None:
    session = app.state.db.session_factory()
    try:
        goal = ProfileGoalV2(
            user_id=user_id,
            target_exam="legacy",
            target_score="130",
            weekly_target_hours=12,
            exam_targets=[
                {
                    "exam_id": "guokao_2027",
                    "exam_name": "国考 2027",
                    "exam_date": "2027-11-26",
                    "subjects": ["xingce", "essay"],
                }
            ],
        )
        session.add(goal)
        session.commit()
    finally:
        session.close()


__all__ = [
    "AuditLogV2",
    "PlanEventV2",
    "PracticeSessionAnswerV2",
    "PracticeSessionV2",
    "ProgressSnapshotV2",
    "WeaknessSnapshotV2",
    "build_client",
    "load_user",
    "register",
    "seed_answer",
    "seed_exam_targets",
    "seed_practice_session",
    "seed_question",
    "seed_review_item",
]
