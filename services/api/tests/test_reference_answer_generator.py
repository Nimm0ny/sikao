from __future__ import annotations

import asyncio

import pytest

from _helpers.llm_stubs import (
    StubLlmProvider,
    well_formed_reference_answer_payload,
    well_formed_reference_audit_payload,
)
from sikao_api.core.config import Settings
from sikao_api.modules.llm.application.llm.provider import ChatCompletionResult
from sikao_api.modules.llm.application.llm.prompts.reference_answer import (
    REFERENCE_ANSWER_SELF_AUDIT_SYSTEM_MESSAGE,
    REFERENCE_ANSWER_SYSTEM_MESSAGE,
    SELF_AUDIT_PROMPT_VERSION,
    build_reference_answer_messages,
    build_reference_answer_self_audit_messages,
)
from sikao_api.modules.llm.application.parsers.reference_parser import (
    parse_reference_answer,
    parse_reference_answer_audit,
)
from sikao_api.modules.llm.application.reference_answer_generator import (
    REFERENCE_ANSWER_PROMPT_VERSION,
    generate_reference_answer,
    generate_reference_answer_with_trace,
)
from sikao_api.modules.system.application.errors import LLMParseError, ValidationError


def _settings() -> Settings:
    return Settings(app_env="test")


class _SequenceProvider:
    def __init__(self, responses: list[str]) -> None:
        self._responses = list(responses)

    async def chat_completion(self, **_kwargs: object) -> ChatCompletionResult:
        if not self._responses:
            raise AssertionError("provider exhausted")
        return await StubLlmProvider(self._responses.pop(0)).chat_completion()


def test_build_reference_answer_messages_include_materials_and_limit() -> None:
    messages = build_reference_answer_messages(
        question_stem="请结合材料作答。",
        materials=["材料一", "材料二"],
        word_limit=1000,
    )
    assert len(messages) == 2
    assert messages[0].content == REFERENCE_ANSWER_SYSTEM_MESSAGE
    assert "材料一" in messages[1].content
    assert "材料二" in messages[1].content
    assert "1000 字" in messages[1].content


def test_reference_answer_system_messages_expose_schema_fields() -> None:
    assert '"content"' in REFERENCE_ANSWER_SYSTEM_MESSAGE
    assert '"structure_outline"' in REFERENCE_ANSWER_SYSTEM_MESSAGE
    assert '"key_points"' in REFERENCE_ANSWER_SYSTEM_MESSAGE
    assert '"passed"' in REFERENCE_ANSWER_SELF_AUDIT_SYSTEM_MESSAGE
    assert '"issues"' in REFERENCE_ANSWER_SELF_AUDIT_SYSTEM_MESSAGE


def test_build_reference_answer_self_audit_messages_include_candidate() -> None:
    candidate = parse_reference_answer(well_formed_reference_answer_payload()).model_dump(
        mode="python"
    )
    messages = build_reference_answer_self_audit_messages(
        question_stem="请结合材料作答。",
        materials=["材料一"],
        word_limit=900,
        candidate=candidate,
    )
    assert len(messages) == 2
    assert messages[0].content == REFERENCE_ANSWER_SELF_AUDIT_SYSTEM_MESSAGE
    assert candidate["content"] in messages[1].content
    assert "开篇点题" in messages[1].content
    assert "900 字" in messages[1].content


def test_parse_reference_answer_rejects_invalid_outline_shape() -> None:
    raw = """
    {
      "content": "甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲",
      "structure_outline": ["只有一段"],
      "key_points": ["a", "b", "c"]
    }
    """
    with pytest.raises(Exception):
        parse_reference_answer(raw)


def test_parse_reference_answer_audit_returns_structured_result() -> None:
    audit = parse_reference_answer_audit(well_formed_reference_audit_payload())
    assert audit.passed is True
    assert audit.confidence > 0.9
    assert not audit.issues


