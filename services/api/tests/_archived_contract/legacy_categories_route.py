"""Phase 1.1 fenbi-merge — GET /api/v2/categories integration tests.

Covers:
  - anonymous: aggregated totals returned, doneByUser=0 for all
  - logged-in + paper-bound session NOT completed: doneByUser=0 (D1 gating)
  - logged-in + paper-bound session completed: doneByUser=question count
  - logged-in + custom_practice answer: doneByUser=1 even without completion
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

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
)
from sikao_api.main import create_app
from sikao_api.modules.question_bank.application.exam_papers import (
    MODE_CUSTOM_PRACTICE,
    MODE_PAPER,
)
from sikao_api.modules.auth.application.security import hash_password


@contextmanager
def _build_client(tmp_path: Path) -> Iterator[tuple[TestClient, Settings]]:
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'exam.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        admin_username="admin",
        admin_password_hash=hash_password("adminpass"),
        jwt_secret="test-secret-0123456789-test-secret",
        llm_api_key="sk-test-key",
        llm_base_url="https://api.deepseek.com/v1",
    )
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as client:
        yield client, settings


@pytest.fixture
def client(tmp_path: Path) -> Iterator[tuple[TestClient, Settings]]:
    with _build_client(tmp_path) as (c, s):
        yield c, s


def _register(c: TestClient) -> int:
    resp = c.post(
        "/api/v2/auth/register/email",
        json={"email": "alice@test.local", "password": "passw0rd", "displayName": "alice"},
    )
    assert resp.status_code == 200, resp.text
    return int(resp.json()["user"]["id"])


def _seed_paper_with_questions(
    database_url: str,
    *,
    paper_code: str,
    top_type: str,
    n_questions: int = 2,
) -> list[int]:
    engine = create_engine(database_url, future=True)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)
    db = SessionLocal()
    try:
        paper = Paper(paper_code=paper_code, paper_name=f"{paper_code} 套卷")
        db.add(paper)
        db.flush()
        revision = PaperRevision(
            paper_id=paper.id,
            revision_number=1,
            sort_order=1,
            paper_name=paper.paper_name,
            question_count=n_questions,
            exam_year=2024,
            source_hash=f"hash_{paper_code}",
            is_published=True,
        )
        db.add(revision)
        db.flush()
        paper.current_revision_id = revision.id
        section = PaperSection(
            paper_revision_id=revision.id,
            section_key=f"{paper_code}_S1",
            title="Section 1",
            instruction_text="",
            display_order=1,
            question_count=n_questions,
        )
        db.add(section)
        db.flush()
        qids: list[int] = []
        for i in range(n_questions):
            block = PaperBlock(
                paper_revision_id=revision.id,
                section_id=section.id,
                block_type="question",
                display_order=i + 1,
            )
            db.add(block)
            db.flush()
            q = Question(
                paper_revision_id=revision.id,
                section_id=section.id,
                block_id=block.id,
                position=i + 1,
                source_uuid=f"q_{paper_code}_{i}",
                question_kind="single_choice",
                subtype_name="X",
                stem_text=f"{paper_code} 题 {i + 1}",
                answer_text="A",
                renderer_key="single_choice",
                exam_year=2024,
                is_gradable=True,
                enabled=True,
                subject=top_type,
                canonical_top_type=top_type,
                canonical_subtype="X",
            )
            db.add(q)
            db.flush()
            db.add(
                QuestionOption(
                    question_id=q.id,
                    option_key="A",
                    option_text="opt A",
                    display_order=0,
                )
            )
            qids.append(q.id)
        db.commit()
        return qids
    finally:
        db.close()


def _record_answer(
    database_url: str,
    *,
    user_id: int,
    question_id: int,
    paper_revision_id: int | None,
    mode: str,
    completed: bool,
) -> None:
    """Insert a PracticeSession + PracticeSessionAnswer row."""
    engine = create_engine(database_url, future=True)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)
    db = SessionLocal()
    try:
        session_row = PracticeSession(
            mode=mode,
            user_id=user_id,
            paper_revision_id=paper_revision_id,
            total_questions=1,
            completed_at=datetime.now(UTC).replace(tzinfo=None) if completed else None,
        )
        db.add(session_row)
        db.flush()
        db.add(
            PracticeSessionAnswer(
                session_id=session_row.id,
                question_id=question_id,
                display_order=1,
                selected_answer="A",
                correct_answer_snapshot="A",
                is_correct=True,
            )
        )
        db.commit()
    finally:
        db.close()


def _revision_id(database_url: str, paper_code: str) -> int:
    engine = create_engine(database_url, future=True)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)
    db = SessionLocal()
    try:
        paper = db.query(Paper).filter(Paper.paper_code == paper_code).one()
        assert paper.current_revision_id is not None
        return int(paper.current_revision_id)
    finally:
        db.close()


# ── tests ─────────────────────────────────────────────────────────────────


def test_categories_anonymous_returns_totals_done_zero(client) -> None:
    c, s = client
    _seed_paper_with_questions(s.database_url, paper_code="P1", top_type="判断推理", n_questions=3)
    _seed_paper_with_questions(s.database_url, paper_code="P2", top_type="言语理解", n_questions=2)

    resp = c.get("/api/v2/categories")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    items = {item["topType"]: item for item in body["categories"]}
    assert items["判断推理"]["total"] == 3
    assert items["判断推理"]["doneByUser"] == 0
    assert items["言语理解"]["total"] == 2
    assert items["言语理解"]["doneByUser"] == 0


def test_categories_paper_bound_uncompleted_excluded(client) -> None:
    """D1: paper-bound session 未交卷, 不算 done."""
    c, s = client
    qids = _seed_paper_with_questions(s.database_url, paper_code="P1", top_type="判断推理", n_questions=2)
    user_id = _register(c)
    rev_id = _revision_id(s.database_url, "P1")
    _record_answer(
        s.database_url,
        user_id=user_id,
        question_id=qids[0],
        paper_revision_id=rev_id,
        mode=MODE_PAPER,
        completed=False,
    )

    resp = c.get("/api/v2/categories")
    items = {item["topType"]: item for item in resp.json()["categories"]}
    assert items["判断推理"]["doneByUser"] == 0


def test_categories_paper_bound_completed_counts(client) -> None:
    c, s = client
    qids = _seed_paper_with_questions(s.database_url, paper_code="P1", top_type="判断推理", n_questions=2)
    user_id = _register(c)
    rev_id = _revision_id(s.database_url, "P1")
    _record_answer(
        s.database_url,
        user_id=user_id,
        question_id=qids[0],
        paper_revision_id=rev_id,
        mode=MODE_PAPER,
        completed=True,
    )

    resp = c.get("/api/v2/categories")
    items = {item["topType"]: item for item in resp.json()["categories"]}
    assert items["判断推理"]["doneByUser"] == 1


def test_categories_custom_practice_counts_without_completion(client) -> None:
    """D1: custom_practice 单题答即记, 不需要 session.completed_at."""
    c, s = client
    qids = _seed_paper_with_questions(s.database_url, paper_code="P1", top_type="言语理解", n_questions=2)
    user_id = _register(c)
    _record_answer(
        s.database_url,
        user_id=user_id,
        question_id=qids[0],
        paper_revision_id=None,
        mode=MODE_CUSTOM_PRACTICE,
        completed=False,
    )

    resp = c.get("/api/v2/categories")
    items = {item["topType"]: item for item in resp.json()["categories"]}
    assert items["言语理解"]["doneByUser"] == 1
