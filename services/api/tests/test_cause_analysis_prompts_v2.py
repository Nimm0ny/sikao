from __future__ import annotations

import pytest

from sikao_api.modules.llm.application.llm.prompts.cause_analysis_group import (
    build_cause_analysis_group_messages,
)
from sikao_api.modules.llm.application.llm.prompts.cause_analysis_forced import (
    build_cause_analysis_forced_messages,
)
from sikao_api.modules.llm.application.llm.prompts.cause_analysis_single import (
    build_cause_analysis_single_messages,
)
from sikao_api.modules.llm.application.parsers.cause_analysis_parser import (
    parse_cause_analysis,
    parse_cause_analysis_with_meta,
)


def test_build_cause_analysis_single_messages_embed_required_context() -> None:
    messages = build_cause_analysis_single_messages(
        question_type="single_choice",
        category_l1="verbal",
        category_l2="logic_fill",
        question_body="Question body here",
        options_text="A. one\nB. two\nC. three\nD. four",
        correct_answer="B",
        explanation="Detailed explanation for the source question.",
        error_count=3,
        answer_history_block="2026-05-24 wrong -> A",
        confidence_history="likely,certain",
        avg_duration_s=32.0,
        duration_ratio=1.8,
        evolution_context_block="previous analysis: concept_confusion",
    )
    assert len(messages) == 2
    assert "允许的错因 taxonomy" in messages[0].content
    assert "QuestionType: single_choice" in messages[1].content
    assert "EvolutionContext:" in messages[1].content


def test_build_cause_analysis_group_messages_embed_question_count() -> None:
    messages = build_cause_analysis_group_messages(
        question_count=3,
        questions_summary_block="Q1 wrong A\nQ2 wrong B\nQ3 wrong C",
    )
    assert len(messages) == 2
    assert "允许的错因 taxonomy" in messages[0].content
    assert "QuestionCount: 3" in messages[1].content


def test_build_cause_analysis_forced_messages_embed_mismatch_context() -> None:
    messages = build_cause_analysis_forced_messages(
        question_type="single_choice",
        category_l1="verbal",
        category_l2="logic_fill",
        question_body="Question body here",
        options_text="A. one\nB. two\nC. three\nD. four",
        correct_answer="B",
        explanation="Detailed explanation for the source question.",
        error_count=4,
        answer_history_block="2026-05-24 wrong -> A",
        confidence_history="certain",
        avg_duration_s=40.0,
        duration_ratio=2.2,
        mismatch_count=2,
    )
    assert "ForcedMismatchContext:" in messages[1].content
    assert "mismatchCount: 2" in messages[1].content


def test_parse_cause_analysis_accepts_valid_single_payload() -> None:
    raw = """
    {
      "summary": "你在这类逻辑填空题上反复把近义概念当作等价概念。",
      "dimensions": [
        {
          "slug": "concept_confusion",
          "name_display": "概念混淆",
          "severity": "high",
          "suggestion": "先拆定义，再对照题干限定语。"
        }
      ],
      "suggested_actions": ["整理概念对照表", "重做同类题 3 道"],
      "related_questions": [101, 102],
      "evolution_context": {
        "comparison_judgment": {
          "improved_dimensions": [],
          "persisted_dimensions": ["concept_confusion"],
          "newly_emerged_dimensions": [],
          "actions_likely_completed": [false],
          "overall_trend": "stagnant"
        }
      }
    }
    """
    payload = parse_cause_analysis(raw)
    assert payload.dimensions[0].slug == "concept_confusion"
    assert payload.evolution_context is not None
    assert payload.evolution_context.comparison_judgment.overall_trend == "stagnant"


def test_parse_cause_analysis_accepts_group_payload_with_null_evolution() -> None:
    raw = """
    {
      "summary": "这一组题的共性问题是审题不清与排除链路断裂。",
      "dimensions": [
        {
          "slug": "comprehension_unclear",
          "name_display": "审题不清",
          "severity": "medium",
          "suggestion": "先圈限定词再比较选项。"
        }
      ],
      "suggested_actions": ["先做题干拆解", "再做 2 题验证"],
      "related_questions": [201, 202],
      "evolution_context": null
    }
    """
    payload = parse_cause_analysis(raw)
    assert payload.evolution_context is None
    assert payload.dimensions[0].slug == "comprehension_unclear"


def test_parse_cause_analysis_falls_back_unknown_slug_to_other() -> None:
    raw = """
    {
      "summary": "This payload uses an unknown slug but should still parse via fallback.",
      "dimensions": [
        {
          "slug": "not_allowed",
          "name_display": "Bad",
          "severity": "low",
          "suggestion": "Nope"
        }
      ],
      "suggested_actions": ["x"],
      "related_questions": []
    }
    """
    parsed = parse_cause_analysis_with_meta(raw)
    payload = parsed.payload
    assert payload.dimensions[0].slug == "other"
    assert payload.dimensions[0].llm_original is not None
    assert parsed.fallback_count == 1


def test_parse_cause_analysis_rejects_invalid_json() -> None:
    with pytest.raises(Exception):
        parse_cause_analysis("not json at all")
