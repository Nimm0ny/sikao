from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, date, datetime, timedelta
import os
from pathlib import Path
import subprocess
import sys
from typing import Any, cast
from urllib.parse import quote
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL, make_url

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import (
    DailyPracticeV2,
    EssayReportV2,
    EssaySubmissionV2,
    PaperRevisionV2,
    PaperV2,
    PracticeSessionAnswerV2,
    PracticeSessionV2,
    QuestionOptionV2,
    QuestionV2,
    ReviewItemV2,
    UserV2,
)
from sikao_api.main import create_app
from sikao_api.modules.review.application.queue_items import reason_compat_for_source


REPO_ROOT = Path(__file__).resolve().parents[4]
ALEMBIC_INI = REPO_ROOT / "database" / "migrations" / "alembic.ini"


def _render_url(url: URL) -> str:
    user = url.username or ""
    password = quote(url.password or "", safe="")
    auth = f"{user}:{password}@" if password else f"{user}@"
    host = url.host or "127.0.0.1"
    port = f":{url.port}" if url.port is not None else ""
    database = url.database or ""
    return f"{url.drivername}://{auth}{host}{port}/{database}"


def _build_settings(tmp_path: Path, *, database_url: str, schema_token: str) -> Settings:
    return Settings(
        app_env="test",
        database_url=database_url,
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret=f"{schema_token}-secret",
        app_version=schema_token,
        git_sha=f"{schema_token}-sha",
        image_tag=f"{schema_token}-tag",
        build_time="2026-05-23T00:00:00Z",
        schema_version=f"{schema_token}-schema",
    )


@contextmanager
def build_client(
    tmp_path: Path,
    *,
    database_url: str | None = None,
    initialize_schema: bool = True,
    schema_token: str = "practice-content-v2",
) -> Iterator[TestClient]:
    resolved_database_url = database_url or f"sqlite:///{(tmp_path / 'practice-content-v2.db').as_posix()}"
    app = create_app(
        settings=_build_settings(tmp_path, database_url=resolved_database_url, schema_token=schema_token),
        initialize_schema=initialize_schema,
    )
    with TestClient(app) as client:
        yield client


@contextmanager
def build_postgres_client(tmp_path: Path) -> Iterator[TestClient]:
    base_url = make_url(os.environ["TEST_POSTGRESQL_URL"])
    test_database = f"sikao_practice_content_{uuid4().hex[:8]}"
    database_url_obj = base_url.set(database=test_database)
    database_url = _render_url(database_url_obj)
    admin_url = base_url.set(database="postgres")
    admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    with admin_engine.begin() as connection:
        connection.execute(text(f'DROP DATABASE IF EXISTS "{test_database}"'))
        connection.execute(text(f'CREATE DATABASE "{test_database}"'))

    try:
        env = os.environ.copy()
        env["DATABASE_URL"] = database_url
        env["PYTHONPATH"] = str(REPO_ROOT / "services" / "api" / "src")
        subprocess.run(
            [
                sys.executable,
                "-m",
                "alembic",
                "-c",
                str(ALEMBIC_INI),
                "upgrade",
                "head",
            ],
            cwd=REPO_ROOT,
            env=env,
            check=True,
        )
        with build_client(
            tmp_path,
            database_url=database_url,
            initialize_schema=False,
            schema_token="practice-content-v2-postgres",
        ) as client:
            yield client
    finally:
        cleanup_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
        try:
            with cleanup_engine.begin() as connection:
                connection.execute(
                    text(
                        """
                        SELECT pg_terminate_backend(pid)
                        FROM pg_stat_activity
                        WHERE datname = :database_name
                          AND pid <> pg_backend_pid()
                        """
                    ),
                    {"database_name": test_database},
                )
                connection.execute(text(f'DROP DATABASE IF EXISTS "{test_database}"'))
        finally:
            cleanup_engine.dispose()
            admin_engine.dispose()


def register_user(
    client: TestClient,
    *,
    email: str = "content@example.com",
    display_name: str = "Content User",
) -> int:
    response = client.post(
        "/api/v2/auth/register/email",
        json={
            "email": email,
            "password": "secret123",
            "displayName": display_name,
        },
    )
    assert response.status_code == 200, response.text
    csrf = response.cookies.get("csrf_token_v2")
    assert csrf is not None
    client.headers["X-CSRF-Token"] = csrf
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        user = session.query(UserV2).filter_by(display_name=display_name).one()
        return int(user.id)


