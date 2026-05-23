from __future__ import annotations

from dataclasses import asdict, dataclass
from collections.abc import Mapping
from typing import Any

from pydantic import ValidationError as PydanticValidationError
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.modules.llm.application.llm import build_llm_provider
from sikao_api.modules.llm.application.llm.json_parser import LlmJsonParseError
from sikao_api.modules.llm.application.llm.prompts.question_generate import (
    PROMPT_VERSION as QUESTION_GENERATE_PROMPT_VERSION,
    build_question_generate_messages,
)
from sikao_api.modules.llm.application.llm.prompts.question_self_audit import (
    PROMPT_VERSION as QUESTION_SELF_AUDIT_PROMPT_VERSION,
    build_question_self_audit_messages,
)
from sikao_api.modules.llm.application.parsers.question_parser import (
    ParsedGeneratedQuestion,
    QuestionAuditResult,
    parse_question_audit,
    parse_question_generation,
)
from sikao_api.modules.system.application.errors import LLMParseError, ValidationError

QUESTION_GENERATION_TIMEOUT_SECONDS = 25.0
QUESTION_SELF_AUDIT_TIMEOUT_SECONDS = 10.0


@dataclass(frozen=True)
class SourceQuestion:
    id: int
    revision_id: int
    subject_kind: str
    type: str
    stem: str
    options: dict[str, str]
    correct_answer: str
    explanation: str = ""
    category_l1: str | None = None
    category_l2: str | None = None
    year: int | None = None
    region: str | None = None
    exam_type: str | None = None


@dataclass(frozen=True)
class QuestionGenerationTrace:
    questions: list[ParsedGeneratedQuestion]
    raw_text: str
    usage: dict[str, int | None]
    provider: str
    model: str
    messages: list[dict[str, str]]
    prompt_version: str


@dataclass(frozen=True)
class QuestionAuditTrace:
    result: QuestionAuditResult
    raw_text: str
    usage: dict[str, int | None]
    provider: str
    model: str
    messages: list[dict[str, str]]
    prompt_version: str


def _serialize_source(source: SourceQuestion) -> dict[str, Any]:
    return asdict(source)


def _serialize_question(question: ParsedGeneratedQuestion) -> dict[str, Any]:
    return question.model_dump(mode="python")


def _annotate_llm_error(
    exc: Exception,
    *,
    prompt_version: str,
    provider: str,
    model: str,
    messages: list[dict[str, str]],
    raw_text: str,
    usage: Mapping[str, int | None],
    parse_status: str,
) -> Exception:
    setattr(exc, "prompt_version_value", prompt_version)
    setattr(exc, "provider_label", provider)
    setattr(exc, "model_used", model)
    setattr(exc, "messages_payload", messages)
    setattr(exc, "raw_text_payload", raw_text)
    setattr(exc, "usage_payload", usage)
    setattr(exc, "parse_status", parse_status)
    return exc


def _validate_generation_request(
    *,
    sources: list[SourceQuestion],
    target_difficulty: tuple[float, float],
    count: int,
) -> None:
    if not sources:
        raise ValidationError(
            "question generation requires at least one source question",
            code="question_generation_sources_required",
        )
    if not 1 <= count <= 30:
        raise ValidationError(
            "question generation count must be between 1 and 30",
            code="question_generation_count_invalid",
        )
    lower, upper = target_difficulty
    if not (0.0 <= lower <= 1.0 and 0.0 <= upper <= 1.0 and lower <= upper):
        raise ValidationError(
            "target difficulty range must stay within [0, 1] and lower <= upper",
            code="question_generation_difficulty_invalid",
        )


def _validate_generation_response(
    *,
    sources: list[SourceQuestion],
    count: int,
    generated_questions: list[ParsedGeneratedQuestion],
) -> None:
    if len(generated_questions) != count:
        raise LLMParseError(
            "llm returned an unexpected number of generated questions",
            code="llm_question_count_mismatch",
        )
    source_ids = {source.id for source in sources}
    for question in generated_questions:
        if question.source_question_id not in source_ids:
            raise LLMParseError(
                "llm returned a generated question bound to an unknown source",
                code="llm_question_source_mismatch",
            )


async def generate_questions(
    *,
    settings: Settings,
    sources: list[SourceQuestion],
    target_difficulty: tuple[float, float],
    count: int,
    db: Session | None = None,
    user_id: int | None = None,
    model: str | None = None,
) -> list[ParsedGeneratedQuestion]:
    return (
        await generate_questions_with_trace(
            settings=settings,
            sources=sources,
            target_difficulty=target_difficulty,
            count=count,
            db=db,
            user_id=user_id,
            model=model,
        )
    ).questions


