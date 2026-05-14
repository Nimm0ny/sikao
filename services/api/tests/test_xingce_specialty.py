"""SIKAO 行测 specialty 4 endpoint integration tests (mirror test_essay_specialty.py).

Covers:
  - GET /api/v2/papers/xingce/specialty/summary
    - 401 unauthenticated
    - 空 user 全 0 + resume None
    - 有 PracticeSessionAnswer → practiced/avg/streak/weekDone 都生效
    - resume 取最近一条 answer 所属 5 大类 (keyword bucket)
    - cross-user isolation
  - GET /api/v2/papers/xingce/specialty/categories
    - 5 类返回 (固定顺序 yanyu/panduan/shuliang/ziliao/changshi)
    - 子行 done / pending 二态 (progress 当前 stub 不触)
    - 匿名 status 全 pending
    - 空类 state='empty'
    - keyword bucket: 图形推理 → 判断推理 / 公共基础知识 → 常识判断
    - 跨类 priority: 言语理解与表达 → yanyu, 不漂到其他
  - GET /api/v2/papers/xingce/list/extended
    - 扩字段全部出现 (region / track='gk' / difficulty / status / progress / lastAttempt / pinned)
    - region filter (国考 / 省考)
    - year filter
    - pageSize 越界 422
    - sort year DESC
  - GET /api/v2/papers/xingce/filters
    - 返 distinct regions / years / paperTypes
    - 派生 "国考" / "省考" 出现条件
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
    c.cookies.clear()


def _seed_xingce_paper(
    database_url: str,
    *,
    paper_code: str,
    paper_name: str,
    exam_year: int | None,
    source_provider: str | None = None,
    source_kind: str | None = None,
    sort_order: int = 1,
    questions: list[tuple[str, str]] | None = None,
) -> tuple[int, int, list[int]]:
    """Seed one paper + revision + N 行测 questions (question_kind='single_choice').

    questions = [(stem_text, canonical_subtype), ...].
    Returns (paper_id, revision_id, [question_id, ...]).
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
            title="行测",
            instruction_text="",
            display_order=1,
            question_count=len(questions),
        )
        db.add(section)
        db.flush()
        qids: list[int] = []
        for i, (stem, subtype) in enumerate(questions):
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
                source_uuid=f"xingce_{paper_code}_{i}",
                question_kind="single_choice",
                subtype_name=subtype,
                stem_text=stem,
                answer_text="A",
                renderer_key="single_choice",
                exam_year=exam_year,
                is_gradable=True,
                enabled=True,
                canonical_top_type="行测",
                canonical_subtype=subtype,
            )
            db.add(q)
            db.flush()
            qids.append(q.id)
        db.commit()
        return paper.id, revision.id, qids
    finally:
        db.close()


def _seed_practice_answer(
    database_url: str,
    *,
    user_id: int,
    paper_id: int,
    revision_id: int,
    question_id: int,
    is_correct: bool = True,
    answered_at: datetime | None = None,
    completed: bool = False,
    session_id: int | None = None,
) -> int:
    """Seed one PracticeSession + PracticeSessionAnswer.

    If session_id given, reuse that session (don't create new). Otherwise creates new
    session + one answer.

    Returns the session_id (created or reused).
    """
    engine = create_engine(database_url, future=True)
    SessionLocal = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False, future=True
    )
    db = SessionLocal()
    try:
        now_naive = datetime.now(UTC).replace(tzinfo=None)
        if session_id is None:
            sess = PracticeSession(
                mode="paper",
                user_id=user_id,
                paper_id=paper_id,
                paper_revision_id=revision_id,
                started_at=now_naive,
                completed_at=now_naive if completed else None,
                total_questions=1,
            )
            db.add(sess)
            db.flush()
            session_id = sess.id
        else:
            # validate exists
            sess = db.get(PracticeSession, session_id)
            assert sess is not None
            if completed and sess.completed_at is None:
                sess.completed_at = now_naive

        # get next display_order in this session
        existing = (
            db.query(PracticeSessionAnswer)
            .filter(PracticeSessionAnswer.session_id == session_id)
            .count()
        )
        ans = PracticeSessionAnswer(
            session_id=session_id,
            question_id=question_id,
            display_order=existing + 1,
            selected_answer="A" if is_correct else "B",
            correct_answer_snapshot="A",
            is_correct=is_correct,
            answered_at=answered_at or now_naive,
        )
        db.add(ans)
        db.commit()
        return int(session_id)
    finally:
        db.close()


