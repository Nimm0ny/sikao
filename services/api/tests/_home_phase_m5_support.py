from __future__ import annotations

from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Iterator

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import (
    PaperRevisionV2,
    PaperV2,
    PlanAdjustmentV2,
    PlanEventV2,
    PlanV2,
    PracticeSessionAnswerV2,
    PracticeSessionV2,
    QuestionV2,
    RecommendationV2,
    UserV2,
)
from sikao_api.main import create_app


@contextmanager
def build_client(
    tmp_path: Path,
    *,
    home_scheduler_enabled: bool = False,
    llm_provider: str = "mock",
) -> Iterator[tuple[TestClient, FastAPI]]:
    settings = Settings(
        app_env="test",
        llm_provider=llm_provider,
        home_scheduler_enabled=home_scheduler_enabled,
        database_url=f"sqlite:///{(tmp_path / 'home-m5.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="home-m5-secret",
        app_version="home-m5-test",
        git_sha="home-m5-sha",
        image_tag="home-m5-tag",
        build_time="2026-05-22T00:00:00Z",
        schema_version="home-m5-schema",
    )
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as client:
        yield client, app


def register_user(client: TestClient, *, email: str = "alice@example.com") -> None:
    response = client.post(
        "/api/v2/auth/register/email",
        json={"email": email, "password": "secret123", "displayName": "Alice"},
    )
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = response.cookies["csrf_token_v2"]


def load_user(app: FastAPI, *, display_name: str = "Alice") -> UserV2:
    session = app.state.db.session_factory()
    try:
        user = session.scalar(select(UserV2).where(UserV2.display_name == display_name))
        assert user is not None
        session.expunge(user)
        return user
    finally:
        session.close()


def seed_active_plan(app: FastAPI, *, user_id: int, name: str = "Home active plan") -> int:
    session = app.state.db.session_factory()
    try:
        row = PlanV2(
            user_id=user_id,
            name=name,
            target_exam_id="guokao-2027",
            target_exam_date=datetime(2027, 11, 26).date(),
            daily_minutes_target=180,
            style="balanced",
            baseline={},
            focus_subjects=["xingce"],
            status="active",
            source="user_manual",
            change_log=[],
        )
        session.add(row)
        session.commit()
        return row.id
    finally:
        session.close()


def seed_event(
    app: FastAPI,
    *,
    user_id: int,
    plan_id: int,
    start_at: datetime,
    end_at: datetime,
    title: str = "Planned event",
    status: str = "planned",
    source: str = "user_manual",
    recurring_rule: str | None = None,
    recurring_parent_id: int | None = None,
    deleted_at: datetime | None = None,
) -> int:
    session = app.state.db.session_factory()
    try:
        row = PlanEventV2(
            plan_id=plan_id,
            user_id=user_id,
            title=title,
            category="custom",
            notes="seeded",
            start_at=start_at,
            end_at=end_at,
            timezone="Asia/Shanghai",
            recurring_rule=recurring_rule,
            recurring_parent_id=recurring_parent_id,
            recurring_exception_dates=[],
            status=status,
            source=source,
            target_id=None,
            change_log=[],
            deleted_at=deleted_at,
        )
        session.add(row)
        session.commit()
        return row.id
    finally:
        session.close()


def seed_practice_session(
    app: FastAPI,
    *,
    user_id: int,
    started_at: datetime,
    submitted_at: datetime | None = None,
    status: str = "submitted",
    linked_plan_event_id: int | None = None,
    linked_plan_event_occurrence_ref: str | None = None,
    linked_recommendation_id: int | None = None,
    payload_json: dict[str, Any] | None = None,
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
            linked_plan_event_id=linked_plan_event_id,
            linked_plan_event_occurrence_ref=linked_plan_event_occurrence_ref,
            linked_recommendation_id=linked_recommendation_id,
            payload_json=payload_json or {"subject": "verbal"},
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
    question_key: str,
    answered_at: datetime,
    is_correct: bool,
    question_id: int | None = None,
) -> None:
    session = app.state.db.session_factory()
    try:
        session.add(
            PracticeSessionAnswerV2(
                session_id=session_id,
                question_id=question_id,
                question_key=question_key,
                display_order=1,
                response_json={"selected": "A"},
                is_correct=is_correct,
                answered_at=answered_at,
            )
        )
        session.commit()
    finally:
        session.close()


def seed_question(
    app: FastAPI,
    *,
    paper_code: str = "HOME-M5-PAPER",
    subject_kind: str = "yanyu",
    item_no: int = 1,
) -> int:
    session = app.state.db.session_factory()
    try:
        paper = PaperV2(
            paper_code=paper_code,
            title=f"Paper {paper_code}",
            subject_kind="xingce",
        )
        session.add(paper)
        session.flush()
        revision = PaperRevisionV2(
            paper_id=paper.id,
            revision_number=1,
            status="published",
        )
        session.add(revision)
        session.flush()
        question = QuestionV2(
            revision_id=revision.id,
            item_no=item_no,
            subject_kind=subject_kind,
            prompt=f"{subject_kind} question {item_no}",
            answer_kind="single_choice",
            status="published",
            content_json={"stem": f"{subject_kind} question {item_no}"},
        )
        session.add(question)
        session.commit()
        return question.id
    finally:
        session.close()


def seed_pending_adjustment(
    app: FastAPI,
    *,
    user_id: int,
    plan_id: int,
    changes: list[dict[str, Any]],
    status: str = "pending",
    proposed_at: datetime | None = None,
    expires_at: datetime | None = None,
) -> int:
    session = app.state.db.session_factory()
    try:
        now = datetime.now(UTC).replace(tzinfo=None)
        row = PlanAdjustmentV2(
            user_id=user_id,
            plan_id=plan_id,
            proposed_at=proposed_at or now,
            expires_at=expires_at or (now + timedelta(hours=24)),
            reason="seeded adjustment",
            changes=changes,
            status=status,
            source="seed",
        )
        session.add(row)
        session.commit()
        return row.id
    finally:
        session.close()


def seed_recommendation(
    app: FastAPI,
    *,
    user_id: int,
    generated_at: datetime,
    expires_at: datetime,
    status: str = "pending",
    title: str = "Seed recommendation",
) -> int:
    session = app.state.db.session_factory()
    try:
        row = RecommendationV2(
            user_id=user_id,
            title=title,
            reason="seeded",
            estimated_minutes=20,
            cta="Review",
            action_type="review",
            payload={"session_template": {"track": "xingce", "entry_kind": "review"}},
            generated_at=generated_at,
            expires_at=expires_at,
            status=status,
            source_signals={},
        )
        session.add(row)
        session.commit()
        return row.id
    finally:
        session.close()
