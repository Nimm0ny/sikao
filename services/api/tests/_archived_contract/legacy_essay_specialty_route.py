"""Phase D — GET /api/v2/essay/specialty/questions integration tests.

Covers:
  - subtype filter (5 大类各自)
  - paginate (page/page_size)
  - last_answered_at (LEFT JOIN essay_grading_records, completed status only)
  - 跨 paper 排序 (year DESC NULLS LAST → paper_code → position)
  - 401 unauthenticated
  - 422 page/page_size 越界
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
    exam_year: int | None,
    questions: list[tuple[str, str, dict | None]],
) -> list[int]:
    """Seed one paper + revision + N essay questions.

    questions = [(stem_text, canonical_subtype, type_payload), ...].
    Returns list of question.id in order.
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
            exam_year=exam_year,
            source_hash=f"hash_{paper_code}",
            is_published=True,
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
        for i, (stem, subtype, payload) in enumerate(questions):
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
                source_uuid=f"essay_{paper_code}_{i}",
                question_kind="essay",
                subtype_name=subtype,
                stem_text=stem,
                answer_text="",
                renderer_key="essay",
                exam_year=exam_year,
                is_gradable=False,
                enabled=True,
                canonical_top_type="申论",
                canonical_subtype=subtype,
                type_payload_json=payload or {},
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
    created_at: datetime | None = None,
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
            created_at=created_at or datetime.now(UTC).replace(tzinfo=None),
        )
        db.add(record)
        db.commit()
        db.flush()
        return record.id
    finally:
        db.close()


# ── Tests ───────────────────────────────────────────────────────────────────


def test_specialty_unauthenticated_401(client) -> None:
    c, _ = client
    resp = c.get("/api/v2/essay/specialty/questions?subtype=归纳概括")
    assert resp.status_code == 401


def test_specialty_filter_by_subtype(client) -> None:
    c, settings = client
    _register(c)
    # Seed 1 paper, 3 questions (2 归纳概括 + 1 大作文)
    _seed_essay_paper(
        settings.database_url,
        paper_code="ESSAY-2024-01",
        paper_name="2024 申论",
        exam_year=2024,
        questions=[
            ("根据资料 1, 概括 H 市做法.", "归纳概括", {"wordLimitMax": 300, "fullScore": 15}),
            ("根据资料 2, 归纳概括 J 县经验.", "归纳概括", {"wordLimitMax": 250}),
            ("以 '治理之路' 为题写一篇文章.", "大作文", {"wordLimitMax": 1000, "fullScore": 40}),
        ],
    )

    # 归纳概括 → 2 题
    resp = c.get("/api/v2/essay/specialty/questions?subtype=归纳概括")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 2
    assert body["page"] == 1
    assert body["pageSize"] == 20
    assert len(body["items"]) == 2
    assert all(item["paperCode"] == "ESSAY-2024-01" for item in body["items"])
    assert body["items"][0]["wordRequirement"] == "≤ 300 字"
    assert body["items"][0]["fullScore"] == 15
    assert body["items"][1]["wordRequirement"] == "≤ 250 字"
    assert body["items"][1]["fullScore"] is None  # payload 缺 fullScore
    assert body["items"][0]["lastAnsweredAt"] is None  # 未练

    # 大作文 → 1 题
    resp = c.get("/api/v2/essay/specialty/questions?subtype=大作文")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert len(body["items"]) == 1
    assert body["items"][0]["fullScore"] == 40

    # 综合分析 (库里没题) → empty list, 不 404
    resp = c.get("/api/v2/essay/specialty/questions?subtype=综合分析")
    assert resp.status_code == 200
    assert resp.json() == {"items": [], "total": 0, "page": 1, "pageSize": 20}


