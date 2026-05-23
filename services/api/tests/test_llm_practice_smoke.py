from __future__ import annotations

import asyncio

import pytest

from sikao_api.core.config import Settings
from sikao_api.modules.llm.application.question_generator import SourceQuestion, generate_questions
from sikao_api.modules.llm.application.essay_grader import grade_essay_with_trace
from sikao_api.modules.llm.application.reference_answer_generator import generate_reference_answer_with_trace


def _real_settings() -> Settings:
    settings = Settings(_env_file=None)  # type: ignore[call-arg]
    if not settings.llm_api_key:
        pytest.skip("LLM_API_KEY not configured")
    return settings


def _sources() -> list[SourceQuestion]:
    return [
        SourceQuestion(
            id=101,
            revision_id=11,
            subject_kind="xingce",
            type="single_choice",
            stem="Source question one asks about logical consistency in a short passage.",
            options={
                "A": "Choice one",
                "B": "Choice two",
                "C": "Choice three",
                "D": "Choice four",
            },
            correct_answer="B",
            explanation="Because choice B is the only option consistent with the passage.",
            category_l1="verbal",
            category_l2="logic_fill",
            year=2024,
            region="beijing",
            exam_type="provincial",
        )
    ]


def test_smoke_real_question_generation() -> None:
    settings = _real_settings()
    questions = asyncio.run(
        generate_questions(
            settings=settings,
            sources=_sources(),
            target_difficulty=(0.2, 0.4),
            count=1,
        )
    )
    assert len(questions) == 1
    assert questions[0].source_question_id == 101


def test_smoke_real_essay_grading() -> None:
    settings = _real_settings()
    trace = asyncio.run(
        grade_essay_with_trace(
            settings=settings,
            question_stem="请结合材料谈谈你的理解。",
            materials=["材料一", "材料二"],
            user_answer="作答内容" * 100,
            word_limit_min=800,
            word_limit_max=1000,
            full_score=40,
        )
    )
    assert len(trace.payload.evaluation.dimensions) == 5
    assert trace.raw_text


def test_smoke_real_reference_generation() -> None:
    settings = _real_settings()
    trace = asyncio.run(
        generate_reference_answer_with_trace(
            settings=settings,
            question_stem="请结合材料谈谈基层治理现代化的关键抓手。",
            materials=["材料一：基层治理需要协同。", "材料二：数字化不是目的而是手段。"],
            word_limit=1000,
        )
    )
    assert trace.result.content
    assert len(trace.result.structure_outline) >= 3