# ────────────────────────────────────────────────────────────────────────────
# /summary tests
# ────────────────────────────────────────────────────────────────────────────


def test_summary_unauthenticated_401(client) -> None:
    c, _ = client
    resp = c.get("/api/v2/papers/xingce/specialty/summary")
    assert resp.status_code == 401


def test_summary_empty_user_zero_totals_no_resume(client) -> None:
    c, settings = client
    _register(c)
    _seed_xingce_paper(
        settings.database_url,
        paper_code="XINGCE-2024-EMPTY",
        paper_name="2024 行测 (空用户)",
        exam_year=2024,
        questions=[("题 A", "言语理解"), ("题 B", "判断推理")],
    )

    resp = c.get("/api/v2/papers/xingce/specialty/summary")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["totals"]["practiced"] == 0
    assert body["totals"]["total"] == 2
    assert body["totals"]["streakDays"] == 0
    assert body["totals"]["weekDone"] == 0
    assert body["totals"]["avgScore"] == 0.0
    assert body["resume"] is None


def test_summary_with_practice_answers(client) -> None:
    c, settings = client
    user_id = _register(c)
    _paper_id, revision_id, qids = _seed_xingce_paper(
        settings.database_url,
        paper_code="XINGCE-2024-A",
        paper_name="2024 行测 A",
        exam_year=2024,
        questions=[
            ("题 A", "言语理解"),
            ("题 B", "判断推理"),
            ("题 C", "数量关系"),
        ],
    )
    now = datetime.now(UTC).replace(tzinfo=None)
    # 2 correct, 1 wrong → 66.67% avg
    _seed_practice_answer(
        settings.database_url,
        user_id=user_id,
        paper_id=_paper_id,
        revision_id=revision_id,
        question_id=qids[0],
        is_correct=True,
        answered_at=now - timedelta(hours=1),
    )
    _seed_practice_answer(
        settings.database_url,
        user_id=user_id,
        paper_id=_paper_id,
        revision_id=revision_id,
        question_id=qids[1],
        is_correct=True,
        answered_at=now - timedelta(hours=2),
    )
    _seed_practice_answer(
        settings.database_url,
        user_id=user_id,
        paper_id=_paper_id,
        revision_id=revision_id,
        question_id=qids[2],
        is_correct=False,
        answered_at=now - timedelta(hours=3),
    )

    resp = c.get("/api/v2/papers/xingce/specialty/summary")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    totals = body["totals"]
    assert totals["practiced"] == 3
    assert totals["total"] == 3
    assert totals["weekDone"] == 3
    assert totals["avgScore"] == pytest.approx(66.67, abs=0.01)
    # streak: today only (UTC + 8h offset; tolerance 0-2 days for boundary)
    assert 0 <= totals["streakDays"] <= 2

    # resume: latest answer = qids[0] (now-1h), canonical_subtype="言语理解" → yanyu
    resume = body["resume"]
    assert resume is not None
    assert resume["typeName"] == "言语理解"
    assert resume["questionId"] == qids[0]
    assert resume["qTotal"] == 1  # only one 言语理解 question seeded
    # last_scores: 3 answers' is_correct → [100, 100, 0] (新到旧)
    assert resume["lastScores"] == [100.0, 100.0, 0.0]
    assert resume["weekGoal"] == [3, 7]


def test_summary_cross_user_isolation(client) -> None:
    c, settings = client
    alice_id = _register(c, username="alice")
    paper_id, revision_id, qids = _seed_xingce_paper(
        settings.database_url,
        paper_code="XINGCE-ISO",
        paper_name="2023 隔离测",
        exam_year=2023,
        questions=[("题", "言语理解")],
    )
    _seed_practice_answer(
        settings.database_url,
        user_id=alice_id,
        paper_id=paper_id,
        revision_id=revision_id,
        question_id=qids[0],
        is_correct=True,
        answered_at=datetime.now(UTC).replace(tzinfo=None),
    )

    # Switch to Bob
    _logout(c)
    _register(c, username="bob")
    resp = c.get("/api/v2/papers/xingce/specialty/summary")
    assert resp.status_code == 200
    body = resp.json()
    assert body["totals"]["practiced"] == 0
    assert body["totals"]["avgScore"] == 0.0
    assert body["resume"] is None