def test_specialty_pagination(client) -> None:
    c, settings = client
    _register(c)
    # Seed 5 归纳概括 题
    _seed_essay_paper(
        settings.database_url,
        paper_code="ESSAY-2023-01",
        paper_name="2023 申论",
        exam_year=2023,
        questions=[
            (f"题 {i}", "归纳概括", {"wordLimitMax": 200})
            for i in range(5)
        ],
    )

    # page_size=2 → 5 题分 3 页 (2/2/1)
    resp = c.get(
        "/api/v2/essay/specialty/questions?subtype=归纳概括&page=1&pageSize=2"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 5
    assert body["page"] == 1
    assert body["pageSize"] == 2
    assert len(body["items"]) == 2

    resp = c.get(
        "/api/v2/essay/specialty/questions?subtype=归纳概括&page=3&pageSize=2"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["page"] == 3
    assert len(body["items"]) == 1

    # page=0 → 422 (Query ge=1)
    resp = c.get(
        "/api/v2/essay/specialty/questions?subtype=归纳概括&page=0"
    )
    assert resp.status_code == 422

    # pageSize=51 → 422 (le=50)
    resp = c.get(
        "/api/v2/essay/specialty/questions?subtype=归纳概括&pageSize=51"
    )
    assert resp.status_code == 422


def test_specialty_last_answered_at_marks_user_grading(client) -> None:
    c, settings = client
    user_id = _register(c)
    qids = _seed_essay_paper(
        settings.database_url,
        paper_code="ESSAY-2025-01",
        paper_name="2025 申论",
        exam_year=2025,
        questions=[
            ("题 A", "归纳概括", None),
            ("题 B", "归纳概括", None),
        ],
    )
    # qids[0] 当前 user 已答 (status=completed)
    _seed_grading_record(
        settings.database_url,
        user_id=user_id,
        question_id=qids[0],
        status="completed",
    )
    # qids[1] 当前 user 答过但 pending — 不应算"已练"
    _seed_grading_record(
        settings.database_url,
        user_id=user_id,
        question_id=qids[1],
        status="pending",
    )

    resp = c.get("/api/v2/essay/specialty/questions?subtype=归纳概括")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    by_id = {item["questionId"]: item for item in body["items"]}
    assert by_id[qids[0]]["lastAnsweredAt"] is not None
    assert by_id[qids[1]]["lastAnsweredAt"] is None  # pending 不算


def test_specialty_cross_paper_sort_year_desc_nulls_last(client) -> None:
    c, settings = client
    _register(c)
    # 3 张卷: 2024 / 2025 / NULL year
    _seed_essay_paper(
        settings.database_url,
        paper_code="ESSAY-A",
        paper_name="A",
        exam_year=2024,
        questions=[("题 A", "大作文", None)],
    )
    _seed_essay_paper(
        settings.database_url,
        paper_code="ESSAY-B",
        paper_name="B",
        exam_year=2025,
        questions=[("题 B", "大作文", None)],
    )
    _seed_essay_paper(
        settings.database_url,
        paper_code="ESSAY-C",
        paper_name="C",
        exam_year=None,
        questions=[("题 C", "大作文", None)],
    )

    resp = c.get("/api/v2/essay/specialty/questions?subtype=大作文")
    assert resp.status_code == 200
    items = resp.json()["items"]
    # year DESC NULLS LAST: 2025 → 2024 → NULL
    assert [item["paperCode"] for item in items] == ["ESSAY-B", "ESSAY-A", "ESSAY-C"]


def test_specialty_subtype_multi_value(client) -> None:
    """规范官 P0-3 2026-05-08: subtype 接受逗号分隔多值, IN 查询合并.

    场景: 前端 '公文 · 应用文' chip 传 'subtype=公文,应用文', 后端把两类
    合并返回 (避免单值 '公文' 导致应用文 ~100 题 silently 丢失).
    """
    c, settings = client
    _register(c)
    # Seed: 1 卷 4 题 (1 公文 + 1 应用文 + 1 大作文 + 1 归纳概括)
    _seed_essay_paper(
        settings.database_url,
        paper_code="ESSAY-MULTI-01",
        paper_name="2024 申论 · multi",
        exam_year=2024,
        questions=[
            ("起草 X 通知", "公文", {"wordLimitMax": 400}),
            ("写一份 Y 倡议书", "应用文", {"wordLimitMax": 350}),
            ("以 Z 为题写文章", "大作文", {"wordLimitMax": 1000}),
            ("概括 W 经验", "归纳概括", {"wordLimitMax": 200}),
        ],
    )
    # 单值 公文 → 1 题
    resp = c.get("/api/v2/essay/specialty/questions?subtype=公文")
    assert resp.status_code == 200
    assert resp.json()["total"] == 1

    # 单值 应用文 → 1 题
    resp = c.get("/api/v2/essay/specialty/questions?subtype=应用文")
    assert resp.status_code == 200
    assert resp.json()["total"] == 1

    # 多值 公文,应用文 → 2 题 (合并)
    resp = c.get("/api/v2/essay/specialty/questions?subtype=公文,应用文")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    subtypes_in_body = {item["paperCode"] for item in body["items"]}
    assert subtypes_in_body == {"ESSAY-MULTI-01"}
    # 题序: paper_code asc → position asc (跟 list_specialty_questions doc 一致)
    # 公文 position=1, 应用文 position=2
    assert [item["position"] for item in body["items"]] == [1, 2]

    # 多值带空白 (公文 ,  应用文) — strip 后仍合法
    resp = c.get("/api/v2/essay/specialty/questions?subtype=公文,%20%20应用文")
    assert resp.status_code == 200
    assert resp.json()["total"] == 2

    # 全空白逗号 → 422
    resp = c.get("/api/v2/essay/specialty/questions?subtype=,,,")
    assert resp.status_code == 422


def test_specialty_stem_truncation(client) -> None:
    c, settings = client
    _register(c)
    long_stem = "<p>" + "啊" * 300 + "</p>"  # 300 中文字 + html tag
    _seed_essay_paper(
        settings.database_url,
        paper_code="ESSAY-LONG",
        paper_name="L",
        exam_year=2024,
        questions=[(long_stem, "归纳概括", None)],
    )

    resp = c.get("/api/v2/essay/specialty/questions?subtype=归纳概括")
    assert resp.status_code == 200
    item = resp.json()["items"][0]
    # html stripped + 截 200 + "…" 后缀
    assert "<p>" not in item["stem"]
    assert "</p>" not in item["stem"]
    assert item["stem"].endswith("…")
    assert len(item["stem"]) == 201  # 200 char + "…"
