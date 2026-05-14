"""Slice 3a · 学习计划 service 单测 (commit 2).

覆盖 plan §8 测试 1-17 + 19-20 (跳过 18 并发双写 — SQLite 跨 connection 测试
比较复杂, PoC 接受) + R4 health check 3 条.

外加 1 条时区 patch test 验 today_plan_date_shanghai (D3).
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Awaitable
from datetime import UTC, date, datetime, timedelta
from typing import Any
from unittest.mock import patch
from zoneinfo import ZoneInfo

import httpx
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from sikao_api.core.config import Settings
from sikao_api.db.base import Base
from sikao_api.db.models import (
    LlmTokenUsage,
    Paper,
    PaperBlock,
    PaperRevision,
    PaperSection,
    PracticeSession,
    PracticeSessionAnswer,
    Question,
    StudyPlan,
    StudyPlanTask,
    User,
    WrongQuestionMastery,
    utc_now,
)
from sikao_api.modules.system.application.errors import NotFoundError
from sikao_api.modules.system.application.errors import ValidationError as ServiceValidationError
from sikao_api.modules.llm.application.llm.provider import ChatCompletionResult
from sikao_api.modules.study_record.application.study_plans import (
    _COLD_START_THRESHOLD,
    _FALLBACK_PAPER_CODE,
    _FALLBACK_QUESTION_SOURCE_UUIDS,
    FallbackPaperMissingError,
    StudyPlanService,
    assert_fallback_paper_loadable,
    today_plan_date_shanghai,
)

_FALLBACK_TEST_QUESTION_IDS: list[int] = [26276, 26277, 26278]


def _run(coro: Awaitable) -> Any:
    return asyncio.run(coro)  # type: ignore[arg-type]


# ── Fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture
def engine():
    eng = create_engine("sqlite+pysqlite:///:memory:", future=True)

    @event.listens_for(eng, "connect")
    def _enable_fk(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(eng)
    return eng


@pytest.fixture
def session_factory(engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


@pytest.fixture
def session(session_factory: sessionmaker[Session]) -> Session:
    return session_factory()


@pytest.fixture
def settings() -> Settings:
    from sikao_api.modules.auth.application.security import hash_password

    return Settings(
        app_env="test",
        database_url="sqlite:///:memory:",
        upload_dir="/tmp",
        import_tmp_dir="/tmp",
        admin_username="admin",
        admin_password_hash=hash_password("p"),
        jwt_secret="test-secret-0123456789-test-secret",
        app_version="x",
        git_sha="x",
        image_tag="x",
        build_time="2026-04-29T00:00:00Z",
        schema_version="x",
        llm_api_key="sk-test-key",
        llm_base_url="https://api.deepseek.com/v1",
    )


def _seed_user(session: Session, username: str = "alice") -> User:
    user = User(username=username, display_name=username, password_hash="x")
    session.add(user)
    session.flush()
    return user


def _seed_paper_with_questions(
    session: Session,
    *,
    paper_code: str = _FALLBACK_PAPER_CODE,
    question_ids: list[int] | None = None,
    question_source_uuids: list[str] | None = None,
    extra_essay_id: int | None = None,
) -> tuple[Paper, list[Question]]:
    """Seed a Paper + active revision + N enabled single_choice questions
    + optional 1 essay question. question_ids 决定 ID; 若 None 用 fallback IDs."""
    if question_ids is None:
        question_ids = list(_FALLBACK_TEST_QUESTION_IDS)
    if question_source_uuids is None:
        question_source_uuids = list(_FALLBACK_QUESTION_SOURCE_UUIDS)
    if len(question_source_uuids) < len(question_ids):
        question_source_uuids = [
            *question_source_uuids,
            *(f"test-extra-{qid}" for qid in question_ids[len(question_source_uuids):]),
        ]

    paper = Paper(paper_code=paper_code, paper_name=f"test {paper_code}")
    session.add(paper)
    session.flush()
    revision = PaperRevision(
        paper_id=paper.id,
        revision_number=1,
        sort_order=1,
        paper_name=f"test {paper_code}",
        question_count=len(question_ids),
        source_hash=f"hash-{paper_code}",
        visible_in_public=True,
    )
    session.add(revision)
    session.flush()
    paper.current_revision_id = revision.id

    section = PaperSection(
        paper_revision_id=revision.id,
        section_key="s1",
        title="行测",
        instruction_text="",
        display_order=1,
        question_count=len(question_ids),
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

    questions: list[Question] = []
    for idx, qid in enumerate(question_ids):
        q = Question(
            id=qid,
            paper_revision_id=revision.id,
            section_id=section.id,
            block_id=block.id,
            position=idx + 1,
            source_uuid=question_source_uuids[idx],
            question_kind="single_choice",
            subtype_name="言语理解",
            stem_text=f"<p>题干 {qid}</p>",
            answer_text="A",
            explanation_text="",
            difficulty_code="unknown",
            renderer_key="single_choice",
            type_payload_json="{}",
            special_payload_json="{}",
            source_payload_json="{}",
            is_gradable=True,
            enabled=True,
            subject="言语理解",
        )
        session.add(q)
        questions.append(q)

    if extra_essay_id is not None:
        essay_q = Question(
            id=extra_essay_id,
            paper_revision_id=revision.id,
            section_id=section.id,
            block_id=block.id,
            position=len(question_ids) + 1,
            source_uuid=f"essay-{extra_essay_id}",
            question_kind="essay",
            subtype_name="申论",
            stem_text="<p>申论题干</p>",
            answer_text="",
            explanation_text="",
            difficulty_code="unknown",
            renderer_key="essay",
            type_payload_json="{}",
            special_payload_json="{}",
            source_payload_json="{}",
            is_gradable=True,
            enabled=True,
            subject="申论",
        )
        session.add(essay_q)
        questions.append(essay_q)

    session.flush()
    return paper, questions


def _seed_practice_history(
    session: Session, user: User, *, total: int, correct: int
) -> None:
    """造 N 条 practice_session_answers — 每条独立 session 简化 UNIQUE 约束.

    UNIQUE (session_id, question_id) 要求一题只能在一 session 内出现一次.
    每条 answer 一个 session 是测试最简化做法.
    """
    from sqlalchemy import select as sa_select

    q = session.scalars(sa_select(Question).limit(1)).first()
    assert q is not None, "_seed_practice_history requires at least 1 seeded question"

    now = utc_now()
    for i in range(total):
        ps = PracticeSession(
            user_id=user.id,
            paper_revision_id=None,
            mode="paper",
            started_at=now - timedelta(minutes=i + 1),
            completed_at=now - timedelta(minutes=i),
        )
        session.add(ps)
        session.flush()
        ans = PracticeSessionAnswer(
            session_id=ps.id,
            question_id=q.id,
            display_order=0,
            selected_answer="A",
            correct_answer_snapshot="A",
            is_correct=(i < correct),
            answered_at=now - timedelta(minutes=i),
        )
        session.add(ans)
    session.flush()


def _seed_wrong_question(
    session: Session, user: User, question: Question, *, mastery: str = "not_mastered"
) -> WrongQuestionMastery:
    wm = WrongQuestionMastery(
        user_id=user.id,
        question_id=question.id,
        mastery_level=mastery,
        last_wrong_time=utc_now(),
        consecutive_correct_count=0,
    )
    session.add(wm)
    session.flush()
    return wm


def _build_llm_result(content_dict: dict[str, Any]) -> ChatCompletionResult:
    """Helper 构 ChatCompletionResult mock."""
    return ChatCompletionResult(
        content=json.dumps(content_dict, ensure_ascii=False),
        model="deepseek-v4-flash",
        prompt_tokens=100,
        prompt_cache_hit_tokens=0,
        prompt_cache_miss_tokens=100,
        completion_tokens=200,
        finish_reason="stop",
    )


# ── Tests ────────────────────────────────────────────────────────────────────


def test_today_plan_date_shanghai_basic() -> None:
    """D3: today_plan_date_shanghai 跟 datetime.now(Asia/Shanghai).date() 一致."""
    expected = datetime.now(ZoneInfo("Asia/Shanghai")).date()
    actual = today_plan_date_shanghai()
    assert actual == expected


def test_today_plan_date_shanghai_crosses_utc_midnight() -> None:
    """UTC 16:30 在 Asia/Shanghai 是次日 00:30 — plan_date 应该是次日 (D3 边界)."""
    fake_utc = datetime(2026, 4, 29, 16, 30, tzinfo=UTC)  # Asia/Shanghai 4-30 00:30
    with patch("sikao_api.modules.study_record.application.study_plans.datetime") as mock_dt:
        mock_dt.now.return_value = fake_utc.astimezone(ZoneInfo("Asia/Shanghai"))
        result = today_plan_date_shanghai()
    assert result == date(2026, 4, 30)


# ── 1. cache hit ──────────────────────────────────────────────────────────


def test_cache_hit_returns_existing_plan(
    session: Session, settings: Settings
) -> None:
    user = _seed_user(session)
    today = today_plan_date_shanghai()
    existing = StudyPlan(
        user_id=user.id,
        plan_date=today,
        generation_status="success",
    )
    existing.tasks.append(
        StudyPlanTask(
            task_kind="practice",
            payload_json={"paperCode": "X", "title": "已存在"},
            display_order=0,
            status="pending",
        )
    )
    session.add(existing)
    session.flush()

    service = StudyPlanService(session, settings)
    plan, outcome = _run(service.get_or_create_today(user_id=user.id))
    assert plan.id == existing.id
    assert outcome.generation_status == "success"


# ── 2. cold start fallback ────────────────────────────────────────────────


def test_cold_start_fallback_no_llm_call(
    session: Session, settings: Settings
) -> None:
    """新用户 0 答题历史 → fallback_cold_start, 1 task, 不调 LLM."""
    user = _seed_user(session)
    _seed_paper_with_questions(session)  # seed fallback paper

    service = StudyPlanService(session, settings)
    # Mock LLM provider 防 accidental call
    with patch("sikao_api.modules.study_record.application.study_plans.build_llm_provider") as mock_build:
        plan, outcome = _run(service.get_or_create_today(user_id=user.id))
    mock_build.assert_not_called()
    assert outcome.generation_status == "fallback_cold_start"
    assert plan.generation_status == "fallback_cold_start"
    assert len(plan.tasks) == 1
    assert plan.tasks[0].task_kind == "practice"
    assert plan.tasks[0].payload_json["paperCode"] == _FALLBACK_PAPER_CODE
    assert plan.tasks[0].payload_json["questionIds"] == _FALLBACK_TEST_QUESTION_IDS


# ── 3. LLM 正常生成 ───────────────────────────────────────────────────────


def test_llm_generate_success_path(session: Session, settings: Settings) -> None:
    """user 答题 ≥ threshold + LLM 返有效 JSON → status='success', task 落库."""
    user = _seed_user(session)
    paper, questions = _seed_paper_with_questions(session)
    _seed_practice_history(session, user, total=_COLD_START_THRESHOLD + 5, correct=10)

    llm_response = {
        "tasks": [
            {
                "taskKind": "practice",
                "payload": {
                    "paperCode": _FALLBACK_PAPER_CODE,
                    "questionIds": [_FALLBACK_TEST_QUESTION_IDS[0]],
                    "title": "做 1 道言语题",
                    "subtitle": "练手",
                },
                "displayOrder": 0,
            },
            {
                "taskKind": "practice",
                "payload": {
                    "paperCode": _FALLBACK_PAPER_CODE,
                    "questionIds": [_FALLBACK_TEST_QUESTION_IDS[1]],
                    "title": "做 1 道常识题",
                    "subtitle": None,
                },
                "displayOrder": 1,
            },
            {
                "taskKind": "practice",
                "payload": {
                    "paperCode": _FALLBACK_PAPER_CODE,
                    "questionIds": [_FALLBACK_TEST_QUESTION_IDS[2]],
                    "title": "再做 1 道",
                    "subtitle": None,
                },
                "displayOrder": 2,
            },
        ]
    }

    async def fake_chat_completion(**_kwargs):
        return _build_llm_result(llm_response)

    fake_provider = type("P", (), {"chat_completion": staticmethod(fake_chat_completion)})()
    with patch(
        "sikao_api.modules.study_record.application.study_plans.build_llm_provider",
        return_value=(fake_provider, "system"),
    ):
        service = StudyPlanService(session, settings)
        plan, outcome = _run(service.get_or_create_today(user_id=user.id))

    assert outcome.generation_status == "success"
    assert plan.generation_status == "success"
    assert len(plan.tasks) == 3
    # token usage 落库
    assert plan.token_usage_id is not None
    usage_row = session.get(LlmTokenUsage, plan.token_usage_id)
    assert usage_row is not None
    assert usage_row.feature == "study_plan"


# ── 4. LLM 异常 → fallback_llm_failed ─────────────────────────────────────


def test_llm_call_failure_falls_back(
    session: Session, settings: Settings, caplog: pytest.LogCaptureFixture
) -> None:
    user = _seed_user(session)
    _seed_paper_with_questions(session)
    _seed_practice_history(session, user, total=_COLD_START_THRESHOLD + 5, correct=10)

    async def boom(**_kwargs):
        raise httpx.TimeoutException("simulated timeout")

    fake_provider = type("P", (), {"chat_completion": staticmethod(boom)})()
    with patch(
        "sikao_api.modules.study_record.application.study_plans.build_llm_provider",
        return_value=(fake_provider, "system"),
    ):
        with caplog.at_level(logging.ERROR, logger="sikao_api.modules.study_record.application.study_plans"):
            service = StudyPlanService(session, settings)
            plan, outcome = _run(service.get_or_create_today(user_id=user.id))

    assert outcome.generation_status == "fallback_llm_failed"
    assert plan.generation_status == "fallback_llm_failed"
    assert "TimeoutException" in (outcome.failure_reason or "")
    # log ERROR 级别
    assert any("study_plan.llm_failed" in rec.message for rec in caplog.records)


# ── 6. study_concept 防回归 (D1) ──────────────────────────────────────────


def test_llm_outputs_study_concept_falls_back(
    session: Session, settings: Settings
) -> None:
    user = _seed_user(session)
    _seed_paper_with_questions(session)
    _seed_practice_history(session, user, total=_COLD_START_THRESHOLD + 5, correct=10)

    bad_response = {
        "tasks": [
            {
                "taskKind": "study_concept",  # D1 砍掉的
                "payload": {"title": "看一遍知识点", "questionIds": [1]},
                "displayOrder": 0,
            }
        ]
    }

    async def fake_chat(**_kwargs):
        return _build_llm_result(bad_response)

    fake_provider = type("P", (), {"chat_completion": staticmethod(fake_chat)})()
    with patch(
        "sikao_api.modules.study_record.application.study_plans.build_llm_provider",
        return_value=(fake_provider, "system"),
    ):
        service = StudyPlanService(session, settings)
        plan, outcome = _run(service.get_or_create_today(user_id=user.id))

    assert outcome.generation_status == "fallback_llm_failed"
    assert "Stage 1 sanity failed" in (outcome.failure_reason or "")


# ── 8/9. PATCH task → completed/skipped ───────────────────────────────────


def test_patch_task_completed_sets_completed_at(
    session: Session, settings: Settings
) -> None:
    user = _seed_user(session)
    plan = StudyPlan(
        user_id=user.id, plan_date=date(2026, 4, 29), generation_status="success"
    )
    plan.tasks.append(
        StudyPlanTask(
            task_kind="practice",
            payload_json={"paperCode": "X", "title": "t"},
            display_order=0,
            status="pending",
        )
    )
    session.add(plan)
    session.flush()
    task_id = plan.tasks[0].id

    service = StudyPlanService(session, settings)
    updated = service.patch_task_status(
        user_id=user.id, task_id=task_id, new_status="completed"
    )
    assert updated.status == "completed"
    assert updated.completed_at is not None


def test_patch_task_skipped_no_completed_at(
    session: Session, settings: Settings
) -> None:
    user = _seed_user(session)
    plan = StudyPlan(
        user_id=user.id, plan_date=date(2026, 4, 29), generation_status="success"
    )
    plan.tasks.append(
        StudyPlanTask(
            task_kind="practice",
            payload_json={"paperCode": "X", "title": "t"},
            display_order=0,
            status="pending",
        )
    )
    session.add(plan)
    session.flush()
    task_id = plan.tasks[0].id

    service = StudyPlanService(session, settings)
    updated = service.patch_task_status(
        user_id=user.id, task_id=task_id, new_status="skipped"
    )
    assert updated.status == "skipped"
    assert updated.completed_at is None


# ── 10. PATCH task 跨用户 → NotFoundError ─────────────────────────────────


def test_patch_task_cross_user_404(session: Session, settings: Settings) -> None:
    alice = _seed_user(session, "alice")
    bob = _seed_user(session, "bob")
    plan = StudyPlan(
        user_id=alice.id, plan_date=date(2026, 4, 29), generation_status="success"
    )
    plan.tasks.append(
        StudyPlanTask(
            task_kind="practice",
            payload_json={"paperCode": "X", "title": "t"},
            display_order=0,
            status="pending",
        )
    )
    session.add(plan)
    session.flush()
    task_id = plan.tasks[0].id

    service = StudyPlanService(session, settings)
    with pytest.raises(NotFoundError):
        service.patch_task_status(
            user_id=bob.id, task_id=task_id, new_status="completed"
        )


# ── 11. PATCH task 已 finalized → ValidationError ─────────────────────────


def test_patch_task_already_finalized_422(
    session: Session, settings: Settings
) -> None:
    user = _seed_user(session)
    plan = StudyPlan(
        user_id=user.id, plan_date=date(2026, 4, 29), generation_status="success"
    )
    plan.tasks.append(
        StudyPlanTask(
            task_kind="practice",
            payload_json={"paperCode": "X", "title": "t"},
            display_order=0,
            status="completed",
            completed_at=utc_now(),
        )
    )
    session.add(plan)
    session.flush()
    task_id = plan.tasks[0].id

    service = StudyPlanService(session, settings)
    with pytest.raises(ServiceValidationError) as exc_info:
        service.patch_task_status(
            user_id=user.id, task_id=task_id, new_status="skipped"
        )
    assert "finalized" in str(exc_info.value)


# ── 13/14. sanity 丢 task 临界 ────────────────────────────────────────────


def test_sanity_drops_below_min_falls_back(
    session: Session, settings: Settings
) -> None:
    """LLM 输出 5 task, 4 个引非法 paperCode → 剩 1 task < 3 → 全降 fallback."""
    user = _seed_user(session)
    _seed_paper_with_questions(session)
    _seed_practice_history(session, user, total=_COLD_START_THRESHOLD + 5, correct=10)

    # 4 个 task 引不存在的 paperCode + 1 个引合法 paper
    bad_paper = "INVALID-PAPER"
    bad_response = {
        "tasks": [
            {
                "taskKind": "practice",
                "payload": {"paperCode": bad_paper, "title": f"bad {i}"},
                "displayOrder": i,
            }
            for i in range(4)
        ] + [
            {
                "taskKind": "practice",
                "payload": {
                    "paperCode": _FALLBACK_PAPER_CODE,
                    "questionIds": [_FALLBACK_TEST_QUESTION_IDS[0]],
                    "title": "ok",
                },
                "displayOrder": 4,
            },
        ]
    }

    async def fake_chat(**_kwargs):
        return _build_llm_result(bad_response)

    fake_provider = type("P", (), {"chat_completion": staticmethod(fake_chat)})()
    with patch(
        "sikao_api.modules.study_record.application.study_plans.build_llm_provider",
        return_value=(fake_provider, "system"),
    ):
        service = StudyPlanService(session, settings)
        plan, outcome = _run(service.get_or_create_today(user_id=user.id))

    assert outcome.generation_status == "fallback_llm_failed"
    assert "Stage 2/3 sanity dropped" in (outcome.failure_reason or "")


# ── 15. review_wrong 引非用户错题 → 该 task 丢 ───────────────────────────


def test_review_wrong_referencing_non_wrong_question_dropped(
    session: Session, settings: Settings
) -> None:
    """LLM review_wrong 引一个 questionId 不在用户错题表 → 丢; 剩余 < 3 → fallback."""
    user = _seed_user(session)
    _, questions = _seed_paper_with_questions(session)
    _seed_practice_history(session, user, total=_COLD_START_THRESHOLD + 5, correct=10)

    bad_response = {
        "tasks": [
            {
                "taskKind": "review_wrong",
                "payload": {
                    "questionIds": [questions[0].id],  # 用户没错过这题
                    "title": "复习",
                },
                "displayOrder": 0,
            },
            {
                "taskKind": "practice",
                "payload": {
                    "paperCode": _FALLBACK_PAPER_CODE,
                    "questionIds": [questions[1].id],
                    "title": "ok",
                },
                "displayOrder": 1,
            },
        ]
    }

    async def fake_chat(**_kwargs):
        return _build_llm_result(bad_response)

    fake_provider = type("P", (), {"chat_completion": staticmethod(fake_chat)})()
    with patch(
        "sikao_api.modules.study_record.application.study_plans.build_llm_provider",
        return_value=(fake_provider, "system"),
    ):
        service = StudyPlanService(session, settings)
        plan, outcome = _run(service.get_or_create_today(user_id=user.id))

    # review_wrong 丢 + practice 留 = 1 task < 3 → fallback
    assert outcome.generation_status == "fallback_llm_failed"


# ── 16. essay_writing 引非 essay 题 → 丢 ─────────────────────────────────


def test_essay_writing_referencing_non_essay_question_dropped(
    session: Session, settings: Settings
) -> None:
    user = _seed_user(session)
    _, questions = _seed_paper_with_questions(session)
    _seed_practice_history(session, user, total=_COLD_START_THRESHOLD + 5, correct=10)

    # questions[0] 是 single_choice, 不是 essay
    bad_response = {
        "tasks": [
            {
                "taskKind": "essay_writing",
                "payload": {
                    "paperCode": _FALLBACK_PAPER_CODE,
                    "questionId": questions[0].id,
                    "title": "写一段",
                },
                "displayOrder": 0,
            }
        ]
    }

    async def fake_chat(**_kwargs):
        return _build_llm_result(bad_response)

    fake_provider = type("P", (), {"chat_completion": staticmethod(fake_chat)})()
    with patch(
        "sikao_api.modules.study_record.application.study_plans.build_llm_provider",
        return_value=(fake_provider, "system"),
    ):
        service = StudyPlanService(session, settings)
        plan, outcome = _run(service.get_or_create_today(user_id=user.id))

    assert outcome.generation_status == "fallback_llm_failed"


# ── 19. LLM 输出 tasks=[] → fallback ─────────────────────────────────────


def test_llm_outputs_empty_tasks_falls_back(
    session: Session, settings: Settings
) -> None:
    user = _seed_user(session)
    _seed_paper_with_questions(session)
    _seed_practice_history(session, user, total=_COLD_START_THRESHOLD + 5, correct=10)

    async def fake_chat(**_kwargs):
        return _build_llm_result({"tasks": []})

    fake_provider = type("P", (), {"chat_completion": staticmethod(fake_chat)})()
    with patch(
        "sikao_api.modules.study_record.application.study_plans.build_llm_provider",
        return_value=(fake_provider, "system"),
    ):
        service = StudyPlanService(session, settings)
        plan, outcome = _run(service.get_or_create_today(user_id=user.id))

    assert outcome.generation_status == "fallback_llm_failed"


# ── 20. record_usage 失败 → warn 不抛, plan 仍 success ───────────────────


def test_record_usage_failure_warns_but_plan_still_success(
    session: Session, settings: Settings, caplog: pytest.LogCaptureFixture
) -> None:
    user = _seed_user(session)
    _seed_paper_with_questions(session)
    _seed_practice_history(session, user, total=_COLD_START_THRESHOLD + 5, correct=10)

    llm_response = {
        "tasks": [
            {
                "taskKind": "practice",
                "payload": {
                    "paperCode": _FALLBACK_PAPER_CODE,
                    "questionIds": [_FALLBACK_TEST_QUESTION_IDS[i]],
                    "title": f"task {i}",
                },
                "displayOrder": i,
            }
            for i in range(3)
        ]
    }

    async def fake_chat(**_kwargs):
        return _build_llm_result(llm_response)

    fake_provider = type("P", (), {"chat_completion": staticmethod(fake_chat)})()
    with patch(
        "sikao_api.modules.study_record.application.study_plans.build_llm_provider",
        return_value=(fake_provider, "system"),
    ), patch(
        "sikao_api.modules.study_record.application.study_plans.record_usage",
        side_effect=SQLAlchemyError("simulated usage failure"),
    ):
        with caplog.at_level(logging.WARNING, logger="sikao_api.modules.study_record.application.study_plans"):
            service = StudyPlanService(session, settings)
            plan, outcome = _run(service.get_or_create_today(user_id=user.id))

    assert outcome.generation_status == "success"
    assert plan.token_usage_id is None
    assert any("record_usage_failed" in rec.message for rec in caplog.records)


# ── R4 health check ──────────────────────────────────────────────────────


def test_health_check_passes_when_paper_and_questions_present(
    session: Session,
) -> None:
    _seed_paper_with_questions(session)
    # 不抛即通过
    assert_fallback_paper_loadable(session)


def test_health_check_raises_when_paper_missing(session: Session) -> None:
    """空 DB → paper not found."""
    with pytest.raises(FallbackPaperMissingError) as exc_info:
        assert_fallback_paper_loadable(session)
    assert _FALLBACK_PAPER_CODE in str(exc_info.value)


def test_health_check_raises_when_question_missing(session: Session) -> None:
    """Paper 有但缺一道 questionId → raise."""
    _seed_paper_with_questions(
        session,
        question_ids=_FALLBACK_TEST_QUESTION_IDS[:2],  # 故意少 1 道
    )
    with pytest.raises(FallbackPaperMissingError) as exc_info:
        assert_fallback_paper_loadable(session)
    assert _FALLBACK_QUESTION_SOURCE_UUIDS[2] in str(exc_info.value)


# ── v0.3 review hotfix tests ─────────────────────────────────────────────


# ── 沉睡用户判定 (P1-4) ──────────────────────────────────────────────────


def test_dormant_user_with_total_history_but_zero_recent_falls_back(
    session: Session, settings: Settings
) -> None:
    """沉睡用户: 全历史 total ≥ 阈值 但近 7 天 0 答题 → fallback_cold_start, 不调 LLM."""
    user = _seed_user(session)
    _seed_paper_with_questions(session)

    # 造 100 条久远 (>=14 天前) practice records, 近 7 天 0 答题
    from sqlalchemy import select as sa_select
    q = session.scalars(sa_select(Question).limit(1)).first()
    assert q is not None
    long_ago = utc_now() - timedelta(days=30)
    for i in range(_COLD_START_THRESHOLD + 5):
        ps = PracticeSession(
            user_id=user.id, paper_revision_id=None, mode="paper",
            started_at=long_ago - timedelta(minutes=i + 1),
            completed_at=long_ago - timedelta(minutes=i),
        )
        session.add(ps)
        session.flush()
        session.add(PracticeSessionAnswer(
            session_id=ps.id, question_id=q.id, display_order=0,
            selected_answer="A", correct_answer_snapshot="A",
            is_correct=False, answered_at=long_ago - timedelta(minutes=i),
        ))
    session.flush()

    service = StudyPlanService(session, settings)
    with patch("sikao_api.modules.study_record.application.study_plans.build_llm_provider") as mock_build:
        plan, outcome = _run(service.get_or_create_today(user_id=user.id))

    mock_build.assert_not_called()
    assert outcome.flow == "cold_start"
    assert outcome.generation_status == "fallback_cold_start"


# ── outcome flow field (P1-3) ────────────────────────────────────────────


def test_outcome_flow_cache_hit_distinguishes_from_fresh_success(
    session: Session, settings: Settings
) -> None:
    """复访 cache hit outcome.flow == 'cache_hit', 跟首次 'llm_success' 区分."""
    user = _seed_user(session)
    today = today_plan_date_shanghai()
    existing = StudyPlan(
        user_id=user.id, plan_date=today, generation_status="success"
    )
    existing.tasks.append(
        StudyPlanTask(
            task_kind="practice",
            payload_json={"paperCode": "X", "title": "t"},
            display_order=0, status="pending",
        )
    )
    session.add(existing)
    session.flush()

    service = StudyPlanService(session, settings)
    _, outcome = _run(service.get_or_create_today(user_id=user.id))
    assert outcome.flow == "cache_hit"
    assert outcome.generation_status == "success"


# ── P1-1 整卷 dedup ──────────────────────────────────────────────────────


def test_full_paper_duplicates_dropped(
    session: Session, settings: Settings
) -> None:
    """LLM 输出 5 个 task 都是 paperCode=X + questionIds=null 整卷 → 留 1 丢 4
    → 剩 1 task < 3 → fallback (P1-1)."""
    user = _seed_user(session)
    _seed_paper_with_questions(session)
    _seed_practice_history(session, user, total=_COLD_START_THRESHOLD + 5, correct=10)

    bad_response = {
        "tasks": [
            {
                "taskKind": "practice",
                "payload": {
                    "paperCode": _FALLBACK_PAPER_CODE,
                    "questionIds": None,
                    "title": f"做整卷 {i}",
                },
                "displayOrder": i,
            }
            for i in range(5)
        ]
    }

    async def fake_chat(**_kwargs):
        return _build_llm_result(bad_response)

    fake_provider = type("P", (), {"chat_completion": staticmethod(fake_chat)})()
    with patch(
        "sikao_api.modules.study_record.application.study_plans.build_llm_provider",
        return_value=(fake_provider, "system"),
    ):
        service = StudyPlanService(session, settings)
        plan, outcome = _run(service.get_or_create_today(user_id=user.id))

    # 5 个整卷 task 同 paperCode dedup 后剩 1 个 → < 3 → fallback
    assert outcome.flow == "llm_failed"
    assert "Stage 2/3 sanity dropped to 1 task" in (outcome.failure_reason or "")


def test_full_paper_and_subset_practice_coexist(
    session: Session, settings: Settings
) -> None:
    """整卷 paperCode=X + 同卷限定题 paperCode=X questionIds=[1,2] → 都允许共存
    (paperCode 重复但语义不同)."""
    user = _seed_user(session)
    _, qs = _seed_paper_with_questions(session)
    _seed_practice_history(session, user, total=_COLD_START_THRESHOLD + 5, correct=10)

    response = {
        "tasks": [
            {
                "taskKind": "practice",
                "payload": {
                    "paperCode": _FALLBACK_PAPER_CODE,
                    "questionIds": None,
                    "title": "整卷",
                },
                "displayOrder": 0,
            },
            {
                "taskKind": "practice",
                "payload": {
                    "paperCode": _FALLBACK_PAPER_CODE,
                    "questionIds": [qs[0].id],
                    "title": "限定 1 题",
                },
                "displayOrder": 1,
            },
            {
                "taskKind": "practice",
                "payload": {
                    "paperCode": _FALLBACK_PAPER_CODE,
                    "questionIds": [qs[1].id, qs[2].id],
                    "title": "限定 2 题",
                },
                "displayOrder": 2,
            },
        ]
    }

    async def fake_chat(**_kwargs):
        return _build_llm_result(response)

    fake_provider = type("P", (), {"chat_completion": staticmethod(fake_chat)})()
    with patch(
        "sikao_api.modules.study_record.application.study_plans.build_llm_provider",
        return_value=(fake_provider, "system"),
    ):
        service = StudyPlanService(session, settings)
        plan, outcome = _run(service.get_or_create_today(user_id=user.id))

    # 3 个 task 都过 sanity (整卷 + 2 个限定题集合不重叠)
    assert outcome.flow == "llm_success"
    assert outcome.generation_status == "success"
    assert len(plan.tasks) == 3


# ── P1-2 测试 5: partial questionId invalid → 整 task 丢 ─────────────────


def test_practice_with_partial_invalid_questionid_drops_task(
    session: Session, settings: Settings
) -> None:
    """task questionIds=[valid, valid, invalid] → _questions_exist_and_match_paper
    严格相等失败 → 整 task 丢. 其他 task 全合法但只剩 1 → fallback."""
    user = _seed_user(session)
    _, qs = _seed_paper_with_questions(session)
    _seed_practice_history(session, user, total=_COLD_START_THRESHOLD + 5, correct=10)

    response = {
        "tasks": [
            {
                "taskKind": "practice",
                "payload": {
                    "paperCode": _FALLBACK_PAPER_CODE,
                    # 含一个 999999 不存在 → 整 task 丢
                    "questionIds": [qs[0].id, qs[1].id, 999999],
                    "title": "含非法 id",
                },
                "displayOrder": 0,
            },
            {
                "taskKind": "practice",
                "payload": {
                    "paperCode": _FALLBACK_PAPER_CODE,
                    "questionIds": [qs[2].id],
                    "title": "ok",
                },
                "displayOrder": 1,
            },
        ]
    }

    async def fake_chat(**_kwargs):
        return _build_llm_result(response)

    fake_provider = type("P", (), {"chat_completion": staticmethod(fake_chat)})()
    with patch(
        "sikao_api.modules.study_record.application.study_plans.build_llm_provider",
        return_value=(fake_provider, "system"),
    ):
        service = StudyPlanService(session, settings)
        plan, outcome = _run(service.get_or_create_today(user_id=user.id))

    # 1 task 丢 + 1 task 留 = 1 task < 3 → fallback
    assert outcome.flow == "llm_failed"
    assert "Stage 2/3 sanity dropped to 1 task" in (outcome.failure_reason or "")


# ── P1-2 测试 14: sanity drop 5→4 落 success ──────────────────────────────


def test_sanity_drops_to_four_lands_success_with_renumbered_order(
    session: Session, settings: Settings
) -> None:
    """LLM 输出 5 个 task, 1 个引非法 → 留 4 ≥ 3 → success, display_order 重排 0..3."""
    user = _seed_user(session)
    _, qs = _seed_paper_with_questions(
        session, question_ids=[7841, 7842, 7844, 9001, 9002]
    )
    _seed_practice_history(session, user, total=_COLD_START_THRESHOLD + 5, correct=10)

    response = {
        "tasks": [
            {
                "taskKind": "practice",
                "payload": {
                    "paperCode": _FALLBACK_PAPER_CODE,
                    "questionIds": [qs[0].id],
                    "title": "ok 0",
                },
                "displayOrder": 0,
            },
            {
                "taskKind": "practice",
                "payload": {
                    "paperCode": "INVALID-PAPER",  # 引非法 paperCode → 丢
                    "questionIds": [qs[1].id],
                    "title": "bad",
                },
                "displayOrder": 1,
            },
            {
                "taskKind": "practice",
                "payload": {
                    "paperCode": _FALLBACK_PAPER_CODE,
                    "questionIds": [qs[1].id],
                    "title": "ok 2",
                },
                "displayOrder": 2,
            },
            {
                "taskKind": "practice",
                "payload": {
                    "paperCode": _FALLBACK_PAPER_CODE,
                    "questionIds": [qs[2].id],
                    "title": "ok 3",
                },
                "displayOrder": 3,
            },
            {
                "taskKind": "practice",
                "payload": {
                    "paperCode": _FALLBACK_PAPER_CODE,
                    "questionIds": [qs[3].id],
                    "title": "ok 4",
                },
                "displayOrder": 4,
            },
        ]
    }

    async def fake_chat(**_kwargs):
        return _build_llm_result(response)

    fake_provider = type("P", (), {"chat_completion": staticmethod(fake_chat)})()
    with patch(
        "sikao_api.modules.study_record.application.study_plans.build_llm_provider",
        return_value=(fake_provider, "system"),
    ):
        service = StudyPlanService(session, settings)
        plan, outcome = _run(service.get_or_create_today(user_id=user.id))

    assert outcome.flow == "llm_success"
    assert outcome.generation_status == "success"
    assert len(plan.tasks) == 4
    # display_order 重新连续编号 0..3 (Stage 3.3)
    orders = sorted(t.display_order for t in plan.tasks)
    assert orders == [0, 1, 2, 3]


# ── P0-1: IntegrityError 重 SELECT 路径 (单线程 mock) ───────────────────


def test_integrity_error_on_create_falls_back_to_existing(
    session: Session, settings: Settings
) -> None:
    """模拟并发: 第二次调 _create_fallback_plan 时已有同 user+date plan
    (用第二 session 提前塞), flush 抛 IntegrityError → SAVEPOINT rollback +
    重 SELECT 拿首个 row, 不重复落库."""
    user = _seed_user(session)
    _seed_paper_with_questions(session)
    today = today_plan_date_shanghai()
    # 第二个 session 模拟并发胜者: 提前塞一个 row 进 DB
    pre_existing = StudyPlan(
        user_id=user.id,
        plan_date=today,
        generation_status="fallback_cold_start",
    )
    pre_existing.tasks.append(
        StudyPlanTask(
            task_kind="practice",
            payload_json={"paperCode": "X", "title": "pre-existing"},
            display_order=0, status="pending",
        )
    )
    session.add(pre_existing)
    session.commit()  # 真 commit 让 UNIQUE 触发

    # 实际 race: 同 user 同 date 第二次调用. 用 mock _load_plan_for_date 模拟
    # "首次 SELECT 没命中, flush 时撞 UNIQUE".
    service = StudyPlanService(session, settings)
    original_load = service._load_plan_for_date
    call_count = {"n": 0}

    def mock_load(*, user_id, plan_date):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return None  # 首次假装没命中
        return original_load(user_id=user_id, plan_date=plan_date)

    with patch.object(service, "_load_plan_for_date", side_effect=mock_load):
        # 同 user + 同 today → flush 撞 pre_existing UNIQUE
        plan, outcome = _run(service.get_or_create_today(user_id=user.id))

    # 重 SELECT 拿到 pre_existing (不是新 plan)
    assert plan.id == pre_existing.id
    # outcome 走的是 cache_hit 路径 (重 SELECT 落点)
    assert outcome.flow == "cache_hit"


# ── P0-3: prod env hard fail ─────────────────────────────────────────────


def test_prod_env_lifespan_hard_fails_when_fallback_missing(tmp_path) -> None:
    """app_env='prod' + 空 DB → lifespan 启动抛 FallbackPaperMissingError.

    用 file-based sqlite (tmp_path) 避开 prod env 配置对 :memory: 的 path-resolve.
    """
    from sikao_api.main import create_app
    from sikao_api.modules.auth.application.security import hash_password

    db_file = tmp_path / "prod_test.db"
    prod_settings = Settings(
        app_env="prod",
        database_url=f"sqlite:///{db_file}",
        upload_dir=str(tmp_path),
        import_tmp_dir=str(tmp_path),
        admin_username="admin",
        admin_password_hash=hash_password("p"),
        jwt_secret="test-secret-0123456789-test-secret-prod",
        app_version="x",
        git_sha="x",
        image_tag="x",
        build_time="2026-04-29T00:00:00Z",
        schema_version="x",
        llm_api_key="sk-test-key",
        llm_base_url="https://api.deepseek.com/v1",
        auth_cookie_secure=True,  # prod 要求
    )
    app = create_app(settings=prod_settings, initialize_schema=True)
    # 空 DB (Base.metadata.create_all 跑过但 papers 表空) → R4 应抛
    from fastapi.testclient import TestClient
    with pytest.raises(FallbackPaperMissingError):
        with TestClient(app):
            pass  # lifespan 启动时即抛


# ── P0-2: record_usage 真 IntegrityError → SAVEPOINT rollback + plan 仍 success ──


def test_record_usage_integrity_error_savepoint_rolls_back_clean(
    session: Session, settings: Settings
) -> None:
    """record_usage 真 trigger IntegrityError (FK / NOT NULL 违反) → begin_nested
    SAVEPOINT 自动 rollback → session 不 dirty → plan add+flush 仍能 work,
    plan.token_usage_id=None (P0-2 v0.3 review).
    """
    from sqlalchemy.exc import IntegrityError

    user = _seed_user(session)
    _seed_paper_with_questions(session)
    _seed_practice_history(session, user, total=_COLD_START_THRESHOLD + 5, correct=10)

    llm_response = {
        "tasks": [
            {
                "taskKind": "practice",
                "payload": {
                    "paperCode": _FALLBACK_PAPER_CODE,
                    "questionIds": [_FALLBACK_TEST_QUESTION_IDS[i]],
                    "title": f"task {i}",
                },
                "displayOrder": i,
            }
            for i in range(3)
        ]
    }

    async def fake_chat(**_kwargs):
        return _build_llm_result(llm_response)

    fake_provider = type("P", (), {"chat_completion": staticmethod(fake_chat)})()

    # Mock record_usage to raise IntegrityError directly (simulates FK violation
    # during real DB flush). begin_nested SAVEPOINT must catch it and rollback.
    with patch(
        "sikao_api.modules.study_record.application.study_plans.build_llm_provider",
        return_value=(fake_provider, "system"),
    ), patch(
        "sikao_api.modules.study_record.application.study_plans.record_usage",
        side_effect=IntegrityError("simulated", {}, Exception()),
    ):
        service = StudyPlanService(session, settings)
        plan, outcome = _run(service.get_or_create_today(user_id=user.id))

    # plan 主体仍 success 落库, token_usage_id=None
    assert outcome.flow == "llm_success"
    assert outcome.generation_status == "success"
    assert plan.token_usage_id is None
    # 关键: 后续可继续 query (session 没 dirty 卡死)
    fetched = session.get(StudyPlan, plan.id)
    assert fetched is not None


def test_dev_env_lifespan_logs_error_when_fallback_missing(
    tmp_path, caplog: pytest.LogCaptureFixture
) -> None:
    """app_env='local' + 空 DB → lifespan log ERROR 但启动成功 (dev 友好)."""
    from sikao_api.main import create_app
    from sikao_api.modules.auth.application.security import hash_password

    db_file = tmp_path / "dev_test.db"
    dev_settings = Settings(
        app_env="local",
        database_url=f"sqlite:///{db_file}",
        upload_dir=str(tmp_path),
        import_tmp_dir=str(tmp_path),
        admin_username="admin",
        admin_password_hash=hash_password("p"),
        jwt_secret="test-secret-0123456789-test-secret-dev",
        app_version="x",
        git_sha="x",
        image_tag="x",
        build_time="2026-04-29T00:00:00Z",
        schema_version="x",
        llm_api_key="sk-test-key",
        llm_base_url="https://api.deepseek.com/v1",
    )
    app = create_app(settings=dev_settings, initialize_schema=True)
    from fastapi.testclient import TestClient
    with caplog.at_level(logging.ERROR, logger="sikao_api.main"):
        with TestClient(app):
            pass  # 不抛
    assert any(
        "fallback_paper_missing" in rec.message for rec in caplog.records
    )


# ── P1-C (v0.3 全 slice review): timeout=10 真透传到 provider 构造 ───────


def test_study_plan_timeout_seconds_override_passed_to_provider(
    session: Session, settings: Settings
) -> None:
    """guard test: service 调 build_llm_provider 时, timeout_seconds_override
    必须 = settings.llm_timeout_study_plan_seconds (10s 默认), 不能漂回 120s.

    核心契约 — timeout=10 是 D2 同步阻塞的体验保证, 静默改回 120 用户白屏 12x.
    用 spy 捕获 build_llm_provider 调用参数验.
    """
    user = _seed_user(session)
    _seed_paper_with_questions(session)
    _seed_practice_history(session, user, total=_COLD_START_THRESHOLD + 5, correct=10)

    captured_kwargs: dict = {}

    async def fake_chat(**_kwargs):
        return _build_llm_result(
            {
                "tasks": [
                    {
                        "taskKind": "practice",
                        "payload": {
                            "paperCode": _FALLBACK_PAPER_CODE,
                            "questionIds": [_FALLBACK_TEST_QUESTION_IDS[i]],
                            "title": f"task {i}",
                        },
                        "displayOrder": i,
                    }
                    for i in range(3)
                ]
            }
        )

    fake_provider = type("P", (), {"chat_completion": staticmethod(fake_chat)})()

    def fake_build(*args, **kwargs):
        captured_kwargs.update(kwargs)
        return (fake_provider, "system")

    with patch(
        "sikao_api.modules.study_record.application.study_plans.build_llm_provider", side_effect=fake_build
    ):
        service = StudyPlanService(session, settings)
        _run(service.get_or_create_today(user_id=user.id))

    # 关键 assertion: timeout_seconds_override 被传 + 值 = settings.llm_timeout_study_plan_seconds
    assert "timeout_seconds_override" in captured_kwargs
    assert captured_kwargs["timeout_seconds_override"] == float(
        settings.llm_timeout_study_plan_seconds
    )
    assert captured_kwargs["timeout_seconds_override"] == 10.0  # 默认值 guard
