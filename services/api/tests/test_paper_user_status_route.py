"""Phase 1.2 fenbi-merge — GET /api/v2/papers/me/status integration tests.

D1 状态机覆盖:
  - 未登录 → 401
  - 登录无 session → untouched / attempt_count=0 / progress=null
  - paper-bound completed → done / attempt_count=N
  - paper-bound in-progress → in_progress / progress 填 answered/total
  - 同 paper 既有 completed 又有 in-progress → done 覆盖 in-progress
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
from sikao_api.modules.question_bank.application.exam_papers import MODE_PAPER
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


def _seed_paper(database_url: str, *, paper_code: str, n_questions: int = 2) -> tuple[int, list[int]]:
    """Returns (revision_id, [question_ids])."""
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
                subject="判断推理",
                canonical_top_type="判断推理",
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
        return int(revision.id), qids
    finally:
        db.close()


def _create_paper_session(
    database_url: str,
    *,
    user_id: int,
    paper_revision_id: int,
    total_questions: int,
    completed: bool,
    answered_qids: list[int] | None = None,
) -> int:
    engine = create_engine(database_url, future=True)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)
    db = SessionLocal()
    try:
        sess = PracticeSession(
            mode=MODE_PAPER,
            user_id=user_id,
            paper_revision_id=paper_revision_id,
            total_questions=total_questions,
            completed_at=datetime.now(UTC).replace(tzinfo=None) if completed else None,
        )
        db.add(sess)
        db.flush()
        for idx, qid in enumerate(answered_qids or []):
            db.add(
                PracticeSessionAnswer(
                    session_id=sess.id,
                    question_id=qid,
                    display_order=idx + 1,
                    selected_answer="A",
                    correct_answer_snapshot="A",
                    is_correct=True,
                )
            )
        db.commit()
        return int(sess.id)
    finally:
        db.close()


# ── tests ─────────────────────────────────────────────────────────────────


def test_paper_user_status_anonymous_returns_401(client) -> None:
    c, _ = client
    resp = c.get("/api/v2/papers/me/status")
    assert resp.status_code == 401


def test_paper_user_status_no_sessions_all_untouched(client) -> None:
    c, s = client
    _seed_paper(s.database_url, paper_code="P1", n_questions=3)
    _register(c)

    resp = c.get("/api/v2/papers/me/status")

    assert resp.status_code == 200, resp.text
    items = {item["paperCode"]: item for item in resp.json()["items"]}
    assert items["P1"]["userStatus"] == "untouched"
    assert items["P1"]["attemptCount"] == 0
    assert "progress" not in items["P1"]


def test_paper_user_status_completed_session_marks_done(client) -> None:
    c, s = client
    rev_id, qids = _seed_paper(s.database_url, paper_code="P1", n_questions=3)
    user_id = _register(c)
    _create_paper_session(
        s.database_url,
        user_id=user_id,
        paper_revision_id=rev_id,
        total_questions=3,
        completed=True,
        answered_qids=qids,
    )

    resp = c.get("/api/v2/papers/me/status")
    items = {item["paperCode"]: item for item in resp.json()["items"]}
    assert items["P1"]["userStatus"] == "done"
    assert items["P1"]["attemptCount"] == 1
    assert "progress" not in items["P1"]


def test_paper_user_status_in_progress_fills_progress(client) -> None:
    c, s = client
    rev_id, qids = _seed_paper(s.database_url, paper_code="P1", n_questions=5)
    user_id = _register(c)
    _create_paper_session(
        s.database_url,
        user_id=user_id,
        paper_revision_id=rev_id,
        total_questions=5,
        completed=False,
        answered_qids=qids[:2],  # 2/5 答了
    )

    resp = c.get("/api/v2/papers/me/status")
    item = next(x for x in resp.json()["items"] if x["paperCode"] == "P1")
    assert item["userStatus"] == "in_progress"
    assert item["attemptCount"] == 0
    assert item["progress"] == {"answered": 2, "total": 5}


def test_paper_user_status_done_overrides_in_progress(client) -> None:
    """同 paper 一次完成 + 一次进行中, done 优先."""
    c, s = client
    rev_id, qids = _seed_paper(s.database_url, paper_code="P1", n_questions=3)
    user_id = _register(c)
    _create_paper_session(
        s.database_url, user_id=user_id, paper_revision_id=rev_id,
        total_questions=3, completed=True, answered_qids=qids,
    )
    _create_paper_session(
        s.database_url, user_id=user_id, paper_revision_id=rev_id,
        total_questions=3, completed=False, answered_qids=qids[:1],
    )

    resp = c.get("/api/v2/papers/me/status")
    item = next(x for x in resp.json()["items"] if x["paperCode"] == "P1")
    assert item["userStatus"] == "done"
    assert item["attemptCount"] == 1
    assert "progress" not in item
