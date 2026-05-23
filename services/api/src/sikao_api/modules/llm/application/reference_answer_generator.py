from __future__ import annotations

from dataclasses import asdict, dataclass

from pydantic import ValidationError as PydanticValidationError
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.modules.llm.application.llm import build_llm_provider
from sikao_api.modules.llm.application.llm.json_parser import LlmJsonParseError
from sikao_api.modules.llm.application.llm.prompts.reference_answer import (
    PROMPT_VERSION as REFERENCE_ANSWER_PROMPT_VERSION,
    SELF_AUDIT_PROMPT_VERSION as REFERENCE_ANSWER_SELF_AUDIT_PROMPT_VERSION,
    build_reference_answer_messages,
    build_reference_answer_self_audit_messages,
)
from sikao_api.modules.llm.application.parsers.reference_parser import (
    ReferenceAnswerAuditIssue,
    ReferenceAnswerAuditResult,
    ReferenceAnswerPayload,
    parse_reference_answer,
    parse_reference_answer_audit,
)
from sikao_api.modules.system.application.errors import LLMParseError, LLMServiceError, ValidationError

REFERENCE_GENERATION_TIMEOUT_SECONDS = 45.0
REFERENCE_SELF_AUDIT_TIMEOUT_SECONDS = 15.0
_AUDIT_REASON_MAX_LENGTH = 200


@dataclass(frozen=True)
class ReferenceAnswer:
    content: str
    structure_outline: list[str]
    key_points: list[str]
    estimated_score: float | None
    ai_self_audit_passed: bool
    audit_reason: str


@dataclass(frozen=True)
class ReferenceAnswerTrace:
    result: ReferenceAnswer
    generation_payload: ReferenceAnswerPayload
    audit_result: ReferenceAnswerAuditResult
    raw_text: str
    audit_raw_text: str
    usage: dict[str, int]
    audit_usage: dict[str, int]
    provider: str
    model: str
    messages: list[dict[str, str]]
    prompt_version: str
    audit_provider: str
    audit_model: str
    audit_messages: list[dict[str, str]]
    audit_prompt_version: str


@dataclass(frozen=True)
class ReferenceAnswerDraftTrace:
    payload: ReferenceAnswerPayload
    raw_text: str
    usage: dict[str, int]
    provider: str
    model: str
    messages: list[dict[str, str]]
    prompt_version: str


@dataclass(frozen=True)
class ReferenceAnswerAuditTrace:
    result: ReferenceAnswerAuditResult
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


def _validate_request(
    *,
    question_stem: str,
    materials: list[str],
    word_limit: int,
) -> None:
    if not question_stem.strip():
        raise ValidationError(
            "reference answer question_stem cannot be blank",
            code="reference_stem_blank",
        )
    if not materials:
        raise ValidationError(
            "reference answer generation requires at least one material",
            code="reference_materials_required",
        )
    if any(not item.strip() for item in materials):
        raise ValidationError(
            "reference answer materials cannot contain blank entries",
            code="reference_material_blank",
        )
    if word_limit < 100:
        raise ValidationError(
            "reference answer word_limit must be at least 100",
            code="reference_word_limit_invalid",
        )


def _build_length_issue(
    *,
    actual_length: int,
    min_length: int,
    max_length: int,
) -> ReferenceAnswerAuditResult:
    return ReferenceAnswerAuditResult(
        passed=False,
        confidence=1.0,
        reason=(
            f"reference answer length {actual_length} is outside allowed window "
            f"[{min_length}, {max_length}]"
        ),
        issues=[
            ReferenceAnswerAuditIssue(
                dimension="length",
                description=(
                    f"content length {actual_length} is outside [{min_length}, {max_length}]"
                ),
            )
        ],
    )


