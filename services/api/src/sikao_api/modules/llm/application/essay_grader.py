from __future__ import annotations

from dataclasses import asdict, dataclass

from pydantic import ValidationError as PydanticValidationError
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.modules.llm.application.llm import build_llm_provider
from sikao_api.modules.llm.application.llm.json_parser import LlmJsonParseError
from sikao_api.modules.llm.application.llm.prompts.essay_grading import (
    PROMPT_VERSION as ESSAY_GRADING_PROMPT_VERSION,
    build_essay_grading_messages,
)
from sikao_api.modules.llm.application.parsers.grading_parser import (
    EssayGradingPayload,
    parse_grading_output,
)
from sikao_api.modules.system.application.errors import LLMParseError, LLMServiceError

ESSAY_GRADING_TIMEOUT_SECONDS = 60.0


@dataclass(frozen=True)
class EssayGradingTrace:
    payload: EssayGradingPayload
    raw_text: str
    usage: dict[str, int]
    provider: str
    model: str
    messages: list[dict[str, str]]
    prompt_version: str


def _annotate_llm_error(
    exc: Exception,
    *,
    prompt_version: str,
    provider: str,
    model: str,
    messages: list[dict[str, str]],
    raw_text: str,
    usage: dict[str, int | None],
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


async def grade_essay(
    *,
    settings: Settings,
    question_stem: str,
    materials: list[str],
    user_answer: str,
    word_limit_min: int | None,
    word_limit_max: int | None,
    full_score: int | None,
    db: Session | None = None,
    user_id: int | None = None,
    model: str | None = None,
) -> EssayGradingPayload:
    return (
        await grade_essay_with_trace(
            settings=settings,
            question_stem=question_stem,
            materials=materials,
            user_answer=user_answer,
            word_limit_min=word_limit_min,
            word_limit_max=word_limit_max,
            full_score=full_score,
            db=db,
            user_id=user_id,
            model=model,
        )
    ).payload


async def grade_essay_with_trace(
    *,
    settings: Settings,
    question_stem: str,
    materials: list[str],
    user_answer: str,
    word_limit_min: int | None,
    word_limit_max: int | None,
    full_score: int | None,
    db: Session | None = None,
    user_id: int | None = None,
    model: str | None = None,
) -> EssayGradingTrace:
    try:
        provider, provider_label = build_llm_provider(
            settings,
            db=db,
            user_id=user_id,
            timeout_seconds_override=ESSAY_GRADING_TIMEOUT_SECONDS,
        )
    except LLMServiceError as exc:
        raise LLMServiceError(
            f"essay grading provider build failed: {type(exc).__name__}: {exc.message}",
            code=exc.code,
        ) from exc
    except Exception as exc:  # noqa: BLE001 - caller maps to failed grading state
        raise LLMServiceError(
            f"essay grading provider build failed: {type(exc).__name__}: {exc}"
        ) from exc
    messages = build_essay_grading_messages(
        question_stem=question_stem,
        materials=materials,
        word_limit_min=word_limit_min,
        word_limit_max=word_limit_max,
        full_score=full_score,
        user_answer=user_answer,
    )
    try:
        result = await provider.chat_completion(
            messages=messages,
            model=model or settings.llm_model_essay,
            max_tokens=settings.llm_max_tokens,
            temperature=0.3,
            response_format="json_object",
        )
    except LLMServiceError as exc:
        raise LLMServiceError(
            f"essay grading chat completion failed: {type(exc).__name__}: {exc.message}",
            code=exc.code,
        ) from exc
    except Exception as exc:  # noqa: BLE001 - caller maps to failed grading state
        raise LLMServiceError(
            f"essay grading chat completion failed: {type(exc).__name__}: {exc}"
        ) from exc
    try:
        parsed = parse_grading_output(result.content)
    except LlmJsonParseError as exc:
        raise _annotate_llm_error(
            LLMParseError(str(exc)),
            prompt_version=ESSAY_GRADING_PROMPT_VERSION,
            provider=provider_label,
            model=result.model,
            messages=[asdict(message) for message in messages],
            raw_text=result.content,
            usage={
                "prompt_tokens": result.prompt_tokens,
                "prompt_cache_hit_tokens": result.prompt_cache_hit_tokens,
                "prompt_cache_miss_tokens": result.prompt_cache_miss_tokens,
                "completion_tokens": result.completion_tokens,
            },
            parse_status="invalid_json",
        ) from exc
    except PydanticValidationError as exc:
        raise _annotate_llm_error(
            LLMParseError("essay grading response schema invalid"),
            prompt_version=ESSAY_GRADING_PROMPT_VERSION,
            provider=provider_label,
            model=result.model,
            messages=[asdict(message) for message in messages],
            raw_text=result.content,
            usage={
                "prompt_tokens": result.prompt_tokens,
                "prompt_cache_hit_tokens": result.prompt_cache_hit_tokens,
                "prompt_cache_miss_tokens": result.prompt_cache_miss_tokens,
                "completion_tokens": result.completion_tokens,
            },
            parse_status="schema_violation",
        ) from exc
    except ValueError as exc:
        raise _annotate_llm_error(
            LLMParseError(str(exc)),
            prompt_version=ESSAY_GRADING_PROMPT_VERSION,
            provider=provider_label,
            model=result.model,
            messages=[asdict(message) for message in messages],
            raw_text=result.content,
            usage={
                "prompt_tokens": result.prompt_tokens,
                "prompt_cache_hit_tokens": result.prompt_cache_hit_tokens,
                "prompt_cache_miss_tokens": result.prompt_cache_miss_tokens,
                "completion_tokens": result.completion_tokens,
            },
            parse_status="schema_violation",
        ) from exc
    return EssayGradingTrace(
        payload=parsed,
        raw_text=result.content,
        usage={
            "prompt_tokens": result.prompt_tokens,
            "prompt_cache_hit_tokens": result.prompt_cache_hit_tokens,
            "prompt_cache_miss_tokens": result.prompt_cache_miss_tokens,
            "completion_tokens": result.completion_tokens,
        },
        provider=provider_label,
        model=result.model,
        messages=[asdict(message) for message in messages],
        prompt_version=ESSAY_GRADING_PROMPT_VERSION,
    )


__all__ = [
    "ESSAY_GRADING_PROMPT_VERSION",
    "ESSAY_GRADING_TIMEOUT_SECONDS",
    "EssayGradingTrace",
    "grade_essay",
    "grade_essay_with_trace",
]
