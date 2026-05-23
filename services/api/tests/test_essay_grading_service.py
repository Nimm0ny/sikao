"""Slice 2c · essay grading service unit + integration tests.

- service 层 unit: submit / get / list / cross-user 404 / non-essay reject
- _build_feedback_with_sanity_check (R10): clamp / 5 维全等 suspicious / sample
  字数偏离 suspicious / overall 重算
- grade_essay_record_async: full happy path with mocked LLM provider; failure
  path (LLM throws / parse fails / persistence fails)
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import Awaitable
from decimal import Decimal
from typing import Any

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from sikao_api.core.config import Settings
from sikao_api.db.base import Base
from sikao_api.db.models import (
    EssayGradingRecord,
    LlmTokenUsage,
    Paper,
    PaperBlock,
    PaperRevision,
    PaperSection,
    Question,
    User,
)
from sikao_api.modules.system.application.errors import NotFoundError, ValidationError
from sikao_api.modules.essay.application.essay_grading import (
    EssayGradingService,
    _build_feedback_with_sanity_check,
    grade_essay_record_async,
)
from sikao_api.modules.llm.application.llm.provider import ChatCompletionResult


def _run(coro: Awaitable) -> None:
    """asyncio.run wrapper — 跟 test_llm_provider.py 同 pattern (避免加 pytest-asyncio)."""
    asyncio.run(coro)  # type: ignore[arg-type]

# ── Fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture
def engine():
    """In-memory SQLite engine shared between request session + background task session."""
    eng = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(eng)
    return eng


@pytest.fixture
def session_factory(engine) -> sessionmaker[Session]:
    return sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False, future=True
    )


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


def _seed_essay_question(
    session: Session,
    *,
    type_payload: dict[str, Any] | None = None,
    user: User | None = None,
) -> tuple[User, Question]:
    if user is None:
        user = User(username="alice", display_name="Alice", password_hash="x")
        session.add(user)
        session.flush()

    paper = Paper(paper_code="ESSAY-T", paper_name="t")
    session.add(paper)
    session.flush()
    revision = PaperRevision(
        paper_id=paper.id,
        revision_number=1,
        sort_order=1,
        paper_name="t",
        question_count=1,
        source_hash="test-hash-essay",
    )
    session.add(revision)
    session.flush()
    sec = PaperSection(
        paper_revision_id=revision.id,
        section_key="s1",
        title="申论",
        instruction_text="",
        display_order=1,
        question_count=1,
    )
    session.add(sec)
    session.flush()
    block = PaperBlock(
        paper_revision_id=revision.id,
        section_id=sec.id,
        block_type="question",
        display_order=1,
    )
    session.add(block)
    session.flush()

    payload = type_payload or {
        "materialTexts": ["材料一 ...", "材料二 ..."],
        "wordLimitMin": 800,
        "wordLimitMax": 1000,
        "fullScore": 40,
    }
    question = Question(
        paper_revision_id=revision.id,
        section_id=sec.id,
        block_id=block.id,
        position=1,
        source_uuid="essay-q1",
        question_kind="essay",
        subtype_name="申论",
        stem_text="<p>题干</p>",
        answer_text="",
        renderer_key="essay",
        is_gradable=False,
        type_payload_json=payload,
    )
    session.add(question)
    session.flush()
    return user, question


# ── EssayGradingService ──────────────────────────────────────────────────────


def test_submit_creates_pending_record(session: Session) -> None:
    user, question = _seed_essay_question(session)
    record = EssayGradingService(session).submit(
        user_id=user.id, question_id=question.id, answer_text="我的论点是..."
    )
    assert record.status == "pending"
    assert record.user_id == user.id
    assert record.score is None
    assert record.feedback_json is None


def test_submit_rejects_non_essay_question(session: Session) -> None:
    user = User(username="u", display_name="u", password_hash="x")
    session.add(user)
    session.flush()
    paper = Paper(paper_code="MCQ-T", paper_name="t")
    session.add(paper)
    session.flush()
    revision = PaperRevision(
        paper_id=paper.id, revision_number=1, sort_order=1, paper_name="t",
        question_count=1, source_hash="test-hash-mcq",
    )
    session.add(revision)
    session.flush()
    sec = PaperSection(
        paper_revision_id=revision.id, section_key="s1", title="x",
        instruction_text="", display_order=1, question_count=1,
    )
    session.add(sec)
    session.flush()
    block = PaperBlock(
        paper_revision_id=revision.id, section_id=sec.id,
        block_type="question", display_order=1,
    )
    session.add(block)
    session.flush()
    q = Question(
        paper_revision_id=revision.id, section_id=sec.id, block_id=block.id,
        position=1, source_uuid="mcq-q1", question_kind="single_choice",
        subtype_name="x", stem_text="x", answer_text="A",
        renderer_key="single_choice",
    )
    session.add(q)
    session.flush()
    with pytest.raises(ValidationError, match="essay"):
        EssayGradingService(session).submit(
            user_id=user.id, question_id=q.id, answer_text="x"
        )


def test_submit_rejects_missing_question(session: Session) -> None:
    user = User(username="u", display_name="u", password_hash="x")
    session.add(user)
    session.flush()
    with pytest.raises(NotFoundError):
        EssayGradingService(session).submit(
            user_id=user.id, question_id=99999, answer_text="x"
        )


def test_get_my_record_cross_user_404(session: Session) -> None:
    user, question = _seed_essay_question(session)
    other = User(username="bob", display_name="Bob", password_hash="x")
    session.add(other)
    session.flush()
    record = EssayGradingService(session).submit(
        user_id=user.id, question_id=question.id, answer_text="x"
    )
    # Other user can't see alice's record
    with pytest.raises(NotFoundError):
        EssayGradingService(session).get_my_record(
            user_id=other.id, record_id=record.id
        )
    # Owner can
    fetched = EssayGradingService(session).get_my_record(
        user_id=user.id, record_id=record.id
    )
    assert fetched.id == record.id


def test_list_my_records_orders_desc_with_limit(session: Session) -> None:
    user, question = _seed_essay_question(session)
    svc = EssayGradingService(session)
    ids = [
        svc.submit(user_id=user.id, question_id=question.id, answer_text=f"a{i}").id
        for i in range(3)
    ]
    listed = svc.list_my_records(user_id=user.id, limit=10)
    # 最新创建的 record id 在最前 (DESC)
    assert [r.id for r in listed] == list(reversed(ids))


# ── _build_feedback_with_sanity_check (R10) ──────────────────────────────────


def _well_formed_llm_output(
    *,
    scores: list[float] | None = None,
    sample_answer: str | None = "示范答案文本",
) -> dict:
    if scores is None:
        scores = [8.0, 7.0, 7.5, 8.0, 9.0]
    assert len(scores) == 5
    return {
        "evaluation": {
            "dimensions": [
                {"name": "论点准确", "score": scores[0], "comment": "c1"},
                {"name": "材料运用", "score": scores[1], "comment": "c2"},
                {"name": "语言", "score": scores[2], "comment": "c3"},
                {"name": "结构", "score": scores[3], "comment": "c4"},
                {"name": "字数符合度", "score": scores[4], "comment": "c5"},
            ],
            "strengths": ["s1"],
            "weaknesses": ["w1"],
            "suggestions": ["sg1"],
        },
        "sample_answer": sample_answer,
    }


def test_build_feedback_overall_recomputed_by_weights() -> None:
    """overallScore 必须按 weight 重算, 不信 LLM 自报值."""
    parsed = _well_formed_llm_output(scores=[10, 10, 10, 10, 10])
    fb = _build_feedback_with_sanity_check(parsed, word_limit_max=None)
    # 全 10 → 1.0 * 10 = 100
    assert fb["overallScore"] == 100.0


def test_build_feedback_clamps_out_of_range_scores() -> None:
    parsed = _well_formed_llm_output(scores=[-5, 15, 8, 7, 9])
    fb = _build_feedback_with_sanity_check(parsed, word_limit_max=None)
    dim_scores = [d["score"] for d in fb["dimensions"]]
    # -5 → 0, 15 → 10
    assert dim_scores == [0.0, 10.0, 8.0, 7.0, 9.0]
    # overall = 0.30*0 + 0.25*10 + 0.20*8 + 0.15*7 + 0.10*9 = 0+2.5+1.6+1.05+0.9 = 6.05
    assert fb["overallScore"] == 60.5


def test_build_feedback_5_dim_all_equal_marks_suspicious() -> None:
    """5 维全相等 (差 ≤0.5) → suspicious=True (LLM 偷懒)."""
    parsed = _well_formed_llm_output(scores=[7.0, 7.0, 7.0, 7.0, 7.0])
    fb = _build_feedback_with_sanity_check(parsed, word_limit_max=None)
    assert fb["suspicious"] is True


def test_build_feedback_5_dim_close_marks_suspicious() -> None:
    """5 维差 ≤0.5 (e.g. 7.0/7.5/7.5/7.5/7.0 max-min=0.5) → suspicious."""
    parsed = _well_formed_llm_output(scores=[7.0, 7.5, 7.5, 7.5, 7.0])
    fb = _build_feedback_with_sanity_check(parsed, word_limit_max=None)
    assert fb["suspicious"] is True


def test_build_feedback_5_dim_diverse_not_suspicious() -> None:
    parsed = _well_formed_llm_output(scores=[6.0, 8.0, 7.0, 9.0, 5.5])
    fb = _build_feedback_with_sanity_check(parsed, word_limit_max=None)
    assert fb["suspicious"] is False


def test_build_feedback_sample_too_short_marks_suspicious() -> None:
    """sample 字数 < wordLimitMax * 0.8 → suspicious."""
    parsed = _well_formed_llm_output(
        scores=[6, 8, 7, 9, 5.5], sample_answer="x" * 100
    )
    fb = _build_feedback_with_sanity_check(parsed, word_limit_max=1000)
    # 100 < 1000 * 0.8 = 800
    assert fb["suspicious"] is True


def test_build_feedback_sample_too_long_marks_suspicious() -> None:
    parsed = _well_formed_llm_output(
        scores=[6, 8, 7, 9, 5.5], sample_answer="x" * 1500
    )
    fb = _build_feedback_with_sanity_check(parsed, word_limit_max=1000)
    # 1500 > 1000 * 1.2 = 1200
    assert fb["suspicious"] is True


def test_build_feedback_sample_in_range_no_suspicious_from_length() -> None:
    parsed = _well_formed_llm_output(
        scores=[6, 8, 7, 9, 5.5], sample_answer="x" * 950
    )
    fb = _build_feedback_with_sanity_check(parsed, word_limit_max=1000)
    # 950 in [800, 1200] → not suspicious from length (5 维 diverse 也 not)
    assert fb["suspicious"] is False


def test_build_feedback_missing_dimension_treated_as_zero() -> None:
    """LLM 漏了一维 → 该维 score=0 + comment=空, overall 重算包含."""
    parsed = {
        "evaluation": {
            "dimensions": [
                {"name": "论点准确", "score": 10, "comment": "ok"},
                # 漏 4 维
            ],
            "strengths": [],
            "weaknesses": [],
            "suggestions": [],
        },
        "sample_answer": None,
    }
    fb = _build_feedback_with_sanity_check(parsed, word_limit_max=None)
    assert len(fb["dimensions"]) == 5
    # 论点准确 30% * 10 + 4 维 0 = 3.0 weighted = 30 overall
    assert fb["overallScore"] == 30.0


def test_build_feedback_invalid_dim_score_falls_to_zero() -> None:
    """LLM 给 'score': 'high' / null → 0 (clamp)."""
    parsed = {
        "evaluation": {
            "dimensions": [
                {"name": n, "score": "garbage", "comment": ""}
                for n in ("论点准确", "材料运用", "语言", "结构", "字数符合度")
            ],
            "strengths": [],
            "weaknesses": [],
            "suggestions": [],
        },
        "sample_answer": None,
    }
    fb = _build_feedback_with_sanity_check(parsed, word_limit_max=None)
    assert all(d["score"] == 0.0 for d in fb["dimensions"])
    assert fb["overallScore"] == 0.0


def test_build_feedback_missing_evaluation_raises() -> None:
    with pytest.raises(ValueError, match="evaluation"):
        _build_feedback_with_sanity_check({"sample_answer": "x"}, word_limit_max=None)


def test_build_feedback_empty_dimensions_list_raises() -> None:
    """2nd review P2-NEW: LLM 返 dimensions: [] 摆烂 → raise, 防 score=0 'completed'
    误导. 跟 name mismatch 同处理."""
    parsed = {
        "evaluation": {
            "dimensions": [],
            "strengths": [],
            "weaknesses": [],
            "suggestions": [],
        },
        "sample_answer": None,
    }
    with pytest.raises(ValueError, match="no recognized dimension name"):
        _build_feedback_with_sanity_check(parsed, word_limit_max=None)


def test_build_feedback_dimension_name_mismatch_raises() -> None:
    """1st review P2-C: LLM 把维度 name 全写成英文 (字段名错位) → raise, 防
    'completed score=0' 误导用户. 没匹配任何预期 name → fail."""
    parsed = {
        "evaluation": {
            "dimensions": [
                {"name": "argument", "score": 8, "comment": "x"},
                {"name": "material", "score": 7, "comment": "y"},
                {"name": "language", "score": 8, "comment": "z"},
                {"name": "structure", "score": 9, "comment": "w"},
                {"name": "word_count", "score": 6, "comment": "v"},
            ],
            "strengths": [],
            "weaknesses": [],
            "suggestions": [],
        },
        "sample_answer": "x",
    }
    with pytest.raises(ValueError, match="no recognized dimension name"):
        _build_feedback_with_sanity_check(parsed, word_limit_max=None)


def test_build_feedback_partial_dimension_match_does_not_raise() -> None:
    """部分匹配 (e.g. 1 维 name 对) 不 raise — 缺失的维度按 0 默认 (有交点说明
    LLM 大致看懂 schema, 别 100% 严格让 PoC 阶段 brittle)."""
    parsed = {
        "evaluation": {
            "dimensions": [
                {"name": "论点准确", "score": 8, "comment": "x"},
                # 4 个英文 name 不匹配
                {"name": "material", "score": 7, "comment": "y"},
            ],
            "strengths": [],
            "weaknesses": [],
            "suggestions": [],
        },
        "sample_answer": None,
    }
    fb = _build_feedback_with_sanity_check(parsed, word_limit_max=None)
    # 论点准确 8 (matched) + 4 维 0 (not matched) = 0.30*8 = 2.4 → 24.0
    assert fb["overallScore"] == 24.0


def test_build_feedback_evaluation_dimensions_not_list_raises() -> None:
    with pytest.raises(ValueError, match="dimensions"):
        _build_feedback_with_sanity_check(
            {"evaluation": {"dimensions": "not-list"}, "sample_answer": "x"},
            word_limit_max=None,
        )


# ── grade_essay_record_async (full path with mocked provider) ────────────────


class _StubProvider:
    """Minimal LLMProvider stub — 返一份 well-formed JSON output."""

    def __init__(self, content: str, model: str = "deepseek-v4-pro") -> None:
        self._content = content
        self._model = model

    async def chat_completion(self, **kwargs):
        return ChatCompletionResult(
            content=self._content,
            prompt_tokens=100,
            prompt_cache_hit_tokens=0,
            prompt_cache_miss_tokens=100,
            completion_tokens=50,
            model=self._model,
            finish_reason="stop",
        )

    def chat_completion_stream(self, **kwargs):
        raise NotImplementedError


def _patch_build_provider(monkeypatch, provider_obj, label: str = "system") -> None:
    monkeypatch.setattr(
        "sikao_api.modules.llm.application.essay_grader.build_llm_provider",
        lambda settings, db=None, user_id=None, timeout_seconds_override=None: (
            provider_obj,
            label,
        ),
    )


def test_grade_essay_happy_path(
    session_factory: sessionmaker[Session],
    settings: Settings,
    monkeypatch,
) -> None:
    sess = session_factory()
    user, question = _seed_essay_question(sess)
    record = EssayGradingService(sess).submit(
        user_id=user.id, question_id=question.id, answer_text="我的论点是..." * 100
    )
    sess.commit()

    payload = _well_formed_llm_output(
        scores=[8, 7, 8, 9, 6], sample_answer="x" * 950
    )
    _patch_build_provider(monkeypatch, _StubProvider(json.dumps(payload)))

    _run(grade_essay_record_async(session_factory, settings, record.id))

    # 用 fresh session 读最新 status
    sess2 = session_factory()
    fresh = sess2.get(EssayGradingRecord, record.id)
    assert fresh is not None
    assert fresh.status == "completed"
    assert fresh.score is not None
    # weighted: 0.30*8+0.25*7+0.20*8+0.15*9+0.10*6 = 2.4+1.75+1.6+1.35+0.6 = 7.7 → 77.0
    assert fresh.score == Decimal("77.00")
    assert fresh.feedback_json is not None
    assert fresh.feedback_json["overallScore"] == 77.0
    assert fresh.feedback_json["sampleAnswer"] == "x" * 950
    assert fresh.feedback_json["suspicious"] is False
    # Token usage row recorded
    assert fresh.token_usage_id is not None
    usage = sess2.get(LlmTokenUsage, fresh.token_usage_id)
    assert usage is not None
    assert usage.feature == "essay_grading"
    assert usage.resource_type == "essay"
    assert usage.resource_id == record.id


def test_grade_essay_provider_build_failed_marks_failed(
    session_factory: sessionmaker[Session],
    settings: Settings,
    monkeypatch,
) -> None:
    """Review polish P2-1: build_llm_provider 抛 (e.g. LLMConfigError 缺 api_key
    / SsrfBlockedError DNS rebind) → record 标 failed + failure_reason 含错误类
    型, 不让异常逃出 BackgroundTask. 之前缺这条专测."""
    from sikao_api.modules.system.application.errors import LLMServiceError

    sess = session_factory()
    user, question = _seed_essay_question(sess)
    record = EssayGradingService(sess).submit(
        user_id=user.id, question_id=question.id, answer_text="x"
    )
    sess.commit()

    def _raise(settings, db=None, user_id=None, timeout_seconds_override=None):
        raise LLMServiceError("api_key not configured", code="llm_config_missing")

    monkeypatch.setattr(
        "sikao_api.modules.llm.application.essay_grader.build_llm_provider", _raise
    )
    _run(grade_essay_record_async(session_factory, settings, record.id))

    sess2 = session_factory()
    fresh = sess2.get(EssayGradingRecord, record.id)
    assert fresh is not None
    assert fresh.status == "failed"
    assert "LLM provider build failed" in (fresh.failure_reason or "")
    assert "LLMServiceError" in (fresh.failure_reason or "")


def test_grade_essay_llm_throws_marks_failed(
    session_factory: sessionmaker[Session],
    settings: Settings,
    monkeypatch,
) -> None:
    sess = session_factory()
    user, question = _seed_essay_question(sess)
    record = EssayGradingService(sess).submit(
        user_id=user.id, question_id=question.id, answer_text="x"
    )
    sess.commit()

    class _Throwing:
        async def chat_completion(self, **kwargs):
            raise TimeoutError("upstream timeout")

        def chat_completion_stream(self, **kwargs):
            raise NotImplementedError

    _patch_build_provider(monkeypatch, _Throwing())
    _run(grade_essay_record_async(session_factory, settings, record.id))

    sess2 = session_factory()
    fresh = sess2.get(EssayGradingRecord, record.id)
    assert fresh is not None
    assert fresh.status == "failed"
    assert "LLM call failed" in (fresh.failure_reason or "")
    assert "TimeoutError" in (fresh.failure_reason or "")


def test_grade_essay_unparseable_json_marks_failed(
    session_factory: sessionmaker[Session],
    settings: Settings,
    monkeypatch,
) -> None:
    sess = session_factory()
    user, question = _seed_essay_question(sess)
    record = EssayGradingService(sess).submit(
        user_id=user.id, question_id=question.id, answer_text="x"
    )
    sess.commit()

    _patch_build_provider(monkeypatch, _StubProvider("not a json {invalid"))
    _run(grade_essay_record_async(session_factory, settings, record.id))

    sess2 = session_factory()
    fresh = sess2.get(EssayGradingRecord, record.id)
    assert fresh is not None
    assert fresh.status == "failed"
    assert "JSON parse failed" in (fresh.failure_reason or "")


def test_grade_essay_already_graded_not_double_processed(
    session_factory: sessionmaker[Session],
    settings: Settings,
    monkeypatch,
) -> None:
    """重复 schedule 同一 record_id 时, 已 completed 的不重跑."""
    sess = session_factory()
    user, question = _seed_essay_question(sess)
    record = EssayGradingService(sess).submit(
        user_id=user.id, question_id=question.id, answer_text="x"
    )
    record.status = "completed"
    record.score = Decimal("88.00")
    sess.commit()

    payload = _well_formed_llm_output()
    provider = _StubProvider(json.dumps(payload))
    _patch_build_provider(monkeypatch, provider)
    _run(grade_essay_record_async(session_factory, settings, record.id))

    sess2 = session_factory()
    fresh = sess2.get(EssayGradingRecord, record.id)
    assert fresh is not None
    # status / score 不被覆盖
    assert fresh.status == "completed"
    assert fresh.score == Decimal("88.00")