# ────────────────────────────────────────────────────────────────────────────
# /categories tests
# ────────────────────────────────────────────────────────────────────────────


def test_categories_returns_5_categories_fixed_order(client) -> None:
    c, settings = client
    _register(c)
    _seed_xingce_paper(
        settings.database_url,
        paper_code="XINGCE-CAT",
        paper_name="2024 cat",
        exam_year=2024,
        questions=[
            ("a", "言语理解"),
            ("b", "判断推理"),
        ],
    )
    resp = c.get("/api/v2/papers/xingce/specialty/categories")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["cats"]) == 5
    cat_ids = [c["id"] for c in body["cats"]]
    assert cat_ids == ["yanyu", "panduan", "shuliang", "ziliao", "changshi"]
    cat_names = [c["name"] for c in body["cats"]]
    assert cat_names == ["言语理解", "判断推理", "数量关系", "资料分析", "常识判断"]
    for i, cat in enumerate(body["cats"], start=1):
        assert cat["idx"] == i


def test_categories_empty_state_when_total_zero(client) -> None:
    c, settings = client
    _register(c)
    _seed_xingce_paper(
        settings.database_url,
        paper_code="XINGCE-EMPTY",
        paper_name="2024 empty",
        exam_year=2024,
        questions=[("a", "言语理解")],
    )
    resp = c.get("/api/v2/papers/xingce/specialty/categories")
    body = resp.json()
    by_id = {c["id"]: c for c in body["cats"]}
    assert by_id["yanyu"]["state"] is None
    assert by_id["yanyu"]["total"] == 1
    assert by_id["panduan"]["state"] == "empty"
    assert by_id["panduan"]["total"] == 0
    assert by_id["shuliang"]["state"] == "empty"


def test_categories_keyword_bucket_panduan_collects_subtypes(client) -> None:
    """图形推理 / 定义判断 / 类比推理 / 逻辑推理 应该全部归到 panduan."""
    c, settings = client
    _register(c)
    _seed_xingce_paper(
        settings.database_url,
        paper_code="XINGCE-PANDUAN",
        paper_name="2024 panduan",
        exam_year=2024,
        questions=[
            ("a", "图形推理"),
            ("b", "定义判断"),
            ("c", "类比推理"),
            ("d", "逻辑推理"),
        ],
    )
    resp = c.get("/api/v2/papers/xingce/specialty/categories")
    body = resp.json()
    panduan = next(c for c in body["cats"] if c["id"] == "panduan")
    assert panduan["total"] == 4  # all 4 collected
    yanyu = next(c for c in body["cats"] if c["id"] == "yanyu")
    assert yanyu["total"] == 0


def test_categories_keyword_bucket_changshi_vs_panduan(client) -> None:
    """常识判断 含 "判断" 但应归 changshi 不漂到 panduan."""
    c, settings = client
    _register(c)
    _seed_xingce_paper(
        settings.database_url,
        paper_code="XINGCE-CHANGSHI",
        paper_name="2024",
        exam_year=2024,
        questions=[
            ("a", "常识判断"),
            ("b", "公共基础知识"),
            ("c", "公共基础知识-单项选择题"),
        ],
    )
    resp = c.get("/api/v2/papers/xingce/specialty/categories")
    body = resp.json()
    changshi = next(c for c in body["cats"] if c["id"] == "changshi")
    panduan = next(c for c in body["cats"] if c["id"] == "panduan")
    # "常识判断" 命中 changshi keyword "常识" 早于 panduan "判断推理" (不是 "判断")
    assert changshi["total"] == 3
    assert panduan["total"] == 0


