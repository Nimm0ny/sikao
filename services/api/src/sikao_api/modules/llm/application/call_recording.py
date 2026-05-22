from __future__ import annotations

from dataclasses import asdict
from typing import TYPE_CHECKING, Any

from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import LlmCallV2
from sikao_api.modules.llm.application.cost_tracker import LlmCallRecord, add_llm_call
from sikao_api.modules.llm.application.llm import LLMMessage

if TYPE_CHECKING:
    from sikao_api.modules.llm.application.service import HomeLlmService


def record_success_call(
    service: HomeLlmService,
    *,
    user_id: int,
    purpose: str,
    prompt_version: str,
    provider: str,
    model: str,
    messages: list[LLMMessage],
    raw_text: str,
    parsed_output: dict[str, Any],
    usage: dict[str, int | None],
) -> LlmCallV2:
    return add_llm_call(
        service.session,
        settings=service.settings,
        record=LlmCallRecord(
            user_id=user_id,
            purpose=purpose,
            prompt_version=prompt_version,
            provider=provider,
            model=model,
            input_tokens=usage.get("prompt_tokens"),
            output_tokens=usage.get("completion_tokens"),
            request_payload={"messages": [asdict(message) for message in messages]},
            response_payload={"content": raw_text},
            parsed_output=parsed_output,
            parse_status="ok",
            error_class=None,
            error_message=None,
            retry_count=0,
            latency_ms=0,
        ),
    )


def record_failed_call(
    service: HomeLlmService,
    *,
    user_id: int,
    purpose: str,
    prompt_version: str,
    provider: str,
    model: str,
    messages: list[LLMMessage],
    raw_text: str,
    usage: dict[str, int | None],
    error: Exception,
    parse_status: str,
) -> None:
    persist_failed_call(
        session=service.session,
        settings=service.settings,
        user_id=user_id,
        purpose=purpose,
        prompt_version=prompt_version,
        provider=provider,
        model=model,
        messages=messages,
        raw_text=raw_text,
        usage=usage,
        error=error,
        parse_status=parse_status,
    )


def persist_failed_call(
    *,
    session: Session,
    settings: Settings,
    user_id: int,
    purpose: str,
    prompt_version: str,
    provider: str,
    model: str,
    messages: list[LLMMessage],
    raw_text: str,
    usage: dict[str, int | None],
    error: Exception,
    parse_status: str,
) -> None:
    add_llm_call(
        session,
        settings=settings,
        record=LlmCallRecord(
            user_id=user_id,
            purpose=purpose,
            prompt_version=prompt_version,
            provider=provider,
            model=model,
            input_tokens=usage.get("prompt_tokens"),
            output_tokens=usage.get("completion_tokens"),
            request_payload={"messages": [asdict(message) for message in messages]},
            response_payload={"content": raw_text},
            parsed_output=None,
            parse_status=parse_status,
            error_class=type(error).__name__,
            error_message=str(error),
            retry_count=0,
            latency_ms=0,
        ),
    )
    session.flush()