async def generate_questions_with_trace(
    *,
    settings: Settings,
    sources: list[SourceQuestion],
    target_difficulty: tuple[float, float],
    count: int,
    db: Session | None = None,
    user_id: int | None = None,
    model: str | None = None,
) -> QuestionGenerationTrace:
    _validate_generation_request(
        sources=sources,
        target_difficulty=target_difficulty,
        count=count,
    )
    provider, provider_label = build_llm_provider(
        settings,
        db=db,
        user_id=user_id,
        timeout_seconds_override=QUESTION_GENERATION_TIMEOUT_SECONDS,
    )
    messages = build_question_generate_messages(
        sources=[_serialize_source(source) for source in sources],
        target_difficulty=target_difficulty,
        count=count,
    )
    result = await provider.chat_completion(
        messages=messages,
        model=model or settings.llm_model_qa,
        max_tokens=settings.llm_max_tokens,
        temperature=settings.llm_temperature,
    )
    usage: dict[str, int | None] = {
        "prompt_tokens": result.prompt_tokens,
        "completion_tokens": result.completion_tokens,
    }
    serialized_messages = [asdict(message) for message in messages]
    try:
        generated_questions = parse_question_generation(result.content)
        _validate_generation_response(
            sources=sources,
            count=count,
            generated_questions=generated_questions,
        )
    except LlmJsonParseError as exc:
        raise _annotate_llm_error(
            LLMParseError(str(exc)),
            prompt_version=QUESTION_GENERATE_PROMPT_VERSION,
            provider=provider_label,
            model=result.model,
            messages=serialized_messages,
            raw_text=result.content,
            usage=usage,
            parse_status="invalid_json",
        ) from exc
    except PydanticValidationError as exc:
        raise _annotate_llm_error(
            LLMParseError("question generation response schema invalid"),
            prompt_version=QUESTION_GENERATE_PROMPT_VERSION,
            provider=provider_label,
            model=result.model,
            messages=serialized_messages,
            raw_text=result.content,
            usage=usage,
            parse_status="schema_violation",
        ) from exc
    except LLMParseError as exc:
        raise _annotate_llm_error(
            exc,
            prompt_version=QUESTION_GENERATE_PROMPT_VERSION,
            provider=provider_label,
            model=result.model,
            messages=serialized_messages,
            raw_text=result.content,
            usage=usage,
            parse_status="schema_violation",
        ) from exc
    except ValueError as exc:
        raise _annotate_llm_error(
            LLMParseError(str(exc)),
            prompt_version=QUESTION_GENERATE_PROMPT_VERSION,
            provider=provider_label,
            model=result.model,
            messages=serialized_messages,
            raw_text=result.content,
            usage=usage,
            parse_status="schema_violation",
        ) from exc
    return QuestionGenerationTrace(
        questions=generated_questions,
        raw_text=result.content,
        usage=usage,
        provider=provider_label,
        model=result.model,
        messages=serialized_messages,
        prompt_version=QUESTION_GENERATE_PROMPT_VERSION,
    )


async def self_audit_question(
    *,
    settings: Settings,
    question: ParsedGeneratedQuestion,
    target_difficulty: tuple[float, float],
    source: SourceQuestion | None = None,
    db: Session | None = None,
    user_id: int | None = None,
    model: str | None = None,
) -> QuestionAuditResult:
    return (
        await self_audit_question_with_trace(
            settings=settings,
            question=question,
            target_difficulty=target_difficulty,
            source=source,
            db=db,
            user_id=user_id,
            model=model,
        )
    ).result


async def self_audit_question_with_trace(
    *,
    settings: Settings,
    question: ParsedGeneratedQuestion,
    target_difficulty: tuple[float, float],
    source: SourceQuestion | None = None,
    db: Session | None = None,
    user_id: int | None = None,
    model: str | None = None,
) -> QuestionAuditTrace:
    provider, provider_label = build_llm_provider(
        settings,
        db=db,
        user_id=user_id,
        timeout_seconds_override=QUESTION_SELF_AUDIT_TIMEOUT_SECONDS,
    )
    messages = build_question_self_audit_messages(
        question=_serialize_question(question),
        target_difficulty=target_difficulty,
        source=_serialize_source(source) if source is not None else None,
    )
    result = await provider.chat_completion(
        messages=messages,
        model=model or settings.llm_model_qa,
        max_tokens=settings.llm_max_tokens,
        temperature=settings.llm_temperature,
    )
    return QuestionAuditTrace(
        result=parse_question_audit(result.content),
        raw_text=result.content,
        usage={
            "prompt_tokens": result.prompt_tokens,
            "completion_tokens": result.completion_tokens,
        },
        provider=provider_label,
        model=result.model,
        messages=[asdict(message) for message in messages],
        prompt_version=QUESTION_SELF_AUDIT_PROMPT_VERSION,
    )


__all__ = [
    "ParsedGeneratedQuestion",
    "QuestionAuditTrace",
    "QuestionAuditResult",
    "QuestionGenerationTrace",
    "QUESTION_GENERATE_PROMPT_VERSION",
    "QUESTION_GENERATION_TIMEOUT_SECONDS",
    "QUESTION_SELF_AUDIT_PROMPT_VERSION",
    "QUESTION_SELF_AUDIT_TIMEOUT_SECONDS",
    "SourceQuestion",
    "generate_questions",
    "generate_questions_with_trace",
    "self_audit_question",
    "self_audit_question_with_trace",
]
