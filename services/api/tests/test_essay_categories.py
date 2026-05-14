"""#18 — GET /api/v2/essay/categories integration tests (方案 B 修订版).

跨 745 套申论真题按 canonical_subtype 聚合 (跟行测 /api/v2/categories 对称).
doneByUser 走 EssayGradingRecord status='completed' (申论 SSOT, 不是
PracticeSession.answer 行测路径).

Covers:
  - 匿名 (user=None): 6 行 categories 返回 (硬编码顺序), doneByUser 全 0
  - 登录 0 答题: 6 行返回, doneByUser 全 0
  - 登录 + completed grading record: doneByUser +1
  - canonical_subtype IS NULL 的 essay 题不进 categories
  - question_kind != 'essay' (行测) 的题不进 categories
  - pending grading record 不算 done (跟 specialty list_answered_at 行为对齐)
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
    EssayGradingRecord,
    Paper,
    PaperBlock,
    PaperRevision,
    PaperSection,
    Question,
)
from sikao_api.main import create_app
from sikao_api.modules.auth.application.security import hash_password

_EXPECTED_ORDER: tuple[str, ...] = (
    "归纳概括",
    "综合分析",
    "提出对策",
    "公文",
    "应用文",
    "大作文",
)


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


def _register(c: TestClient, *, username: str = "alice") -> int:
    resp = c.post(
        "/api/v2/auth/register/email",
        json={
            "email": f"{username}@test.local",
            "password": "passw0rd",
            "displayName": username,
        },
    )
    assert resp.status_code == 200, resp.text
    return int(resp.json()["user"]["id"])


def _seed_essay_paper(
    database_url: str,
    *,
    paper_code: str,
    paper_name: str,
    questions: list[tuple[str, str | None, str]],
    visible_in_public: bool = True,
) -> list[int]:
    """Seed essay paper.

    questions = [(stem, canonical_subtype | None, question_kind), ...].
    question_kind 给 'essay' 或 'single_choice' 模拟跨 kind 过滤场景.
    """
    engine = create_engine(database_url, future=True)
    SessionLocal = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False, future=True
    )
    db = SessionLocal()
    try:
        paper = Paper(paper_code=paper_code, paper_name=paper_name)
        db.add(paper)
        db.flush()
        revision = PaperRevision(
            paper_id=paper.id,
            revision_number=1,
            sort_order=1,
            paper_name=paper_name,
            question_count=len(questions),
            exam_year=2024,
            source_hash=f"hash_{paper_code}",
            is_published=True,
            visible_in_public=visible_in_public,
        )
        db.add(revision)
        db.flush()
        paper.current_revision_id = revision.id
        section = PaperSection(
            paper_revision_id=revision.id,
            section_key=f"{paper_code}_S1",
            title="申论",
            instruction_text="",
            display_order=1,
            question_count=len(questions),
        )
        db.add(section)
        db.flush()
        qids: list[int] = []
        for i, (stem, subtype, kind) in enumerate(questions):
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
                source_uuid=f"essay_cat_{paper_code}_{i}",
                question_kind=kind,
                subtype_name=subtype or "X",
                stem_text=stem,
                answer_text="",
                renderer_key="essay" if kind == "essay" else "single_choice",
                exam_year=2024,
                is_gradable=(kind != "essay"),
                enabled=True,
                canonical_top_type="申论" if kind == "essay" else "判断推理",
                canonical_subtype=subtype,
            )
            db.add(q)
            db.flush()
            qids.append(q.id)
        db.commit()
        return qids
    finally:
        db.close()


def _seed_grading_record(
    database_url: str,
    *,
    user_id: int,
    question_id: int,
    status: str = "completed",
) -> int:
    engine = create_engine(database_url, future=True)
    SessionLocal = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False, future=True
    )
    db = SessionLocal()
    try:
        record = EssayGradingRecord(
            user_id=user_id,
            question_id=question_id,
            answer_text="my answer",
            status=status,
            created_at=datetime.now(UTC).replace(tzinfo=None),
        )
        db.add(record)
        db.commit()
        return record.id
    finally:
        db.close()


# ── Tests ───────────────────────────────────────────────────────────────────


def test_essay_categories_anonymous_returns_six_rows_done_zero(client) -> None:
    """匿名 → 返 6 行 (硬编码顺序), doneByUser 全 0."""
    c, s = client
    _seed_essay_paper(
        s.database_url,
        paper_code="ESSAY-A",
        paper_name="A",
        questions=[
            ("题 1", "归纳概括", "essay"),
            ("题 2", "归纳概括", "essay"),
            ("题 3", "大作文", "essay"),
            ("题 4", "公文", "essay"),
            ("题 5", "应用文", "essay"),
        ],
    )

    resp = c.get("/api/v2/essay/categories")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    items = body["categories"]
    # 6 行硬编码顺序 (前端 5 卡合并)
    assert [it["topType"] for it in items] == list(_EXPECTED_ORDER)
    # 全 0 done
    assert all(it["doneByUser"] == 0 for it in items)
    # totals
    by_type = {it["topType"]: it for it in items}
    assert by_type["归纳概括"]["total"] == 2
    assert by_type["大作文"]["total"] == 1
    assert by_type["公文"]["total"] == 1
    assert by_type["应用文"]["total"] == 1
    assert by_type["综合分析"]["total"] == 0  # 库里没题 → 仍 0 行返 (FE 显示 "题库准备中")
    assert by_type["提出对策"]["total"] == 0


def test_essay_categories_logged_in_no_answers_done_zero(client) -> None:
    """登录无答题 → 6 行, doneByUser 全 0."""
    c, s = client
    _register(c)
    _seed_essay_paper(
        s.database_url,
        paper_code="ESSAY-B",
        paper_name="B",
        questions=[("题 1", "归纳概括", "essay")],
    )

    resp = c.get("/api/v2/essay/categories")
    assert resp.status_code == 200
    body = resp.json()
    assert all(it["doneByUser"] == 0 for it in body["categories"])


def test_essay_categories_completed_grading_records_count(client) -> None:
    """登录 + 单题 essay grading record status='completed' → doneByUser +1."""
    c, s = client
    user_id = _register(c)
    qids = _seed_essay_paper(
        s.database_url,
        paper_code="ESSAY-C",
        paper_name="C",
        questions=[
            ("题 1", "归纳概括", "essay"),
            ("题 2", "归纳概括", "essay"),
            ("题 3", "大作文", "essay"),
        ],
    )
    # 答完 题 1 (归纳概括)
    _seed_grading_record(
        s.database_url, user_id=user_id, question_id=qids[0], status="completed"
    )
    # 答完 题 3 (大作文)
    _seed_grading_record(
        s.database_url, user_id=user_id, question_id=qids[2], status="completed"
    )
    # 题 2 pending — 不应算 done
    _seed_grading_record(
        s.database_url, user_id=user_id, question_id=qids[1], status="pending"
    )

    resp = c.get("/api/v2/essay/categories")
    assert resp.status_code == 200
    body = resp.json()
    by_type = {it["topType"]: it for it in body["categories"]}
    assert by_type["归纳概括"]["total"] == 2
    assert by_type["归纳概括"]["doneByUser"] == 1
    assert by_type["大作文"]["total"] == 1
    assert by_type["大作文"]["doneByUser"] == 1


def test_essay_categories_distinct_question_id(client) -> None:
    """同一 question 多次 completed grading record → distinct 仍记 1.

    回归保护: list_essay_categories 用 func.count(func.distinct(Question.id))
    而非 func.count(EssayGradingRecord.id), 防 user 重复评分把 doneByUser 算多。
    """
    c, s = client
    user_id = _register(c)
    qids = _seed_essay_paper(
        s.database_url,
        paper_code="ESSAY-DISTINCT",
        paper_name="DISTINCT",
        questions=[
            ("题 1", "归纳概括", "essay"),
        ],
    )
    # 同一题 3 次 completed grading record
    for _ in range(3):
        _seed_grading_record(
            s.database_url, user_id=user_id, question_id=qids[0], status="completed"
        )

    resp = c.get("/api/v2/essay/categories")
    assert resp.status_code == 200
    body = resp.json()
    by_type = {it["topType"]: it for it in body["categories"]}
    assert by_type["归纳概括"]["total"] == 1
    # distinct 防止 3 次 record 被算成 done=3
    assert by_type["归纳概括"]["doneByUser"] == 1


def test_essay_categories_null_subtype_excluded(client) -> None:
    """canonical_subtype IS NULL 的 essay 题不进 categories."""
    c, s = client
    _seed_essay_paper(
        s.database_url,
        paper_code="ESSAY-D",
        paper_name="D",
        questions=[
            ("题 1", "归纳概括", "essay"),
            ("题 2", None, "essay"),  # subtype NULL → 跳过
        ],
    )

    resp = c.get("/api/v2/essay/categories")
    assert resp.status_code == 200
    body = resp.json()
    by_type = {it["topType"]: it for it in body["categories"]}
    # NULL subtype 题不进 总数 (只 1 题进 归纳概括)
    assert by_type["归纳概括"]["total"] == 1
    # 6 行总和 = 1
    assert sum(it["total"] for it in body["categories"]) == 1


def test_essay_categories_excludes_xingce_questions(client) -> None:
    """question_kind != 'essay' (行测) 的题不进 categories."""
    c, s = client
    _seed_essay_paper(
        s.database_url,
        paper_code="MIXED-1",
        paper_name="混合卷",
        questions=[
            ("申论题 1", "归纳概括", "essay"),
            ("行测题 1", "归纳概括", "single_choice"),  # 同 subtype 但 kind 不同 → 跳
        ],
    )

    resp = c.get("/api/v2/essay/categories")
    assert resp.status_code == 200
    body = resp.json()
    by_type = {it["topType"]: it for it in body["categories"]}
    # 只 essay kind 计入 (行测题虽 canonical_subtype='归纳概括' 但 kind 不对)
    assert by_type["归纳概括"]["total"] == 1