def _enforce_local_constraints(
    *,
    payload: ReferenceAnswerPayload,
    audit: ReferenceAnswerAuditResult,
    word_limit: int,
) -> ReferenceAnswerAuditResult:
    min_length = int(word_limit * 0.9)
    max_length = int(word_limit * 1.1)
    actual_length = len(payload.content.strip())
    if min_length <= actual_length <= max_length:
        return audit
    if not audit.passed:
        audit_payload = audit.model_dump(mode="python")
        merged_reason = (
            f"{audit.reason}; content length {actual_length} is outside "
            f"[{min_length}, {max_length}]"
        )
        if len(merged_reason) > _AUDIT_REASON_MAX_LENGTH:
            merged_reason = (
                f"content length {actual_length} is outside "
                f"[{min_length}, {max_length}]"
            )
        return ReferenceAnswerAuditResult.model_validate(
            {
                **audit_payload,
                "issues": [
                    *audit_payload["issues"],
                    {
                        "dimension": "length",
                        "description": (
                            f"content length {actual_length} is outside [{min_length}, {max_length}]"
                        ),
                    },
                ],
                "reason": merged_reason,
            }
        )
    return _build_length_issue(
        actual_length=actual_length,
        min_length=min_length,
        max_length=max_length,
    )


def _build_result(
    *,
    payload: ReferenceAnswerPayload,
    audit: ReferenceAnswerAuditResult,
) -> ReferenceAnswer:
    return ReferenceAnswer(
        content=payload.content,
        structure_outline=list(payload.structure_outline),
        key_points=list(payload.key_points),
        estimated_score=payload.estimated_score,
        ai_self_audit_passed=audit.passed,
        audit_reason=audit.reason,
    )


async def generate_reference_answer(
    *,
    settings: Settings,
    question_stem: str,
    materials: list[str],
    word_limit: int,
    db: Session | None = None,
    user_id: int | None = None,
    model: str | None = None,
    audit_model: str | None = None,
) -> ReferenceAnswer:
    return (
        await generate_reference_answer_with_trace(
            settings=settings,
            question_stem=question_stem,
            materials=materials,
            word_limit=word_limit,
            db=db,
            user_id=user_id,
            model=model,
            audit_model=audit_model,
        )
    ).result


