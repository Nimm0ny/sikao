from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
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
    PaperRevisionV2,
    PaperV2,
    PracticeSessionAnswerV2,
    PracticeSessionV2,
    QuestionV2,
    UserV2,
)
from sikao_api.main import create_app


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
    admin_url = base_url.set(database="template1")
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
        return user.id


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
            question = QuestionV2(
                    revision_id=revision.id,
                    item_no=item_no,
                    subject_kind=subject_kind,
                    prompt=str(payload["prompt"]),
                    answer_kind="single_choice",
                    status="published",
                    content_json={"stem": payload["prompt"]},
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
            question_ids.append(question.id)
        session.commit()
        return question_ids


def seed_completed_session(
    client: TestClient,
    *,
    user_id: int,
    paper_code: str,
    submitted_at: datetime | None = None,
    answer_outcomes: list[bool | None] | None = None,
) -> None:
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
        practice_session = PracticeSessionV2(
            user_id=user_id,
            track=paper.subject_kind,
            entry_kind="paper",
            status="submitted",
            paper_id=paper.id,
            revision_id=revision.id,
            payload_json={},
            submitted_at=submitted_at or datetime.now(UTC).replace(tzinfo=None),
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
                        response_json={},
                        is_correct=outcome,
                    )
                )
        session.commit()
