"""Phase 5.2 fenbi-merge — GET /api/v2/me/predicted-score integration tests.

D4 算法覆盖:
  - 401 未登录
  - 0 套交卷 → predicted_score=null, sample_size=0
  - 1 套交卷 → predicted_score 等于该套分, is_reference_only=True
  - 3 套交卷 → 加权平均, is_reference_only=False
  - 单题练习 (custom_practice mode) 不计入
  - paper-bound 但 completed_at IS NULL 不计入
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
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
from sikao_api.modules.question_bank.application.exam_papers import MODE_CUSTOM_PRACTICE, MODE_PAPER
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


def _seed_paper(database_url: str, *, paper_code: str, n_questions: int) -> tuple[int, int, list[int]]:
    """Returns (paper_id, revision_id, [question_ids])."""
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
            title="S1",
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
                stem_text=f"q{i}",
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
                QuestionOption(question_id=q.id, option_key="A", option_text="A", display_order=0)
            )
            qids.append(q.id)
        db.commit()
        return int(paper.id), int(revision.id), qids
    finally:
        db.close()


def _create_session(
    database_url: str,
    *,
    user_id: int,
    paper_id: int | None,
    paper_revision_id: int | None,
    total_questions: int,
    correct_qids: list[int],
    wrong_qids: list[int],
    completed: bool,
    completed_at: datetime | None = None,
    mode: str = MODE_PAPER,
) -> int:
    engine = create_engine(database_url, future=True)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)
    db = SessionLocal()
    try:
        ts = completed_at or (datetime.now(UTC).replace(tzinfo=None) if completed else None)
        sess = PracticeSession(
            mode=mode,
            user_id=user_id,
            paper_id=paper_id,
            paper_revision_id=paper_revision_id,
            total_questions=total_questions,
            completed_at=ts,
        )
        db.add(sess)
        db.flush()
        order = 0
        for qid in correct_qids:
            order += 1
            db.add(
                PracticeSessionAnswer(
                    session_id=sess.id, question_id=qid, display_order=order,
                    selected_answer="A", correct_answer_snapshot="A", is_correct=True,
                )
            )
        for qid in wrong_qids:
            order += 1
            db.add(
                PracticeSessionAnswer(
                    session_id=sess.id, question_id=qid, display_order=order,
                    selected_answer="B", correct_answer_snapshot="A", is_correct=False,
                )
            )
        db.commit()
        return int(sess.id)
    finally:
        db.close()


# ── tests ─────────────────────────────────────────────────────────────────


def test_predicted_score_anonymous_returns_401(client) -> None:
    c, _ = client
    assert c.get("/api/v2/me/predicted-score").status_code == 401


def test_predicted_score_no_sessions_returns_null(client) -> None:
    c, _ = client
    _register(c)
    body = c.get("/api/v2/me/predicted-score").json()
    assert body["predictedScore"] is None
    assert body["sampleSize"] == 0
    assert body["isReferenceOnly"] is True
    assert body["recentPapers"] == []


def test_predicted_score_single_paper_equals_that_score(client) -> None:
    c, s = client
    pid, rid, qids = _seed_paper(s.database_url, paper_code="P1", n_questions=10)
    user_id = _register(c)
    # 8/10 → 80
    _create_session(
        s.database_url,
        user_id=user_id, paper_id=pid, paper_revision_id=rid,
        total_questions=10, correct_qids=qids[:8], wrong_qids=qids[8:],
        completed=True,
    )
    body = c.get("/api/v2/me/predicted-score").json()
    assert body["predictedScore"] == 80.0
    assert body["sampleSize"] == 1
    assert body["isReferenceOnly"] is True
    assert len(body["recentPapers"]) == 1
    assert body["recentPapers"][0]["paperCode"] == "P1"


def test_predicted_score_three_papers_weighted_average(client) -> None:
    c, s = client
    pid, rid, qids = _seed_paper(s.database_url, paper_code="P1", n_questions=10)
    user_id = _register(c)
    base = datetime.now(UTC).replace(tzinfo=None)
    # 最早 (i=2): 50 分; 中 (i=1): 70; 最近 (i=0): 90
    for offset, n_correct in [(2, 5), (1, 7), (0, 9)]:
        _create_session(
            s.database_url,
            user_id=user_id, paper_id=pid, paper_revision_id=rid,
            total_questions=10, correct_qids=qids[:n_correct], wrong_qids=qids[n_correct:],
            completed=True, completed_at=base - timedelta(days=offset),
        )
    body = c.get("/api/v2/me/predicted-score").json()
    # weights: 1, 0.85, 0.7225 → sum 2.5725
    # weighted = (1*90 + 0.85*70 + 0.7225*50) / 2.5725 = 185.625 / 2.5725 ≈ 72.16
    assert body["sampleSize"] == 3
    assert body["isReferenceOnly"] is False
    assert 71.5 <= body["predictedScore"] <= 72.8


def test_predicted_score_excludes_custom_practice_mode(client) -> None:
    c, s = client
    pid, rid, qids = _seed_paper(s.database_url, paper_code="P1", n_questions=5)
    user_id = _register(c)
    # custom_practice 不应计入
    _create_session(
        s.database_url,
        user_id=user_id, paper_id=pid, paper_revision_id=rid,
        total_questions=5, correct_qids=qids, wrong_qids=[],
        completed=True, mode=MODE_CUSTOM_PRACTICE,
    )
    body = c.get("/api/v2/me/predicted-score").json()
    assert body["sampleSize"] == 0
    assert body["predictedScore"] is None


def test_predicted_score_excludes_in_progress_session(client) -> None:
    c, s = client
    pid, rid, qids = _seed_paper(s.database_url, paper_code="P1", n_questions=5)
    user_id = _register(c)
    # paper-bound 但 completed_at NULL → 排除
    _create_session(
        s.database_url,
        user_id=user_id, paper_id=pid, paper_revision_id=rid,
        total_questions=5, correct_qids=qids[:3], wrong_qids=[],
        completed=False,
    )
    body = c.get("/api/v2/me/predicted-score").json()
    assert body["sampleSize"] == 0
