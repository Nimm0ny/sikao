from __future__ import annotations

import asyncio

import pytest

from sikao_api.core.config import Settings
from sikao_api.modules.llm.application.llm.provider import ChatCompletionResult
from sikao_api.modules.llm.application.llm.prompts.question_generate import (
    QUESTION_GENERATE_SYSTEM_MESSAGE,
    build_question_generate_messages,
)
from sikao_api.modules.llm.application.llm.prompts.question_self_audit import (
    QUESTION_SELF_AUDIT_SYSTEM_MESSAGE,
    build_question_self_audit_messages,
)
from sikao_api.modules.llm.application.parsers.question_parser import (
    QuestionAuditResult,
    parse_question_audit,
    parse_question_generation,
)
from sikao_api.modules.llm.application.question_generator import (
    SourceQuestion,
    generate_questions,
    self_audit_question,
)
from sikao_api.modules.system.application.errors import LLMParseError, ValidationError


def _settings() -> Settings:
    return Settings(app_env="test")


def _sources() -> list[SourceQuestion]:
    return [
        SourceQuestion(
            id=101,
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
        ),
        SourceQuestion(
            id=202,
            type="multi_choice",
            stem="Source question two asks for multiple valid policy trade-offs.",
            options={
                "A": "Trade-off A",
                "B": "Trade-off B",
                "C": "Trade-off C",
                "D": "Trade-off D",
            },
            correct_answer="AC",
            explanation="A and C are both supported by the material and the others are not.",
            category_l1="verbal",
            category_l2="reading",
            year=2023,
            region="shanghai",
            exam_type="municipal",
        ),
    ]


def test_build_question_generate_messages_embed_sources_and_constraints() -> None:
    messages = build_question_generate_messages(
        sources=[source.__dict__ for source in _sources()],
        target_difficulty=(0.2, 0.4),
        count=2,
    )
    assert len(messages) == 2
    assert messages[0].role == "system"
    assert messages[0].content == QUESTION_GENERATE_SYSTEM_MESSAGE
    assert "SourceQuestionId: 101" in messages[1].content
    assert "SourceQuestionId: 202" in messages[1].content
    assert "TargetDifficultyRange: [0.20, 0.40]" in messages[1].content
    assert "改编生成 2 道新题" in messages[1].content


def test_build_question_self_audit_messages_include_question_and_source() -> None:
    question = {
        "source_question_id": 101,
        "type": "single_choice",
        "stem": "Generated stem for audit.",
        "options": {"A": "a", "B": "b", "C": "c", "D": "d"},
        "correct_answer": "B",
        "explanation": "Detailed explanation for audit path coverage.",
        "estimated_difficulty": 0.4,
    }
    messages = build_question_self_audit_messages(
        question=question,
        target_difficulty=(0.2, 0.4),
        source=_sources()[0].__dict__,
    )
    assert len(messages) == 2
    assert messages[0].content == QUESTION_SELF_AUDIT_SYSTEM_MESSAGE
    assert "SourceQuestionId: 101" in messages[1].content
    assert "Generated stem for audit." in messages[1].content
    assert "SourceStem:" in messages[1].content
    assert "TargetDifficultyRange: [0.20, 0.40]" in messages[1].content


def test_parse_question_generation_rejects_invalid_single_choice_answer() -> None:
    raw = """
    {
      "questions": [
        {
          "source_question_id": 101,
          "type": "single_choice",
          "stem": "This stem is long enough to validate.",
          "options": {"A": "a", "B": "b", "C": "c", "D": "d"},
          "correct_answer": "AB",
          "explanation": "This explanation is deliberately long enough to pass length validation."
        }
      ]
    }
    """
    with pytest.raises(Exception):
        parse_question_generation(raw)


def test_parse_question_generation_rejects_duplicate_answer_letters() -> None:
    raw = """
    {
      "questions": [
        {
          "source_question_id": 101,
          "type": "single_choice",
          "stem": "This stem is long enough to validate.",
          "options": {"A": "a", "B": "b", "C": "c", "D": "d"},
          "correct_answer": "AA",
          "explanation": "This explanation is deliberately long enough to pass length validation."
        }
      ]
    }
    """
    with pytest.raises(Exception):
        parse_question_generation(raw)


def test_parse_question_audit_returns_structured_result() -> None:
    raw = """
    {
      "passed": true,
      "confidence": 0.88,
      "reason": "The question is internally consistent.",
      "issues": []
    }
    """
    result = parse_question_audit(raw)
    assert isinstance(result, QuestionAuditResult)
    assert result.passed is True
    assert result.confidence == pytest.approx(0.88)


def test_generate_questions_uses_stub_provider_and_preserves_source_ids() -> None:
    questions = asyncio.run(
        generate_questions(
            settings=_settings(),
            sources=_sources(),
            target_difficulty=(0.2, 0.4),
            count=2,
        )
    )
    assert len(questions) == 2
    assert [question.source_question_id for question in questions] == [101, 202]
    assert questions[0].type == "single_choice"
    assert questions[1].type == "multi_choice"


def test_generate_questions_fail_fast_on_invalid_request() -> None:
    with pytest.raises(ValidationError):
        asyncio.run(
            generate_questions(
                settings=_settings(),
                sources=[],
                target_difficulty=(0.4, 0.2),
                count=0,
            )
        )


def test_generate_questions_rejects_count_or_source_mismatch(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeProvider:
        async def chat_completion(self, **_kwargs: object) -> ChatCompletionResult:
            return ChatCompletionResult(
                content=(
                    '{"questions": [{"source_question_id": 999, "type": "single_choice", '
                    '"stem": "This stem is long enough to validate.", '
                    '"options": {"A": "a", "B": "b", "C": "c", "D": "d"}, '
                    '"correct_answer": "A", '
                    '"explanation": "This explanation is deliberately long enough to pass length validation."}]}'
                ),
                prompt_tokens=10,
                prompt_cache_hit_tokens=0,
                prompt_cache_miss_tokens=10,
                completion_tokens=20,
                model="fake-model",
                finish_reason="stop",
            )

    monkeypatch.setattr(
        "sikao_api.modules.llm.application.question_generator.build_llm_provider",
        lambda *_args, **_kwargs: (FakeProvider(), "mock"),
    )

    with pytest.raises(LLMParseError):
        asyncio.run(
            generate_questions(
                settings=_settings(),
                sources=_sources(),
                target_difficulty=(0.2, 0.4),
                count=2,
            )
        )


def test_self_audit_question_uses_stub_provider() -> None:
    generated_question = asyncio.run(
        generate_questions(
            settings=_settings(),
            sources=_sources(),
            target_difficulty=(0.2, 0.4),
            count=1,
        )
    )[0]
    audit = asyncio.run(
        self_audit_question(
            settings=_settings(),
            question=generated_question,
            target_difficulty=(0.2, 0.4),
            source=_sources()[0],
        )
    )
    assert audit.passed is True
    assert audit.confidence > 0.8
    assert not audit.issues
