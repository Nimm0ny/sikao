"""Slice 3e · Dashboard breakdown by mode tests.

GET /api/v2/practice/stats/summary 多 3 字段 (study_plan_answered /
retry_wrong_answered / paper_bound_answered) 按 PracticeSession.mode 分桶.

Plan: docs/plan/slice-3e-abm-breakdown.md §7.

测试构造方式: 直接落 PracticeSession + PracticeSessionAnswer 行 (跳 API,
mode 字段直接控制).
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

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
from sikao_api.modules.question_bank.application.exam_papers import (
    MODE_PAPER,
    MODE_RETRY_WRONG,
    MODE_RETRY_WRONG_CROSS_PAPER,
    MODE_STUDY_PLAN,
    MODE_STUDY_PLAN_CROSS_PAPER,
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


def _register(client: TestClient, *, username: str = "user1") -> int:
    resp = client.post(
        "/api/v2/auth/register/email",
        json={"email": f"{username}@test.local", "password": "passw0rd", "displayName": username},
    )
    assert resp.status_code == 200, resp.text
    return int(resp.json()["user"]["id"])


def _ensure_seed_question(client: TestClient) -> int:
    """落 1 道题 (Paper/Revision/Section/Block/Question), 返 question id.

    所有 PracticeSessionAnswer 测试行复用此 question_id (PRAGMA FK on, 必须真存在).
    多次调用幂等 — 已存在直接返已有 id.
    """
    factory = client.app.state.db.session_factory
    sess = factory()
    try:
        existing = sess.query(Question).first()
        if existing is not None:
            return int(existing.id)

        paper = Paper(paper_code="DASH-T", paper_name="dashboard test")
        sess.add(paper)
        sess.flush()
        revision = PaperRevision(
            paper_id=paper.id,
            revision_number=1,
            sort_order=1,
            paper_name="dashboard test",
            question_count=1,
            source_hash="h",
        )
        sess.add(revision)
        sess.flush()
        section = PaperSection(
            paper_revision_id=revision.id,
            section_key="s1",
            title="t",
            instruction_text="",
            display_order=1,
            question_count=1,
        )
        sess.add(section)
        sess.flush()
        block = PaperBlock(
            paper_revision_id=revision.id,
            section_id=section.id,
            block_type="question",
            display_order=1,
        )
        sess.add(block)
        sess.flush()
        q = Question(
            paper_revision_id=revision.id,
            section_id=section.id,
            block_id=block.id,
            position=1,
            source_uuid="dash-q1",
            question_kind="single_choice",
            subtype_name="选择",
            stem_text="<p>题干</p>",
            answer_text="A",
            renderer_key="single_choice",
            is_gradable=True,
        )
        sess.add(q)
        sess.commit()
        return int(q.id)
    finally:
        sess.close()


def _seed_session_with_answers(
    client: TestClient,
    *,
    user_id: int,
    mode: str,
    answer_count: int,
    paper_revision_id: int | None = None,
) -> int:
    """落 1 个 PracticeSession + N answer rows (复用同一 question_id).

    answer-level count 算的是 PracticeSessionAnswer 行数. 真实代码 UNIQUE
    (session_id, question_id) — 同 session 内一题答一次. 测试用同一 session
    多 answer 会撞 UNIQUE, 所以一个 session 只放 1 个 answer, 通过多 session
    凑 answer 总数; 或用 unique question_id (这里走前者更简洁).
    """
    question_id = _ensure_seed_question(client)
    factory = client.app.state.db.session_factory
    sess = factory()
    try:
        ps_ids: list[int] = []
        # 每个 answer 单独一个 session — 避开 UNIQUE(session_id, question_id).
        # 实际生产 1 session N answer N question, 测试简化为 N session 1 answer.
        for i in range(answer_count):
            ps = PracticeSession(
                user_id=user_id,
                mode=mode,
                paper_revision_id=paper_revision_id,
                started_at=datetime.utcnow(),
                total_questions=1,
            )
            sess.add(ps)
            sess.flush()
            sess.add(
                PracticeSessionAnswer(
                    session_id=ps.id,
                    question_id=question_id,
                    display_order=0,
                    selected_answer="A",
                    correct_answer_snapshot="A",
                    is_correct=True,
                )
            )
            ps_ids.append(int(ps.id))
        sess.commit()
        return ps_ids[0] if ps_ids else 0
    finally:
        sess.close()


# ── 1. 空数据全 0 ────────────────────────────────────────────────────────


def test_breakdown_zero_when_no_sessions(client) -> None:
    c, _ = client
    _register(c)
    resp = c.get("/api/v2/practice/stats/summary")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["studyPlanAnswered"] == 0
    assert body["retryWrongAnswered"] == 0
    assert body["paperBoundAnswered"] == 0
    assert body["totalAnswered"] == 0


# ── 2. 三桶各落对应 mode + answer-level 累计 ─────────────────────────────


def test_breakdown_three_buckets_correct(client) -> None:
    """3 session: MODE_PAPER (3 题) / MODE_RETRY_WRONG (5 题) / MODE_STUDY_PLAN (2 题)
    → paperBound=3, retryWrong=5, studyPlan=2. 是 answer-level 累计.
    """
    c, _ = client
    user_id = _register(c)
    _seed_session_with_answers(c, user_id=user_id, mode=MODE_PAPER, answer_count=3)
    _seed_session_with_answers(c, user_id=user_id, mode=MODE_RETRY_WRONG, answer_count=5)
    _seed_session_with_answers(c, user_id=user_id, mode=MODE_STUDY_PLAN, answer_count=2)

    resp = c.get("/api/v2/practice/stats/summary")
    body = resp.json()
    assert body["paperBoundAnswered"] == 3
    assert body["retryWrongAnswered"] == 5
    assert body["studyPlanAnswered"] == 2
    assert body["totalAnswered"] == 10
    # sum(buckets) == total
    assert (
        body["paperBoundAnswered"]
        + body["retryWrongAnswered"]
        + body["studyPlanAnswered"]
    ) == body["totalAnswered"]


# ── 3. cross-paper mode 也归对应桶 ───────────────────────────────────────


def test_breakdown_cross_paper_mode_grouping(client) -> None:
    """MODE_STUDY_PLAN_CROSS_PAPER → study_plan 桶;
    MODE_RETRY_WRONG_CROSS_PAPER → retry_wrong 桶.

    P1-3 v0.2 review: 显式断言 cross-paper session 必 paper_revision_id=NULL
    (生产 cross_paper mode 永远 NULL, exam_papers.py:1517+); 防 fixture 漂移.
    """
    c, _ = client
    user_id = _register(c)
    _seed_session_with_answers(
        c, user_id=user_id, mode=MODE_STUDY_PLAN_CROSS_PAPER, answer_count=4
    )
    _seed_session_with_answers(
        c, user_id=user_id, mode=MODE_RETRY_WRONG_CROSS_PAPER, answer_count=6
    )

    # 显式验 cross_paper session paper_revision_id IS NULL (P1-3)
    factory = c.app.state.db.session_factory
    sess = factory()
    try:
        cross_paper_sessions = (
            sess.query(PracticeSession)
            .filter(PracticeSession.mode.in_([
                MODE_STUDY_PLAN_CROSS_PAPER, MODE_RETRY_WRONG_CROSS_PAPER,
            ]))
            .all()
        )
        assert len(cross_paper_sessions) == 10  # 4 + 6 个 session
        for ps in cross_paper_sessions:
            assert ps.paper_revision_id is None, (
                f"cross_paper session {ps.id} mode={ps.mode} expected "
                f"paper_revision_id=None, got {ps.paper_revision_id}"
            )
    finally:
        sess.close()

    resp = c.get("/api/v2/practice/stats/summary")
    body = resp.json()
    assert body["studyPlanAnswered"] == 4
    assert body["retryWrongAnswered"] == 6
    assert body["paperBoundAnswered"] == 0


# ── 4. unknown mode → warn + 归 paper_bound 兜底 ─────────────────────────


def test_breakdown_unknown_mode_warn_and_paper_bound(client, caplog) -> None:
    """DB 直插 mode='legacy_xxx' (绕开常量) → logger.warning + 归 paper_bound."""
    c, _ = client
    user_id = _register(c)
    _seed_session_with_answers(c, user_id=user_id, mode="legacy_xxx", answer_count=7)

    with caplog.at_level(logging.WARNING):
        resp = c.get("/api/v2/practice/stats/summary")

    body = resp.json()
    assert body["paperBoundAnswered"] == 7  # 兜底归整卷桶
    assert body["studyPlanAnswered"] == 0
    assert body["retryWrongAnswered"] == 0
    # logger.warning 必发
    assert any(
        "unknown_mode_in_breakdown" in rec.message and "legacy_xxx" in str(rec.args)
        for rec in caplog.records
    ), f"expected unknown_mode warning, got: {[r.message for r in caplog.records]}"


# ── 5b. 整路线 P1-6 sentinel: study_plan 入口永落 MODE_STUDY_PLAN ─────────


def test_start_study_plan_session_always_lands_mode_study_plan(client) -> None:
    """整路线 review P1-6 sentinel.

    `start_study_plan_session` (Slice 3a) 永远落 MODE_STUDY_PLAN[_CROSS_PAPER]
    不区分 caller 传的 task_kind. 这是 Slice 3e D2 桶定义的隐含前提 — 若
    未来有人改 3a 按 task_kind 区分 mode (e.g. review_wrong task → MODE_RETRY_WRONG),
    3e ABM 桶逻辑会静默破: 计划内复习题不再归 study_plan 桶.

    本 sentinel 锁定行为不变量: 任何走 /study-plan/start 的 session, mode 必 study_plan.
    """
    from sikao_api.db.models import User
    from sikao_api.modules.question_bank.application.exam_papers import ExamPaperService

    c, _ = client
    user_id = _register(c)
    question_id = _ensure_seed_question(c)

    factory = c.app.state.db.session_factory
    sess = factory()
    try:
        user = sess.get(User, user_id)
        assert user is not None
        service = ExamPaperService(sess)
        # 即使 caller 传的 question_ids 来自"错题本视角" (review_wrong task 语境),
        # service 也必落 MODE_STUDY_PLAN — 不区分 task_kind.
        result = service.start_study_plan_session(
            paper_code=None,
            question_ids=[question_id],
            user=user,
        )
        sess.commit()
        ps = sess.query(PracticeSession).filter_by(id=result.session_id).one()
        assert ps.mode == MODE_STUDY_PLAN, (
            f"sentinel failed: start_study_plan_session 必永落 MODE_STUDY_PLAN, "
            f"got {ps.mode!r}. 若 3a 改成按 task_kind 区分 mode, 3e D2 桶定义会破"
            f" — 必须同步改 _compute_mode_breakdown 桶逻辑."
        )
    finally:
        sess.close()


# ── 5. 跨用户隔离 ────────────────────────────────────────────────────────


def test_breakdown_isolated_per_user(client) -> None:
    """alice 答 5 题, bob 自己看到 0 题."""
    c, _ = client
    alice_id = _register(c, username="alice")
    _seed_session_with_answers(
        c, user_id=alice_id, mode=MODE_STUDY_PLAN, answer_count=5
    )

    c.cookies.clear()
    _register(c, username="bob")
    resp = c.get("/api/v2/practice/stats/summary")
    body = resp.json()
    assert body["studyPlanAnswered"] == 0
    assert body["retryWrongAnswered"] == 0
    assert body["paperBoundAnswered"] == 0
    assert body["totalAnswered"] == 0
