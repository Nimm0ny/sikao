"""Slice 2c · essay_grading prompt builder unit tests.

Snapshot 比对防 prompt 漂移 (style-guide §1.3 调性约束 + 5 维度顺序 + JSON
schema 描述).
"""

from __future__ import annotations

import pytest

from sikao_api.modules.llm.application.llm.prompts.essay_grading import (
    ESSAY_DIMENSION_NAMES,
    ESSAY_DIMENSION_WEIGHTS,
    ESSAY_DIMENSIONS,
    ESSAY_GRADING_SYSTEM_MESSAGE,
    build_essay_grading_messages,
)


def test_dimensions_order_and_weights() -> None:
    """5 维度顺序固定 + 权重总和 1.0 (R10 重算总分依赖)."""
    names = ESSAY_DIMENSION_NAMES
    assert names == ("论点准确", "材料运用", "语言", "结构", "字数符合度")
    assert sum(w for _, w, _ in ESSAY_DIMENSIONS) == pytest.approx(1.0, abs=1e-9)
    assert ESSAY_DIMENSION_WEIGHTS["论点准确"] == 0.30
    assert ESSAY_DIMENSION_WEIGHTS["字数符合度"] == 0.10


def test_system_message_includes_tone_prefix() -> None:
    """ tone prefix 调性铁律必须 prepend (with_tone wrap)."""
    assert "图书馆隔壁桌" in ESSAY_GRADING_SYSTEM_MESSAGE
    assert "不说\"加油\"" in ESSAY_GRADING_SYSTEM_MESSAGE


def test_system_message_lists_5_dimensions_with_pct() -> None:
    """system 必须含 5 维度 + 百分比 (LLM 看到才能按权重打分)."""
    for name in ESSAY_DIMENSION_NAMES:
        assert name in ESSAY_GRADING_SYSTEM_MESSAGE
    assert "30%" in ESSAY_GRADING_SYSTEM_MESSAGE
    assert "10%" in ESSAY_GRADING_SYSTEM_MESSAGE


def test_system_message_demands_dual_output_schema() -> None:
    """plan §3.4 单 call 双输出: evaluation + sample_answer 两顶级字段."""
    assert '"evaluation"' in ESSAY_GRADING_SYSTEM_MESSAGE
    assert '"sample_answer"' in ESSAY_GRADING_SYSTEM_MESSAGE
    assert "JSON" in ESSAY_GRADING_SYSTEM_MESSAGE


def test_system_message_includes_sample_answer_constraints() -> None:
    """示范答案约束 — 不编造 / ±10% 字数 / 公文体 (plan §4.6)."""
    assert "不能编造" in ESSAY_GRADING_SYSTEM_MESSAGE
    assert "±10%" in ESSAY_GRADING_SYSTEM_MESSAGE
    assert "仅供对照" in ESSAY_GRADING_SYSTEM_MESSAGE


def test_build_messages_returns_system_plus_user() -> None:
    msgs = build_essay_grading_messages(
        question_stem="结合材料 1, 谈谈你的理解",
        materials=["材料一: ...", "材料二: ..."],
        word_limit_min=800,
        word_limit_max=1000,
        full_score=40,
        user_answer="我的论点是...",
    )
    assert len(msgs) == 2
    assert msgs[0].role == "system"
    assert msgs[0].content == ESSAY_GRADING_SYSTEM_MESSAGE
    assert msgs[1].role == "user"


def test_build_messages_user_content_includes_all_required_fields() -> None:
    msgs = build_essay_grading_messages(
        question_stem="题干文字",
        materials=["材料 A 内容", "材料 B 内容"],
        word_limit_min=500,
        word_limit_max=800,
        full_score=30,
        user_answer="用户作答全文",
    )
    user_content = msgs[1].content
    assert "题干文字" in user_content
    assert "材料 A 内容" in user_content
    assert "材料 B 内容" in user_content
    assert "字数下限 500" in user_content
    assert "字数上限 800" in user_content
    assert "满分 30" in user_content
    assert "用户作答全文" in user_content


def test_build_messages_handles_missing_constraints() -> None:
    """word_limit / full_score 全 None 时不 crash, 也不出空段."""
    msgs = build_essay_grading_messages(
        question_stem="题干",
        materials=[],
        word_limit_min=None,
        word_limit_max=None,
        full_score=None,
        user_answer="作答",
    )
    user_content = msgs[1].content
    assert "题目要求" not in user_content  # 没有任何约束 → 不渲此段
    assert "题干" in user_content
    assert "作答" in user_content


def test_build_messages_handles_partial_constraints() -> None:
    """只给 word_limit_max + full_score 不给 min — 渲染只含给的约束."""
    msgs = build_essay_grading_messages(
        question_stem="题干",
        materials=["m1"],
        word_limit_min=None,
        word_limit_max=300,
        full_score=15,
        user_answer="作答",
    )
    user_content = msgs[1].content
    assert "字数上限 300" in user_content
    assert "满分 15" in user_content
    assert "字数下限" not in user_content


def test_build_messages_handles_no_materials() -> None:
    """有的题没有给定材料 (e.g. 自由议论文), materials=[] 时不渲材料段."""
    msgs = build_essay_grading_messages(
        question_stem="议论文题干",
        materials=[],
        word_limit_min=1000,
        word_limit_max=1200,
        full_score=35,
        user_answer="作答",
    )
    user_content = msgs[1].content
    assert "给定材料" not in user_content


def test_build_messages_user_answer_at_end_for_cache_hit() -> None:
    """plan §3.3 R13: user 大头题干 + 材料 (跨用户共享 → cache hit), 答案放末段
    是唯一变 byte. 验证 layout 顺序: 题干 → 材料 → 约束 → 用户答案."""
    msgs = build_essay_grading_messages(
        question_stem="STEM_MARKER",
        materials=["MAT_MARKER"],
        word_limit_min=800,
        word_limit_max=1000,
        full_score=40,
        user_answer="ANSWER_MARKER",
    )
    user_content = msgs[1].content
    # 严格顺序: stem 在前, materials 中, answer 末尾
    stem_pos = user_content.index("STEM_MARKER")
    mat_pos = user_content.index("MAT_MARKER")
    ans_pos = user_content.index("ANSWER_MARKER")
    assert stem_pos < mat_pos < ans_pos
