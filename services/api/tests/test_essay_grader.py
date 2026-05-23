from __future__ import annotations

import asyncio

import pytest

from sikao_api.core.config import Settings
from sikao_api.modules.llm.application.essay_grader import (
    ESSAY_GRADING_PROMPT_VERSION,
    grade_essay_with_trace,
)
from sikao_api.modules.llm.application.parsers.grading_parser import (
    EssayGradingPayload,
    parse_grading_output,
)
from _helpers.llm_stubs import well_formed_essay_payload


def _settings() -> Settings:
    return Settings(app_env="test")


def test_parse_grading_output_accepts_well_formed_payload() -> None:
    parsed = parse_grading_output(well_formed_essay_payload())
    assert isinstance(parsed, EssayGradingPayload)
    assert len(parsed.evaluation.dimensions) == 5
    assert parsed.sample_answer


def test_parse_grading_output_rejects_wrong_dimension_order() -> None:
    payload = """
    {
      "evaluation": {
        "dimensions": [
          {"name": "语言", "score": 8, "comment": "ok"},
          {"name": "论点准确", "score": 8, "comment": "ok"},
          {"name": "材料运用", "score": 8, "comment": "ok"},
          {"name": "结构", "score": 8, "comment": "ok"},
          {"name": "字数符合度", "score": 8, "comment": "ok"}
        ],
        "strengths": [],
        "weaknesses": [],
        "suggestions": []
      },
      "sample_answer": "x"
    }
    """
    with pytest.raises(ValueError):
        parse_grading_output(payload)


def test_grade_essay_with_trace_uses_stub_provider() -> None:
    trace = asyncio.run(
        grade_essay_with_trace(
            settings=_settings(),
            question_stem="请结合材料谈谈你的理解。",
            materials=["材料一", "材料二"],
            user_answer="作答内容" * 100,
            word_limit_min=800,
            word_limit_max=1000,
            full_score=40,
        )
    )
    assert trace.prompt_version == ESSAY_GRADING_PROMPT_VERSION
    assert trace.provider == "mock"
    assert trace.model
    assert len(trace.payload.evaluation.dimensions) == 5
    assert trace.usage["prompt_tokens"] is not None
    assert trace.raw_text