async def generate_reference_answer_with_trace(
    *,
    settings: Settings,
    question_stem: str,
    materials: list[str],
    word_limit: int,
    db: Session | None = None,
    user_id: int | None = None,
    model: str | None = None,
    audit_model: str | None = None,
) -> ReferenceAnswerTrace:
    _validate_request(
        question_stem=question_stem,
        materials=materials,
        word_limit=word_limit,
    )
    try:
        provider, provider_label = build_llm_provider(
            settings,
            db=db,
            user_id=user_id,
            timeout_seconds_override=REFERENCE_GENERATION_TIMEOUT_SECONDS,
        )
    except LLMServiceError as exc:
        raise LLMServiceError(
            f"reference answer provider build failed: {type(exc).__name__}: {exc.message}",
            code=exc.code,
        ) from exc
    except Exception as exc:  # noqa: BLE001
        raise LLMServiceError(
            f"reference answer provider build failed: {type(exc).__name__}: {exc}"
        ) from exc

    messages = build_reference_answer_messages(
        question_stem=question_stem,
        materials=materials,
        word_limit=word_limit,
    )
    try:
        result = await provider.chat_completion(
            messages=messages,
            model=model or settings.llm_model_essay,
            max_tokens=settings.llm_max_tokens,
            temperature=0.4,
        )
    except LLMServiceError as exc:
        raise LLMServiceError(
            f"reference answer chat completion failed: {type(exc).__name__}: {exc.message}",
            code=exc.code,
        ) from exc
    except Exception as exc:  # noqa: BLE001
        raise LLMServiceError(
            f"reference answer chat completion failed: {type(exc).__name__}: {exc}"
        ) from exc

    try:
        payload = parse_reference_answer(result.content)
    except LlmJsonParseError as exc:
        raise LLMParseError(str(exc)) from exc
    except PydanticValidationError as exc:
        raise LLMParseError("reference answer response schema invalid") from exc
    except ValueError as exc:
        raise LLMParseError(str(exc)) from exc

    try:
        audit_provider, audit_provider_label = build_llm_provider(
            settings,
            db=db,
            user_id=user_id,
            timeout_seconds_override=REFERENCE_SELF_AUDIT_TIMEOUT_SECONDS,
        )
    except LLMServiceError as exc:
        raise LLMServiceError(
            f"reference answer self audit provider build failed: {type(exc).__name__}: {exc.message}",
            code=exc.code,
        ) from exc
    except Exception as exc:  # noqa: BLE001
        raise LLMServiceError(
            f"reference answer self audit provider build failed: {type(exc).__name__}: {exc}"
        ) from exc

    audit_messages = build_reference_answer_self_audit_messages(
        question_stem=question_stem,
        materials=materials,
        word_limit=word_limit,
        candidate=payload.model_dump(mode="python"),
    )
    try:
        audit_completion = await audit_provider.chat_completion(
            messages=audit_messages,
            model=audit_model or model or settings.llm_model_essay,
            max_tokens=settings.llm_max_tokens,
            temperature=0.2,
        )
    except LLMServiceError as exc:
        raise LLMServiceError(
            f"reference answer self audit chat completion failed: {type(exc).__name__}: {exc.message}",
            code=exc.code,
        ) from exc
    except Exception as exc:  # noqa: BLE001
        raise LLMServiceError(
            f"reference answer self audit chat completion failed: {type(exc).__name__}: {exc}"
        ) from exc

    try:
        audit = parse_reference_answer_audit(audit_completion.content)
    except LlmJsonParseError as exc:
        raise LLMParseError(str(exc)) from exc
    except PydanticValidationError as exc:
        raise LLMParseError("reference answer self audit response schema invalid") from exc
    except ValueError as exc:
        raise LLMParseError(str(exc)) from exc
    audit = _enforce_local_constraints(
        payload=payload,
        audit=audit,
        word_limit=word_limit,
    )

    return ReferenceAnswerTrace(
        result=_build_result(payload=payload, audit=audit),
        generation_payload=payload,
        audit_result=audit,
        raw_text=result.content,
        audit_raw_text=audit_completion.content,
        usage={
            "prompt_tokens": result.prompt_tokens,
            "prompt_cache_hit_tokens": result.prompt_cache_hit_tokens,
            "prompt_cache_miss_tokens": result.prompt_cache_miss_tokens,
            "completion_tokens": result.completion_tokens,
        },
        audit_usage={
            "prompt_tokens": audit_completion.prompt_tokens,
            "prompt_cache_hit_tokens": audit_completion.prompt_cache_hit_tokens,
            "prompt_cache_miss_tokens": audit_completion.prompt_cache_miss_tokens,
            "completion_tokens": audit_completion.completion_tokens,
        },
        provider=provider_label,
        model=result.model,
        messages=[asdict(message) for message in messages],
        prompt_version=REFERENCE_ANSWER_PROMPT_VERSION,
        audit_provider=audit_provider_label,
        audit_model=audit_completion.model,
        audit_messages=[asdict(message) for message in audit_messages],
        audit_prompt_version=REFERENCE_ANSWER_SELF_AUDIT_PROMPT_VERSION,
    )


__all__ = [
    "REFERENCE_ANSWER_PROMPT_VERSION",
    "REFERENCE_ANSWER_SELF_AUDIT_PROMPT_VERSION",
    "REFERENCE_GENERATION_TIMEOUT_SECONDS",
    "REFERENCE_SELF_AUDIT_TIMEOUT_SECONDS",
    "ReferenceAnswer",
    "ReferenceAnswerTrace",
    "generate_reference_answer",
    "generate_reference_answer_with_trace",
]