def test_categories_keyword_bucket_yanyu_variants(client) -> None:
    """言语理解 / 言语理解与表达 / 言语理解与表达能力 / 选词填空 / 段落阅读 → yanyu."""
    c, settings = client
    _register(c)
    _seed_xingce_paper(
        settings.database_url,
        paper_code="XINGCE-YANYU",
        paper_name="2024",
        exam_year=2024,
        questions=[
            ("a", "言语理解"),
            ("b", "言语理解与表达"),
            ("c", "言语理解与表达能力"),
            ("d", "选词填空"),
            ("e", "段落阅读"),
        ],
    )
    resp = c.get("/api/v2/papers/xingce/specialty/categories")
    body = resp.json()
    yanyu = next(c for c in body["cats"] if c["id"] == "yanyu")
    assert yanyu["total"] == 5


def test_categories_subtype_done_pending_two_states(client) -> None:
    """行测 progress 三态 stub 不触, 实测 done / pending 二态."""
    c, settings = client
    user_id = _register(c)
    paper_id, revision_id, qids = _seed_xingce_paper(
        settings.database_url,
        paper_code="XINGCE-STATUS",
        paper_name="2024 status",
        exam_year=2024,
        questions=[
            ("a", "言语理解"),
            ("b", "言语理解"),
            ("c", "言语理解"),
        ],
    )
    # q[0] answered → 'done'
    _seed_practice_answer(
        settings.database_url,
        user_id=user_id,
        paper_id=paper_id,
        revision_id=revision_id,
        question_id=qids[0],
        is_correct=True,
        answered_at=datetime.now(UTC).replace(tzinfo=None),
    )
    # q[1] / q[2] no answer → 'pending'

    resp = c.get("/api/v2/papers/xingce/specialty/categories")
    body = resp.json()
    cat = next(c for c in body["cats"] if c["id"] == "yanyu")
    assert cat["total"] == 3
    assert cat["practiced"] == 1
    assert cat["overallProgress"] == pytest.approx(1 / 3, abs=0.01)
    status_by_qid = {row["questionId"]: row["status"] for row in cat["subTypes"]}
    assert status_by_qid[qids[0]] == "done"
    assert status_by_qid[qids[1]] == "pending"
    assert status_by_qid[qids[2]] == "pending"


def test_categories_anonymous_all_pending(client) -> None:
    c, settings = client
    _seed_xingce_paper(
        settings.database_url,
        paper_code="XINGCE-ANON",
        paper_name="2024",
        exam_year=2024,
        questions=[("a", "言语理解")],
    )
    resp = c.get("/api/v2/papers/xingce/specialty/categories")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    cat = next(c for c in body["cats"] if c["id"] == "yanyu")
    assert cat["practiced"] == 0
    assert all(row["status"] == "pending" for row in cat["subTypes"])


# ────────────────────────────────────────────────────────────────────────────
# /list/extended tests
# ────────────────────────────────────────────────────────────────────────────


def test_list_extended_unauthenticated_401(client) -> None:
    c, _ = client
    resp = c.get("/api/v2/papers/xingce/list/extended")
    assert resp.status_code == 401


def test_list_extended_returns_extended_fields(client) -> None:
    c, settings = client
    user_id = _register(c)
    paper_id, revision_id, qids = _seed_xingce_paper(
        settings.database_url,
        paper_code="GUOKAO-2024-X01",
        paper_name="2024 国考行测",
        exam_year=2024,
        source_provider="fenbi",
        source_kind="真题",
        questions=[
            ("a", "言语理解"),
            ("b", "判断推理"),
            ("c", "数量关系"),
        ],
    )
    # 1 correct out of 3
    _seed_practice_answer(
        settings.database_url,
        user_id=user_id,
        paper_id=paper_id,
        revision_id=revision_id,
        question_id=qids[0],
        is_correct=True,
        answered_at=datetime.now(UTC).replace(tzinfo=None),
    )

    resp = c.get("/api/v2/papers/xingce/list/extended")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 1
    assert len(body["items"]) == 1
    item = body["items"][0]
    assert item["region"] == "国考"
    assert item["track"] == "gk"
    assert item["difficulty"] == 1  # 3 ≤ 30 → 1
    assert item["progress"] == "1/3"
    assert item["status"] == "doing"
    assert item["pinned"] is False
    assert item["lastAttempt"] is not None
    assert item["lastAttempt"]["score"] == 100.0  # 1/1 in this session = 100%
    assert item["sourceKind"] == "真题"


