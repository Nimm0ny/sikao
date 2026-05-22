from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import ValidationError as PydanticValidationError

from sikao_api.db.models_v2 import LlmCallV2, UserV2
from sikao_api.modules.llm.application.recommender import (
    RECOMMEND_TODAY_PROMPT_VERSION,
    RecommendationContext,
    build_recommendation_messages,
    parse_recommendations,
)
from sikao_api.modules.llm.application.llm.json_parser import LlmJsonParseError
from sikao_api.modules.system.application.errors import LLMParseError

if TYPE_CHECKING:
    from sikao_api.modules.llm.application.service import HomeLlmService


async def run_recommend_today(
    service: HomeLlmService,
    *,
    user: UserV2,
    context: RecommendationContext,
) -> tuple[list[dict[str, object]], LlmCallV2]:
    cache_key = service._build_recommendation_cache_key(user_id=user.id, payload=context.payload)
    cached = service._get_cached_recommendation(cache_key=cache_key)
    if cached is not None:
        return cached

    service.quotas.check_quota(user_id=user.id, purpose="recommend_today")
    messages = build_recommendation_messages(context=context)
    raw_text, usage, provider_name = await service._call_json_completion(
        user_id=user.id,
        purpose="recommend_today",
        prompt_version=RECOMMEND_TODAY_PROMPT_VERSION,
        model=service.settings.llm_model_study_plan,
        messages=messages,
    )
    try:
        parsed = parse_recommendations(raw_text)
    except LlmJsonParseError as exc:
        service._record_failed_llm_parse(
            user_id=user.id,
            purpose="recommend_today",
            prompt_version=RECOMMEND_TODAY_PROMPT_VERSION,
            provider=provider_name,
            model=service.settings.llm_model_study_plan,
            messages=messages,
            raw_text=raw_text,
            usage=usage,
            error=exc,
            parse_status="invalid_json",
        )
        raise LLMParseError(str(exc)) from exc
    except PydanticValidationError as exc:
        service._record_failed_llm_parse(
            user_id=user.id,
            purpose="recommend_today",
            prompt_version=RECOMMEND_TODAY_PROMPT_VERSION,
            provider=provider_name,
            model=service.settings.llm_model_study_plan,
            messages=messages,
            raw_text=raw_text,
            usage=usage,
            error=exc,
            parse_status="schema_violation",
        )
        raise LLMParseError("recommend_today response schema invalid") from exc

    llm_call = service._record_success_call(
        user_id=user.id,
        purpose="recommend_today",
        prompt_version=RECOMMEND_TODAY_PROMPT_VERSION,
        provider=provider_name,
        model=service.settings.llm_model_study_plan,
        messages=messages,
        raw_text=raw_text,
        parsed_output=parsed.model_dump(mode="json"),
        usage=usage,
    )
    rows = [item.model_dump(mode="json") for item in parsed.recommendations]
    service._set_cached_recommendation(cache_key=cache_key, rows=rows, llm_call_id=llm_call.id)
    return rows, llm_call