def test_generate_reference_answer_with_trace_runs_generation_and_audit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = _SequenceProvider(
        [
            well_formed_reference_answer_payload(),
            well_formed_reference_audit_payload(),
        ]
    )
    monkeypatch.setattr(
        "sikao_api.modules.llm.application.reference_answer_generator.build_llm_provider",
        lambda *_args, **_kwargs: (provider, "mock"),
    )

    trace = asyncio.run(
        generate_reference_answer_with_trace(
            settings=_settings(),
            question_stem="请结合材料作答。",
            materials=["材料一", "材料二"],
            word_limit=1000,
        )
    )
    assert trace.prompt_version == REFERENCE_ANSWER_PROMPT_VERSION
    assert trace.audit_prompt_version == SELF_AUDIT_PROMPT_VERSION
    assert trace.provider == "mock"
    assert trace.audit_provider == "mock"
    assert trace.result.ai_self_audit_passed is True
    assert trace.result.audit_reason
    assert len(trace.result.structure_outline) == 3
    assert len(trace.result.key_points) == 3


def test_generate_reference_answer_keeps_failed_audit_result(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = _SequenceProvider(
        [
            well_formed_reference_answer_payload(),
            well_formed_reference_audit_payload(
                passed=False,
                reason="Misses one required analytical angle.",
            ),
        ]
    )
    monkeypatch.setattr(
        "sikao_api.modules.llm.application.reference_answer_generator.build_llm_provider",
        lambda *_args, **_kwargs: (provider, "mock"),
    )

    result = asyncio.run(
        generate_reference_answer(
            settings=_settings(),
            question_stem="请结合材料作答。",
            materials=["材料一"],
            word_limit=900,
        )
    )
    assert result.ai_self_audit_passed is False
    assert result.audit_reason == "Misses one required analytical angle."


def test_generate_reference_answer_fail_fast_on_invalid_request() -> None:
    with pytest.raises(ValidationError):
        asyncio.run(
            generate_reference_answer(
                settings=_settings(),
                question_stem="题干",
                materials=[],
                word_limit=80,
            )
        )

    with pytest.raises(ValidationError):
        asyncio.run(
            generate_reference_answer(
                settings=_settings(),
                question_stem="   ",
                materials=["材料一"],
                word_limit=900,
            )
        )


def test_generate_reference_answer_overrides_passed_audit_on_length_violation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = _SequenceProvider(
        [
            well_formed_reference_answer_payload(content_chars=1300),
            well_formed_reference_audit_payload(),
        ]
    )
    monkeypatch.setattr(
        "sikao_api.modules.llm.application.reference_answer_generator.build_llm_provider",
        lambda *_args, **_kwargs: (provider, "mock"),
    )

    trace = asyncio.run(
        generate_reference_answer_with_trace(
            settings=_settings(),
            question_stem="请结合材料作答。",
            materials=["材料一"],
            word_limit=1000,
        )
    )
    assert trace.result.ai_self_audit_passed is False
    assert "outside allowed window" in trace.result.audit_reason
    assert any(issue.dimension == "length" for issue in trace.audit_result.issues)


def test_generate_reference_answer_keeps_failed_audit_when_reason_is_long(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = _SequenceProvider(
        [
            well_formed_reference_answer_payload(content_chars=1300),
            well_formed_reference_audit_payload(
                passed=False,
                reason="x" * 180,
            ),
        ]
    )
    monkeypatch.setattr(
        "sikao_api.modules.llm.application.reference_answer_generator.build_llm_provider",
        lambda *_args, **_kwargs: (provider, "mock"),
    )

    trace = asyncio.run(
        generate_reference_answer_with_trace(
            settings=_settings(),
            question_stem="请结合材料作答。",
            materials=["材料一"],
            word_limit=1000,
        )
    )
    assert trace.result.ai_self_audit_passed is False
    assert len(trace.result.audit_reason) <= 200
    assert any(issue.dimension == "length" for issue in trace.audit_result.issues)


def test_generate_reference_answer_maps_parse_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = _SequenceProvider(["not json", well_formed_reference_audit_payload()])
    monkeypatch.setattr(
        "sikao_api.modules.llm.application.reference_answer_generator.build_llm_provider",
        lambda *_args, **_kwargs: (provider, "mock"),
    )

    with pytest.raises(LLMParseError):
        asyncio.run(
            generate_reference_answer(
                settings=_settings(),
                question_stem="请结合材料作答。",
                materials=["材料一"],
                word_limit=900,
            )
        )
