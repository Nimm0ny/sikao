from __future__ import annotations

from typing import TYPE_CHECKING

from sikao_api.modules.llm.application.llm import LLMMessage, build_llm_provider

if TYPE_CHECKING:
    from sikao_api.modules.llm.application.service import HomeLlmService


def provider_name(service: HomeLlmService, *, provider_label: str) -> str:
    if provider_label == "mock":
        return "mock"
    if provider_label == "user_byom":
        return "user_byom"
    if service.settings.llm_provider == "mock":
        return "mock"
    if service.settings.app_env == "test" and not service.settings.llm_api_key:
        return "mock"
    return service.settings.llm_provider


def _default_timeout_seconds(service: HomeLlmService) -> float:
    return float(service.settings.llm_timeout_seconds)


def _timeout_seconds_for_purpose(service: HomeLlmService, *, purpose: str) -> float:
    if purpose in {
        "plan_generate",
        "plan_regenerate_range",
        "recommend_today",
        "plan_adjust",
    }:
        return float(service.settings.llm_timeout_study_plan_seconds)
    return _default_timeout_seconds(service)


async def collect_stream_text(
    service: HomeLlmService,
    *,
    user_id: int,
    purpose: str,
    prompt_version: str,
    messages: list[LLMMessage],
    model: str,
) -> tuple[str, dict[str, int | None], str]:
    provider, provider_label = build_llm_provider(
        service.settings,
        db=service.session,
        user_id=user_id,
        timeout_seconds_override=_timeout_seconds_for_purpose(service, purpose=purpose),
    )
    full_text = ""
    final_usage: dict[str, int | None] = {
        "prompt_tokens": None,
        "completion_tokens": None,
    }
    async for chunk in provider.chat_completion_stream(
        messages=messages,
        model=model,
        max_tokens=service.settings.llm_max_tokens,
        temperature=service.settings.llm_temperature,
    ):
        full_text += chunk.content_delta
        if chunk.is_final:
            final_usage = {
                "prompt_tokens": chunk.prompt_tokens,
                "completion_tokens": chunk.completion_tokens,
            }
    del purpose, prompt_version
    return full_text, final_usage, provider_name(service, provider_label=provider_label)


async def call_json_completion(
    service: HomeLlmService,
    *,
    user_id: int,
    purpose: str,
    prompt_version: str,
    model: str,
    messages: list[LLMMessage],
) -> tuple[str, dict[str, int | None], str]:
    provider, provider_label = build_llm_provider(
        service.settings,
        db=service.session,
        user_id=user_id,
        timeout_seconds_override=_timeout_seconds_for_purpose(service, purpose=purpose),
    )
    result = await provider.chat_completion(
        messages=messages,
        model=model,
        max_tokens=service.settings.llm_max_tokens,
        temperature=service.settings.llm_temperature,
        response_format="json_object",
    )
    del purpose, prompt_version
    return result.content, {
        "prompt_tokens": result.prompt_tokens,
        "completion_tokens": result.completion_tokens,
    }, provider_name(service, provider_label=provider_label)
