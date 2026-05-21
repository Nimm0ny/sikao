from __future__ import annotations

from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Iterator

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from sikao_api.core.config import Settings
from sikao_api.db.models import (
    Paper,
    PaperBlock,
    PaperRevision,
    PaperSection,
    PracticeSession,
    PracticeSessionAnswer,
    Question,
    QuestionOption,
    User,
)
from sikao_api.db.models_v2 import (
    PracticeSessionAnswerV2,
    PracticeSessionV2,
    QuestionOptionV2,
)
from sikao_api.main import create_app
from sikao_api.modules.session.application.service import SessionServiceV2
from sikao_api.scripts.backfill_v2_content import run as run_content_backfill
from sikao_api.scripts.backfill_v2_identity import run as run_identity_backfill
from sikao_api.scripts.backfill_v2_session import run as run_session_backfill


@contextmanager
def build_app(tmp_path: Path, *, name: str) -> Iterator[tuple[object, str]]:
    database_url = f"sqlite:///{(tmp_path / name).as_posix()}"
    settings = Settings(
        app_env="test",
        database_url=database_url,
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="backfill-v2-test-secret",
    )
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app):
        try:
            yield app, database_url
        finally:
            app.state.db.engine.dispose()


def _insert_legacy_user(app: object) -> User:
    session = app.state.db.session_factory()
    try:
        user = User(
            username="legacy-user",
            password_hash="pbkdf2_sha256$00112233445566778899aabbccddeeff$0123456789abcdef",
            display_name="Legacy User",
            email="legacy@example.com",
            email_verified=True,
            phone="13800138000",
            phone_verified=True,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        session.expunge(user)
        return user
    finally:
        session.close()


def _insert_legacy_paper_graph(app: object) -> tuple[Paper, PaperRevision, Question]:
    session = app.state.db.session_factory()
    try:
        paper = Paper(
            paper_code="X-001",
            paper_name="Legacy Xingce Paper",
            source_kind="xingce",
        )
        session.add(paper)
        session.flush()
        revision = PaperRevision(
            paper_id=paper.id,
            revision_number=1,
            sort_order=1,
            paper_name=paper.paper_name,
            source_kind=paper.source_kind,
            source_hash="hash-001",
            source_snapshot_json={},
            is_published=True,
            question_count=1,
        )
        session.add(revision)
        session.flush()
        paper.current_revision_id = revision.id
        section = PaperSection(
            paper_revision_id=revision.id,
            section_key="sec-1",
            title="Section 1",
            display_order=1,
            question_count=1,
        )
        session.add(section)
        session.flush()
        block = PaperBlock(
            paper_revision_id=revision.id,
            section_id=section.id,
            block_type="question",
            display_order=1,
        )
        session.add(block)
        session.flush()
        question = Question(
            paper_revision_id=revision.id,
            section_id=section.id,
            block_id=block.id,
            position=1,
            source_uuid="legacy-question-1",
            question_kind="verbal",
            subtype_name="reading",
            stem_text="Which option is correct?",
            answer_text="A",
            source_kind="xingce",
            renderer_key="single_choice",
        )
        session.add(question)
        session.flush()
        session.add_all(
            [
                QuestionOption(
                    question_id=question.id,
                    option_key="A",
                    option_text="Option A",
                    display_order=1,
                ),
                QuestionOption(
                    question_id=question.id,
                    option_key="B",
                    option_text="Option B",
                    display_order=2,
                ),
            ]
        )
        session.commit()
        session.refresh(paper)
        session.refresh(revision)
        session.refresh(question)
        session.expunge(paper)
        session.expunge(revision)
        session.expunge(question)
        return paper, revision, question
    finally:
        session.close()


def test_content_backfill_removes_stale_question_options(tmp_path: Path) -> None:
    with build_app(tmp_path, name="backfill-v2-content.db") as (app, database_url):
        _insert_legacy_paper_graph(app)

        assert run_content_backfill(database_url=database_url, dry_run=False, limit=None) == 0

        session = app.state.db.session_factory()
        try:
            assert session.scalar(select(func.count()).select_from(QuestionOptionV2)) == 2
            option_b = session.scalar(
                select(QuestionOption).where(QuestionOption.option_key == "B")
            )
            assert option_b is not None
            session.delete(option_b)
            session.commit()
        finally:
            session.close()

        assert run_content_backfill(database_url=database_url, dry_run=False, limit=None) == 0

        session = app.state.db.session_factory()
        try:
            option_keys = list(
                session.scalars(
                    select(QuestionOptionV2.option_key).order_by(QuestionOptionV2.display_order.asc())
                )
            )
            assert option_keys == ["A"]
        finally:
            session.close()


def test_session_backfill_migrates_answer_rows(tmp_path: Path) -> None:
    with build_app(tmp_path, name="backfill-v2-session.db") as (app, database_url):
        user = _insert_legacy_user(app)
        paper, revision, question = _insert_legacy_paper_graph(app)

        session = app.state.db.session_factory()
        try:
            practice_session = PracticeSession(
                mode="papers",
                user_id=user.id,
                paper_id=paper.id,
                paper_revision_id=revision.id,
                started_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=10),
                completed_at=datetime.now(UTC).replace(tzinfo=None),
                total_questions=1,
                retry_question_ids_json=None,
            )
            session.add(practice_session)
            session.flush()
            session.add(
                PracticeSessionAnswer(
                    session_id=practice_session.id,
                    question_id=question.id,
                    display_order=1,
                    selected_answer="A",
                    correct_answer_snapshot="A",
                    is_correct=True,
                    answered_at=datetime.now(UTC).replace(tzinfo=None),
                    elapsed_seconds=42,
                )
            )
            session.commit()
        finally:
            session.close()

        assert run_identity_backfill(database_url=database_url, dry_run=False, limit=None) == 0
        assert run_content_backfill(database_url=database_url, dry_run=False, limit=None) == 0
        assert run_session_backfill(database_url=database_url, dry_run=False, limit=None) == 0

        session = app.state.db.session_factory()
        try:
            practice_session_v2 = session.scalar(select(PracticeSessionV2))
            answer_v2 = session.scalar(select(PracticeSessionAnswerV2))
            assert practice_session_v2 is not None
            assert answer_v2 is not None
            assert answer_v2.question_id is not None
            assert answer_v2.response_json["selectedAnswer"] == "A"
            assert answer_v2.is_correct is True
            response = SessionServiceV2(session).build_session_response(
                practice_session=practice_session_v2
            )
            assert len(response.items) == 1
            assert response.items[0].prompt == "Which option is correct?"
            assert response.items[0].status == "answered"
        finally:
            session.close()