def seed_paper(
    client: TestClient,
    *,
    paper_code: str,
    title: str,
    subject_kind: str,
    questions: list[dict[str, Any]],
) -> list[int]:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        paper = PaperV2(paper_code=paper_code, title=title, subject_kind=subject_kind)
        session.add(paper)
        session.flush()
        revision = PaperRevisionV2(
            paper_id=paper.id,
            revision_number=1,
            status="published",
        )
        session.add(revision)
        session.flush()
        question_ids: list[int] = []
        for item_no, payload in enumerate(questions, start=1):
            content_json = dict(payload.get("content_json", {"stem": payload["prompt"]}))
            if "correct_answer" in payload and "correct_answer" not in content_json:
                content_json["correct_answer"] = str(payload["correct_answer"])
            if "answerText" in payload and "answerText" not in content_json:
                content_json["answerText"] = str(payload["answerText"])
            question = QuestionV2(
                    revision_id=revision.id,
                    item_no=item_no,
                    subject_kind=subject_kind,
                    prompt=str(payload["prompt"]),
                    answer_kind=str(payload.get("answer_kind", "single_choice")),
                    status="published",
                    content_json=content_json,
                    source="real_exam",
                    year=int(payload["year"]),
                    region=str(payload["region"]),
                    exam_type=str(payload["exam_type"]),
                    category_l1=str(payload["category_l1"]),
                    category_l2=str(payload["category_l2"]),
                    historical_accuracy=float(payload.get("historical_accuracy", 0.5)),
                )
            session.add(question)
            session.flush()
            option_payloads = payload.get("options", [])
            for display_order, option_payload in enumerate(option_payloads, start=1):
                if isinstance(option_payload, dict):
                    option_key = str(option_payload.get("key", chr(64 + display_order)))
                    option_text = str(option_payload.get("text", option_key))
                else:
                    option_key = chr(64 + display_order)
                    option_text = str(option_payload)
                session.add(
                    QuestionOptionV2(
                        question_id=question.id,
                        option_key=option_key,
                        option_text=option_text,
                        display_order=display_order,
                    )
                )
            question_ids.append(question.id)
        session.commit()
        return question_ids


def seed_completed_session(
    client: TestClient,
    *,
    user_id: int,
    paper_code: str,
    started_at: datetime | None = None,
    submitted_at: datetime | None = None,
    answer_outcomes: list[bool | None] | None = None,
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
        resolved_submitted_at = submitted_at or datetime.now(UTC).replace(tzinfo=None)
        practice_session = PracticeSessionV2(
            user_id=user_id,
            track=paper.subject_kind,
            entry_kind="paper",
            status="submitted",
            paper_id=paper.id,
            revision_id=revision.id,
            payload_json={},
            started_at=started_at or (resolved_submitted_at - timedelta(minutes=5)),
            submitted_at=resolved_submitted_at,
        )
        session.add(practice_session)
        session.flush()

        if answer_outcomes is not None:
            questions = list(
                session.query(QuestionV2)
                .filter_by(revision_id=revision.id)
                .order_by(QuestionV2.item_no.asc())
            )
            assert len(answer_outcomes) <= len(questions)
            for display_order, outcome in enumerate(answer_outcomes, start=1):
                question = questions[display_order - 1]
                session.add(
                    PracticeSessionAnswerV2(
                        session_id=practice_session.id,
                        question_id=question.id,
                        question_key=f"question-{question.id}",
                        display_order=display_order,
                        response_json={"selected": ["A"]} if outcome is not None else {},
                        is_correct=outcome,
                        answered_at=resolved_submitted_at,
                    )
                )
        session.commit()
        return practice_session.id


def seed_essay_submission(
    client: TestClient,
    *,
    user_id: int,
    question_id: int,
    submitted_at: datetime | None = None,
    score: float | None = None,
    report_status: str = "completed",
    practice_session_id: int | None = None,
) -> int:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        submission = EssaySubmissionV2(
            user_id=user_id,
            question_id=question_id,
            practice_session_id=practice_session_id,
            content="essay content",
            status="submitted",
            submitted_at=submitted_at or datetime.now(UTC).replace(tzinfo=None),
        )
        session.add(submission)
        session.flush()
        session.add(
            EssayReportV2(
                submission_id=submission.id,
                status=report_status,
                score=score,
                feedback_json={},
            )
        )
        session.commit()
        return submission.id


def seed_daily_practice(
    client: TestClient,
    *,
    user_id: int,
    type_name: str,
    question_ids: list[int],
    date_value: date,
    status: str = "pending",
    completed_session_id: int | None = None,
    expired_at: datetime | None = None,
) -> int:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        row = DailyPracticeV2(
            user_id=user_id,
            date=date_value,
            type=type_name,
            question_ids=question_ids,
            generation_strategy="test_seed",
            status=status,
            completed_session_id=completed_session_id,
            expired_at=expired_at or datetime.combine(date_value, datetime.max.time()).replace(tzinfo=None),
        )
        session.add(row)
        session.commit()
        return row.id


def seed_review_item(
    client: TestClient,
    *,
    user_id: int,
    question_id: int,
    title: str,
    status: str = "pending",
    reason: str = "wrong_answer",
) -> int:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        source_kind = reason if reason in {"wrong_answer", "manual_add", "flagged_persistent"} else "wrong_answer"
        canonical_status = "archived" if status in {"resolved", "removed"} else status
        item = ReviewItemV2(
            user_id=user_id,
            source_kind=source_kind,
            source_id=question_id,
            title=title,
            status=canonical_status,
            question_id=question_id,
            metadata_json={},
            reason=reason_compat_for_source(source_kind),
        )
        session.add(item)
        session.commit()
        return item.id
