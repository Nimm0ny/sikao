"""SIKAO Wave 4 Phase 2C — essay-specialty 聚合 endpoint integration tests.

Covers:
  - GET /api/v2/papers/essay/specialty/summary
    - 空 user 全 0 + resume None
    - 有 completed grading record → practiced/avg/streak/weekDone 都生效
    - resume 取最近一条 grading 的 subtype
    - 401 unauthenticated
    - cross-user isolation
  - GET /api/v2/papers/essay/specialty/categories
    - 6 raw 类返回 (FE 合并显 5 卡)
    - 子行三态 (done / progress / pending)
    - 匿名 status 全 pending
    - 空类 state='empty'
  - GET /api/v2/papers/essay/list/extended
    - 扩字段全部出现 (region / track / difficulty / status / progress / lastAttempt / pinned)
    - region filter (国考 / 省考 / source_provider)
    - year filter
    - pageSize 越界 422
    - sort: default / year / recent
  - GET /api/v2/papers/essay/filters
    - 返 distinct regions / years / paperTypes
    - 派生 "国考" / "省考" 出现条件
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from decimal import Decimal
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


def _logout(c: TestClient) -> None:
    """Clear cookies to simulate anonymous user."""
    c.cookies.clear()


def _seed_essay_paper(
    database_url: str,
    *,
    paper_code: str,
    paper_name: str,
    exam_year: int | None,
    source_provider: str | None = None,
    source_kind: str | None = None,
    sort_order: int = 1,
    questions: list[tuple[str, str, dict | None]] | None = None,
) -> list[int]:
    """Seed one paper + revision + N essay questions.

    questions = [(stem_text, canonical_subtype, type_payload), ...].
    Returns list of question.id in order.
    """
    if questions is None:
        questions = []
    engine = create_engine(database_url, future=True)
    SessionLocal = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False, future=True
    )
    db = SessionLocal()
    try:
        paper = Paper(
            paper_code=paper_code,
            paper_name=paper_name,
            exam_year=exam_year,
            source_provider=source_provider,
            source_kind=source_kind,
        )
        db.add(paper)
        db.flush()
        revision = PaperRevision(
            paper_id=paper.id,
            revision_number=1,
            sort_order=sort_order,
            paper_name=paper_name,
            question_count=len(questions),
            exam_year=exam_year,
            source_provider=source_provider,
            source_kind=source_kind,
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
    score: float | None = None,
    created_at: datetime | None = None,
    graded_at: datetime | None = None,
) -> int:
    engine = create_engine(database_url, future=True)
    SessionLocal = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False, future=True
    )
    db = SessionLocal()
    try:
        now_naive = datetime.now(UTC).replace(tzinfo=None)
        record = EssayGradingRecord(
            user_id=user_id,
            question_id=question_id,
            answer_text="my answer",
            status=status,
            score=Decimal(str(score)) if score is not None else None,
            created_at=created_at or now_naive,
            graded_at=graded_at if status == "completed" else None,
        )
        db.add(record)
        db.commit()
        return record.id
    finally:
        db.close()


# ────────────────────────────────────────────────────────────────────────────
# /summary tests
# ────────────────────────────────────────────────────────────────────────────


def test_summary_unauthenticated_401(client) -> None:
    c, _ = client
    resp = c.get("/api/v2/papers/essay/specialty/summary")
    assert resp.status_code == 401


def test_summary_empty_user_zero_totals_no_resume(client) -> None:
    c, settings = client
    _register(c)
    # Seed essay paper but user has no grading
    _seed_essay_paper(
        settings.database_url,
        paper_code="ESSAY-2024-EMPTY",
        paper_name="2024 申论 (空用户测)",
        exam_year=2024,
        questions=[
            ("题 A", "归纳概括", {"wordLimitMax": 200}),
            ("题 B", "大作文", {"wordLimitMax": 1000}),
        ],
    )

    resp = c.get("/api/v2/papers/essay/specialty/summary")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["totals"]["practiced"] == 0
    assert body["totals"]["total"] == 2  # 2 public essay questions
    assert body["totals"]["streakDays"] == 0
    assert body["totals"]["weekDone"] == 0
    assert body["totals"]["avgScore"] == 0.0
    assert body["resume"] is None


def test_summary_with_completed_records(client) -> None:
    c, settings = client
    user_id = _register(c)
    qids = _seed_essay_paper(
        settings.database_url,
        paper_code="ESSAY-2024-A",
        paper_name="2024 申论 A",
        exam_year=2024,
        questions=[
            ("题 A", "归纳概括", {"wordLimitMax": 200}),
            ("题 B", "大作文", {"wordLimitMax": 1000}),
            ("题 C", "综合分析", {"wordLimitMax": 300}),
        ],
    )
    now = datetime.now(UTC).replace(tzinfo=None)
    # 1 completed @ 75 today
    _seed_grading_record(
        settings.database_url,
        user_id=user_id,
        question_id=qids[0],
        status="completed",
        score=75.0,
        graded_at=now - timedelta(hours=1),
    )
    # 1 completed @ 85 yesterday
    _seed_grading_record(
        settings.database_url,
        user_id=user_id,
        question_id=qids[1],
        status="completed",
        score=85.0,
        graded_at=now - timedelta(days=1),
    )
    # 1 pending (qids[2])
    _seed_grading_record(
        settings.database_url,
        user_id=user_id,
        question_id=qids[2],
        status="pending",
    )

    resp = c.get("/api/v2/papers/essay/specialty/summary")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    totals = body["totals"]
    assert totals["practiced"] == 2  # qids[0], qids[1] both completed (distinct)
    assert totals["total"] == 3  # 3 public essay questions
    assert totals["weekDone"] == 2  # 2 completed within last 7d
    assert totals["avgScore"] == pytest.approx(80.0)
    # streak depends on Asia/Shanghai local-day boundary; "now - 1h" UTC can land
    # in either "today" or "yesterday" local. We assert non-negative + ≤ 2 days.
    assert 0 <= totals["streakDays"] <= 2

    # resume should be set (latest grading is qids[2] = 综合分析 pending)
    resume = body["resume"]
    assert resume is not None
    assert resume["typeName"] == "综合分析"
    assert resume["questionId"] == qids[2]
    assert resume["qTotal"] == 1
    # last_scores: 2 completed (新到旧)
    assert len(resume["lastScores"]) == 2
    assert resume["weekGoal"] == [2, 7]


def test_summary_cross_user_isolation(client) -> None:
    c, settings = client
    alice_id = _register(c, username="alice")
    qids = _seed_essay_paper(
        settings.database_url,
        paper_code="ESSAY-ISO",
        paper_name="2023 隔离测",
        exam_year=2023,
        questions=[("题", "归纳概括", None)],
    )
    # Alice records
    _seed_grading_record(
        settings.database_url,
        user_id=alice_id,
        question_id=qids[0],
        status="completed",
        score=90.0,
        graded_at=datetime.now(UTC).replace(tzinfo=None),
    )

    # Switch to Bob (new user) — logout + register
    _logout(c)
    _register(c, username="bob")
    resp = c.get("/api/v2/papers/essay/specialty/summary")
    assert resp.status_code == 200
    body = resp.json()
    assert body["totals"]["practiced"] == 0
    assert body["totals"]["avgScore"] == 0.0
    assert body["resume"] is None


# ────────────────────────────────────────────────────────────────────────────
# /categories tests
# ────────────────────────────────────────────────────────────────────────────


def test_categories_returns_6_raw_categories(client) -> None:
    """Backend returns 6 raw (公文+应用文 split); FE merges to 5 visual cards."""
    c, settings = client
    _register(c)
    _seed_essay_paper(
        settings.database_url,
        paper_code="ESSAY-CAT",
        paper_name="2024 cat",
        exam_year=2024,
        questions=[
            ("a", "归纳概括", None),
            ("b", "大作文", None),
        ],
    )
    resp = c.get("/api/v2/papers/essay/specialty/categories")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["cats"]) == 6
    cat_ids = [c["id"] for c in body["cats"]]
    assert cat_ids == [
        "归纳概括",
        "综合分析",
        "提出对策",
        "公文",
        "应用文",
        "大作文",
    ]
    # Each cat has idx 1-6
    for i, cat in enumerate(body["cats"], start=1):
        assert cat["idx"] == i


def test_categories_empty_state_when_total_zero(client) -> None:
    c, settings = client
    _register(c)
    # Only seed 归纳概括 / 大作文 → 公文 / 应用文 / 综合分析 / 提出对策 should be empty
    _seed_essay_paper(
        settings.database_url,
        paper_code="ESSAY-EMPTY",
        paper_name="2024 empty",
        exam_year=2024,
        questions=[
            ("a", "归纳概括", None),
            ("b", "大作文", None),
        ],
    )
    resp = c.get("/api/v2/papers/essay/specialty/categories")
    body = resp.json()
    by_id = {c["id"]: c for c in body["cats"]}
    assert by_id["归纳概括"]["state"] is None
    assert by_id["归纳概括"]["total"] == 1
    assert by_id["公文"]["state"] == "empty"
    assert by_id["公文"]["total"] == 0
    assert by_id["应用文"]["state"] == "empty"


def test_categories_subtype_status_three_states(client) -> None:
    c, settings = client
    user_id = _register(c)
    qids = _seed_essay_paper(
        settings.database_url,
        paper_code="ESSAY-STATUS",
        paper_name="2024 status",
        exam_year=2024,
        questions=[
            ("a", "归纳概括", None),
            ("b", "归纳概括", None),
            ("c", "归纳概括", None),
        ],
    )
    # q[0] completed → 'done'
    _seed_grading_record(
        settings.database_url,
        user_id=user_id,
        question_id=qids[0],
        status="completed",
        score=80.0,
        graded_at=datetime.now(UTC).replace(tzinfo=None),
    )
    # q[1] pending → 'progress'
    _seed_grading_record(
        settings.database_url,
        user_id=user_id,
        question_id=qids[1],
        status="pending",
    )
    # q[2] no record → 'pending'

    resp = c.get("/api/v2/papers/essay/specialty/categories")
    body = resp.json()
    cat = next(c for c in body["cats"] if c["id"] == "归纳概括")
    assert cat["total"] == 3
    assert cat["practiced"] == 1  # q[0] only
    assert cat["overallProgress"] == pytest.approx(1 / 3, abs=0.01)
    status_by_qid = {row["questionId"]: row["status"] for row in cat["subTypes"]}
    assert status_by_qid[qids[0]] == "done"
    assert status_by_qid[qids[1]] == "progress"
    assert status_by_qid[qids[2]] == "pending"


def test_categories_anonymous_all_pending(client) -> None:
    c, settings = client
    _seed_essay_paper(
        settings.database_url,
        paper_code="ESSAY-ANON",
        paper_name="2024",
        exam_year=2024,
        questions=[("a", "归纳概括", None)],
    )
    # Anonymous call (no register)
    resp = c.get("/api/v2/papers/essay/specialty/categories")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    cat = next(c for c in body["cats"] if c["id"] == "归纳概括")
    assert cat["practiced"] == 0
    assert all(row["status"] == "pending" for row in cat["subTypes"])


# ────────────────────────────────────────────────────────────────────────────
# /list/extended tests
# ────────────────────────────────────────────────────────────────────────────


def test_list_extended_unauthenticated_401(client) -> None:
    c, _ = client
    resp = c.get("/api/v2/papers/essay/list/extended")
    assert resp.status_code == 401


def test_list_extended_returns_extended_fields(client) -> None:
    c, settings = client
    user_id = _register(c)
    qids = _seed_essay_paper(
        settings.database_url,
        paper_code="GUOKAO-2024-01",
        paper_name="2024 国考申论",
        exam_year=2024,
        source_provider="fenbi",
        source_kind="真题",
        questions=[
            ("a", "归纳概括", None),
            ("b", "综合分析", None),
            ("c", "大作文", None),
        ],
    )
    # Mark q[0] as completed
    _seed_grading_record(
        settings.database_url,
        user_id=user_id,
        question_id=qids[0],
        status="completed",
        score=78.5,
        graded_at=datetime.now(UTC).replace(tzinfo=None),
    )

    resp = c.get("/api/v2/papers/essay/list/extended")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 1
    assert len(body["items"]) == 1
    item = body["items"][0]
    # 扩字段断言
    assert item["region"] == "国考"  # 派生自 paper_code GUOKAO
    assert item["track"] == "sk"
    assert item["difficulty"] == 1  # 3 题 ≤ 3 → 1
    assert item["progress"] == "1/3"  # 1 题 done / 3 total
    assert item["status"] == "doing"
    assert item["pinned"] is False
    assert item["lastAttempt"] is not None
    assert item["lastAttempt"]["score"] == 78.5
    assert item["sourceKind"] == "真题"


def test_list_extended_filter_by_region(client) -> None:
    c, settings = client
    _register(c)
    _seed_essay_paper(
        settings.database_url,
        paper_code="GUOKAO-2024-01",
        paper_name="国考",
        exam_year=2024,
        source_provider="fenbi",
        sort_order=10,
        questions=[("a", "归纳概括", None)],
    )
    _seed_essay_paper(
        settings.database_url,
        paper_code="SHENGKAO-2024-01",
        paper_name="省考",
        exam_year=2024,
        source_provider="fenbi",
        sort_order=9,
        questions=[("a", "归纳概括", None)],
    )

    # 国考 filter
    resp = c.get("/api/v2/papers/essay/list/extended?region=国考")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["paperCode"] == "GUOKAO-2024-01"

    # 省考 filter
    resp = c.get("/api/v2/papers/essay/list/extended?region=省考")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["paperCode"] == "SHENGKAO-2024-01"

    # 全部 (no filter)
    resp = c.get("/api/v2/papers/essay/list/extended")
    assert resp.json()["total"] == 2


def test_list_extended_filter_by_year(client) -> None:
    c, settings = client
    _register(c)
    _seed_essay_paper(
        settings.database_url,
        paper_code="ESSAY-2024-Y",
        paper_name="2024",
        exam_year=2024,
        sort_order=2,
        questions=[("a", "归纳概括", None)],
    )
    _seed_essay_paper(
        settings.database_url,
        paper_code="ESSAY-2023-Y",
        paper_name="2023",
        exam_year=2023,
        sort_order=1,
        questions=[("a", "归纳概括", None)],
    )

    resp = c.get("/api/v2/papers/essay/list/extended?year=2024")
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["paperCode"] == "ESSAY-2024-Y"


def test_list_extended_pagination_422(client) -> None:
    c, _ = client
    _register(c)
    # pageSize=51 → 422
    resp = c.get("/api/v2/papers/essay/list/extended?pageSize=51")
    assert resp.status_code == 422
    # page=0 → 422
    resp = c.get("/api/v2/papers/essay/list/extended?page=0")
    assert resp.status_code == 422


def test_list_extended_sort_year_desc(client) -> None:
    c, settings = client
    _register(c)
    _seed_essay_paper(
        settings.database_url,
        paper_code="ESSAY-OLD",
        paper_name="2020 essay",
        exam_year=2020,
        sort_order=10,
        questions=[("a", "归纳概括", None)],
    )
    _seed_essay_paper(
        settings.database_url,
        paper_code="ESSAY-NEW",
        paper_name="2024 essay",
        exam_year=2024,
        sort_order=1,  # 故意低, 验证 sort=year 时按 year DESC 而非 sort_order
        questions=[("a", "归纳概括", None)],
    )
    resp = c.get("/api/v2/papers/essay/list/extended?sort=year")
    body = resp.json()
    codes = [item["paperCode"] for item in body["items"]]
    assert codes == ["ESSAY-NEW", "ESSAY-OLD"]


# ────────────────────────────────────────────────────────────────────────────
# /filters tests
# ────────────────────────────────────────────────────────────────────────────


def test_filters_returns_distinct_metadata(client) -> None:
    c, settings = client
    _register(c)
    _seed_essay_paper(
        settings.database_url,
        paper_code="GUOKAO-2024-F1",
        paper_name="p1",
        exam_year=2024,
        source_provider="fenbi",
        source_kind="真题",
        questions=[("a", "归纳概括", None)],
    )
    _seed_essay_paper(
        settings.database_url,
        paper_code="GUOKAO-2023-F2",
        paper_name="p2",
        exam_year=2023,
        source_provider="aipta",
        source_kind="模考",
        questions=[("a", "归纳概括", None)],
    )

    resp = c.get("/api/v2/papers/essay/filters")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # years DESC
    assert body["years"] == [2024, 2023]
    # paperTypes sorted
    assert sorted(body["paperTypes"]) == sorted(["真题", "模考"])
    # 国考 派生出现 + provider distinct
    assert "国考" in body["regions"]
    assert "fenbi" in body["regions"]
    assert "aipta" in body["regions"]


def test_filters_no_guokao_no_derived_bucket(client) -> None:
    """若 paper_code 不含 GUOKAO/GK, "国考" 不出现在 regions."""
    c, settings = client
    _register(c)
    _seed_essay_paper(
        settings.database_url,
        paper_code="OTHER-2024",
        paper_name="other",
        exam_year=2024,
        source_provider="aipta",
        source_kind="模考",
        questions=[("a", "归纳概括", None)],
    )
    resp = c.get("/api/v2/papers/essay/filters")
    body = resp.json()
    assert "国考" not in body["regions"]
    assert "省考" not in body["regions"]
    assert "aipta" in body["regions"]


def test_filters_anonymous_allowed(client) -> None:
    """filters endpoint 不需登录."""
    c, settings = client
    _seed_essay_paper(
        settings.database_url,
        paper_code="ESSAY-ANON-F",
        paper_name="anon",
        exam_year=2024,
        source_provider="fenbi",
        source_kind="真题",
        questions=[("a", "归纳概括", None)],
    )
    # No register
    resp = c.get("/api/v2/papers/essay/filters")
    assert resp.status_code == 200
    body = resp.json()
    assert body["years"] == [2024]


# ────────────────────────────────────────────────────────────────────────────
# Edge case: hidden / disabled questions excluded
# ────────────────────────────────────────────────────────────────────────────


def test_hidden_revision_excluded_from_summary(client) -> None:
    """visible_in_public=False revision 不进 total count."""
    c, settings = client
    _register(c)
    engine = create_engine(settings.database_url, future=True)
    SessionLocal = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False, future=True
    )
    db = SessionLocal()
    try:
        paper = Paper(paper_code="HIDDEN", paper_name="hidden")
        db.add(paper)
        db.flush()
        revision = PaperRevision(
            paper_id=paper.id,
            revision_number=1,
            sort_order=1,
            paper_name="hidden",
            question_count=1,
            source_hash="hash_hidden",
            visible_in_public=False,  # 隐藏
            is_published=True,
        )
        db.add(revision)
        db.flush()
        paper.current_revision_id = revision.id
        section = PaperSection(
            paper_revision_id=revision.id,
            section_key="S1",
            title="申论",
            instruction_text="",
            display_order=1,
            question_count=1,
        )
        db.add(section)
        db.flush()
        block = PaperBlock(
            paper_revision_id=revision.id,
            section_id=section.id,
            block_type="question",
            display_order=1,
        )
        db.add(block)
        db.flush()
        q = Question(
            paper_revision_id=revision.id,
            section_id=section.id,
            block_id=block.id,
            position=1,
            source_uuid="hidden_q",
            question_kind="essay",
            subtype_name="归纳概括",
            stem_text="hidden q",
            answer_text="",
            renderer_key="essay",
            is_gradable=False,
            enabled=True,
            canonical_top_type="申论",
            canonical_subtype="归纳概括",
            type_payload_json={},
        )
        db.add(q)
        db.commit()
    finally:
        db.close()

    resp = c.get("/api/v2/papers/essay/specialty/summary")
    assert resp.status_code == 200
    # hidden revision should not count
    assert resp.json()["totals"]["total"] == 0
