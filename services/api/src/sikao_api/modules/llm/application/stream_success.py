from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sikao_api.modules.llm.application.llm import LLMMessage

if TYPE_CHECKING:
    from sikao_api.modules.llm.application.service import HomeLlmService, HomeLlmStreamFrame


def record_stream_success(
    service: HomeLlmService,
    *,
    user_id: int,
    purpose: str,
    prompt_version: str,
    provider_name: str,
    model: str,
    messages: list[LLMMessage],
    raw_text: str,
    parsed_output: dict[str, Any],
    usage: dict[str, int | None],
) -> int:
    llm_call = service._record_success_call(
        user_id=user_id,
        purpose=purpose,
        prompt_version=prompt_version,
        provider=provider_name,
        model=model,
        messages=messages,
        raw_text=raw_text,
        parsed_output=parsed_output,
        usage=usage,
    )
    return llm_call.id


def store_replay_and_build_done_frame(
    service: HomeLlmService,
    *,
    user_id: int,
    endpoint: str,
    idempotency_key: str,
    request_hash: str,
    response_body: dict[str, Any],
) -> HomeLlmStreamFrame:
    service._store_replay(
        user_id=user_id,
        endpoint=endpoint,
        idempotency_key=idempotency_key,
        request_hash=request_hash,
        response_body=response_body,
    )
    return service.build_stream_frame(type_="done", payload=response_body)