def test_list_extended_filter_by_region(client) -> None:
    c, settings = client
    _register(c)
    _seed_xingce_paper(
        settings.database_url,
        paper_code="GUOKAO-2024-X1",
        paper_name="国考",
        exam_year=2024,
        source_provider="fenbi",
        sort_order=10,
        questions=[("a", "言语理解")],
    )
    _seed_xingce_paper(
        settings.database_url,
        paper_code="SHENGKAO-2024-X1",
        paper_name="省考",
        exam_year=2024,
        source_provider="fenbi",
        sort_order=9,
        questions=[("a", "言语理解")],
    )

    resp = c.get("/api/v2/papers/xingce/list/extended?region=国考")
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["paperCode"] == "GUOKAO-2024-X1"

    resp = c.get("/api/v2/papers/xingce/list/extended?region=省考")
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["paperCode"] == "SHENGKAO-2024-X1"

    resp = c.get("/api/v2/papers/xingce/list/extended")
    assert resp.json()["total"] == 2


def test_list_extended_filter_by_year(client) -> None:
    c, settings = client
    _register(c)
    _seed_xingce_paper(
        settings.database_url,
        paper_code="XINGCE-2024-Y",
        paper_name="2024",
        exam_year=2024,
        sort_order=2,
        questions=[("a", "言语理解")],
    )
    _seed_xingce_paper(
        settings.database_url,
        paper_code="XINGCE-2023-Y",
        paper_name="2023",
        exam_year=2023,
        sort_order=1,
        questions=[("a", "言语理解")],
    )
    resp = c.get("/api/v2/papers/xingce/list/extended?year=2024")
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["paperCode"] == "XINGCE-2024-Y"


def test_list_extended_pagination_422(client) -> None:
    c, _ = client
    _register(c)
    resp = c.get("/api/v2/papers/xingce/list/extended?pageSize=51")
    assert resp.status_code == 422
    resp = c.get("/api/v2/papers/xingce/list/extended?page=0")
    assert resp.status_code == 422


def test_list_extended_sort_year_desc(client) -> None:
    c, settings = client
    _register(c)
    _seed_xingce_paper(
        settings.database_url,
        paper_code="XINGCE-OLD",
        paper_name="2020 xingce",
        exam_year=2020,
        sort_order=10,
        questions=[("a", "言语理解")],
    )
    _seed_xingce_paper(
        settings.database_url,
        paper_code="XINGCE-NEW",
        paper_name="2024 xingce",
        exam_year=2024,
        sort_order=1,
        questions=[("a", "言语理解")],
    )
    resp = c.get("/api/v2/papers/xingce/list/extended?sort=year")
    body = resp.json()
    codes = [item["paperCode"] for item in body["items"]]
    assert codes == ["XINGCE-NEW", "XINGCE-OLD"]


# ────────────────────────────────────────────────────────────────────────────
# /filters tests
# ────────────────────────────────────────────────────────────────────────────


def test_filters_returns_distinct_metadata(client) -> None:
    c, settings = client
    _register(c)
    _seed_xingce_paper(
        settings.database_url,
        paper_code="GUOKAO-2024-XF1",
        paper_name="p1",
        exam_year=2024,
        source_provider="fenbi",
        source_kind="真题",
        questions=[("a", "言语理解")],
    )
    _seed_xingce_paper(
        settings.database_url,
        paper_code="GUOKAO-2023-XF2",
        paper_name="p2",
        exam_year=2023,
        source_provider="aipta",
        source_kind="模考",
        questions=[("a", "言语理解")],
    )

    resp = c.get("/api/v2/papers/xingce/filters")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["years"] == [2024, 2023]
    assert sorted(body["paperTypes"]) == sorted(["真题", "模考"])
    assert "国考" in body["regions"]
    assert "fenbi" in body["regions"]
    assert "aipta" in body["regions"]


