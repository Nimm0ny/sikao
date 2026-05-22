from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import ValidationError as PydanticValidationError

from sikao_api.modules.llm.application.llm import LLMMessage
from sikao_api.modules.llm.application.llm.json_parser import LlmJsonParseError
from sikao_api.modules.llm.application.parsers.plan_output_parser import PlanOutput
from sikao_api.modules.llm.application.plan_generator import parse_generated_plan
from sikao_api.modules.system.application.errors import LLMParseError, ValidationError

if TYPE_CHECKING:
    from sikao_api.modules.llm.application.service import HomeLlmService


def parse_generated_plan_response(
    service: HomeLlmService,
    *,
    user_id: int,
    purpose: str,
    prompt_version: str,
    provider_name: str,
    model: str,
    messages: list[LLMMessage],
    raw_text: str,
    usage: dict[str, int | None],
    empty_error_message: str,
    empty_error_code: str,
) -> PlanOutput:
    try:
        parsed = parse_generated_plan(raw_text)
    except LlmJsonParseError as exc:
        service._record_failed_llm_parse(
            user_id=user_id,
            purpose=purpose,
            prompt_version=prompt_version,
            provider=provider_name,
            model=model,
            messages=messages,
            raw_text=raw_text,
            usage=usage,
            error=exc,
            parse_status="invalid_json",
        )
        raise LLMParseError(str(exc)) from exc
    except PydanticValidationError as exc:
        service._record_failed_llm_parse(
            user_id=user_id,
            purpose=purpose,
            prompt_version=prompt_version,
            provider=provider_name,
            model=model,
            messages=messages,
            raw_text=raw_text,
            usage=usage,
            error=exc,
            parse_status="schema_violation",
        )
        raise LLMParseError(f"{purpose} response schema invalid") from exc
    if not parsed.events:
        raise ValidationError(empty_error_message, code=empty_error_code)
    return parsed