def test_filters_no_guokao_no_derived_bucket(client) -> None:
    c, settings = client
    _register(c)
    _seed_xingce_paper(
        settings.database_url,
        paper_code="OTHER-2024-X",
        paper_name="other",
        exam_year=2024,
        source_provider="aipta",
        source_kind="模考",
        questions=[("a", "言语理解")],
    )
    resp = c.get("/api/v2/papers/xingce/filters")
    body = resp.json()
    assert "国考" not in body["regions"]
    assert "省考" not in body["regions"]
    assert "aipta" in body["regions"]


def test_filters_anonymous_allowed(client) -> None:
    c, settings = client
    _seed_xingce_paper(
        settings.database_url,
        paper_code="XINGCE-ANON-F",
        paper_name="anon",
        exam_year=2024,
        source_provider="fenbi",
        source_kind="真题",
        questions=[("a", "言语理解")],
    )
    resp = c.get("/api/v2/papers/xingce/filters")
    assert resp.status_code == 200
    body = resp.json()
    assert body["years"] == [2024]


# ────────────────────────────────────────────────────────────────────────────
# Edge: hidden / essay-only excluded
# ────────────────────────────────────────────────────────────────────────────


def test_hidden_revision_excluded_from_summary(client) -> None:
    c, settings = client
    _register(c)
    engine = create_engine(settings.database_url, future=True)
    SessionLocal = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False, future=True
    )
    db = SessionLocal()
    try:
        paper = Paper(paper_code="XINGCE-HIDDEN", paper_name="hidden")
        db.add(paper)
        db.flush()
        revision = PaperRevision(
            paper_id=paper.id,
            revision_number=1,
            sort_order=1,
            paper_name="hidden",
            question_count=1,
            source_hash="hash_hidden_xingce",
            visible_in_public=False,
            is_published=True,
        )
        db.add(revision)
        db.flush()
        paper.current_revision_id = revision.id
        section = PaperSection(
            paper_revision_id=revision.id,
            section_key="S1",
            title="行测",
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
            source_uuid="hidden_xingce_q",
            question_kind="single_choice",
            subtype_name="言语理解",
            stem_text="hidden q",
            answer_text="A",
            renderer_key="single_choice",
            is_gradable=True,
            enabled=True,
            canonical_top_type="行测",
            canonical_subtype="言语理解",
        )
        db.add(q)
        db.commit()
    finally:
        db.close()

    resp = c.get("/api/v2/papers/xingce/specialty/summary")
    assert resp.status_code == 200
    assert resp.json()["totals"]["total"] == 0


def test_essay_questions_excluded_from_xingce_summary(client) -> None:
    """question_kind='essay' 不应进 行测 total."""
    c, settings = client
    _register(c)
    # Seed essay (kind=essay) + 行测 (kind=single_choice)
    engine = create_engine(settings.database_url, future=True)
    SessionLocal = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False, future=True
    )
    db = SessionLocal()
    try:
        paper = Paper(paper_code="MIXED", paper_name="mixed")
        db.add(paper)
        db.flush()
        revision = PaperRevision(
            paper_id=paper.id,
            revision_number=1,
            sort_order=1,
            paper_name="mixed",
            question_count=2,
            source_hash="hash_mixed",
            is_published=True,
        )
        db.add(revision)
        db.flush()
        paper.current_revision_id = revision.id
        section = PaperSection(
            paper_revision_id=revision.id,
            section_key="S1",
            title="mixed",
            instruction_text="",
            display_order=1,
            question_count=2,
        )
        db.add(section)
        db.flush()
        for i, (kind, subtype) in enumerate(
            [("essay", "归纳概括"), ("single_choice", "言语理解")]
        ):
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
                source_uuid=f"mixed_{i}",
                question_kind=kind,
                subtype_name=subtype,
                stem_text=f"q{i}",
                answer_text="" if kind == "essay" else "A",
                renderer_key=kind,
                is_gradable=(kind != "essay"),
                enabled=True,
                canonical_top_type="行测" if kind != "essay" else "申论",
                canonical_subtype=subtype,
            )
            db.add(q)
            db.flush()
        db.commit()
    finally:
        db.close()

    resp = c.get("/api/v2/papers/xingce/specialty/summary")
    assert resp.status_code == 200
    assert resp.json()["totals"]["total"] == 1  # essay 不算
