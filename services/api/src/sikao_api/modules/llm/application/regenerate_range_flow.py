from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING

from sikao_api.db.models_v2 import UserV2
from sikao_api.modules.llm.application.flow_replay import build_replay_frames
from sikao_api.modules.llm.application.generated_plan_parsing import parse_generated_plan_response
from sikao_api.modules.llm.application.plan_generator import (
    PLAN_REGENERATE_PROMPT_VERSION,
    RegenerateRangeParams,
    build_regenerate_range_hash_payload,
    build_regenerate_messages,
)
from sikao_api.modules.llm.application.regenerate_window import validate_regenerate_window
from sikao_api.modules.llm.application.stream_persistence import replace_generated_range_with_frames
from sikao_api.modules.llm.application.stream_abort import cleanup_aborted_stream
from sikao_api.modules.llm.application.stream_success import (
    record_stream_success,
    store_replay_and_build_done_frame,
)

if TYPE_CHECKING:
    from sikao_api.modules.llm.application.service import HomeLlmService, HomeLlmStreamFrame


async def run_regenerate_range_stream(
    service: HomeLlmService,
    *,
    user: UserV2,
    params: RegenerateRangeParams,
    idempotency_key: str,
    request_id: str | None,
    ip: str | None,
) -> AsyncIterator[HomeLlmStreamFrame]:
    validate_regenerate_window(params=params)

    existing_events = service._load_window_events(
        user_id=user.id,
        plan_id=params.plan_id,
        from_date=params.from_date,
        to_date=params.to_date,
    )
    request_hash = service.build_idempotent_request_hash(
        payload=build_regenerate_range_hash_payload(params=params)
    )
    service._validate_idempotency_key(idempotency_key)
    endpoint = "POST /api/v2/plans/events/regenerate-range"
    replay = service._claim_idempotency_key(
        user_id=user.id,
        endpoint=endpoint,
        idempotency_key=idempotency_key,
        request_hash=request_hash,
    )
    if replay is not None:
        for frame in build_replay_frames(service, replay=replay):
            yield frame
        return

    should_release_claim = True
    try:
        service.quotas.check_quota(user_id=user.id, purpose="plan_regenerate_range")
        messages = build_regenerate_messages(
            params=service._sanitize_regenerate_params(params),
            future_events=existing_events,
        )
        raw_text, usage, provider_name = await service._collect_stream_text(
            user_id=user.id,
            purpose="plan_regenerate_range",
            prompt_version=PLAN_REGENERATE_PROMPT_VERSION,
            messages=messages,
            model=service.settings.llm_model_study_plan,
        )
        parsed = parse_generated_plan_response(
            service,
            user_id=user.id,
            purpose="plan_regenerate_range",
            prompt_version=PLAN_REGENERATE_PROMPT_VERSION,
            provider_name=provider_name,
            model=service.settings.llm_model_study_plan,
            messages=messages,
            raw_text=raw_text,
            usage=usage,
            empty_error_message="plan_regenerate_range returned no events",
            empty_error_code="plan_regenerate_range_empty",
        )

        created_events, frames = replace_generated_range_with_frames(
            service,
            user=user,
            plan_id=params.plan_id,
            from_date=params.from_date,
            to_date=params.to_date,
            events=parsed.events,
            request_id=request_id,
            ip=ip,
        )
        for frame in frames:
            try:
                yield frame
            except (asyncio.CancelledError, GeneratorExit):
                should_release_claim = False
                cleanup_aborted_stream(
                    service,
                    user_id=user.id,
                    purpose="plan_regenerate_range",
                    prompt_version=PLAN_REGENERATE_PROMPT_VERSION,
                    provider_name=provider_name,
                    model=service.settings.llm_model_study_plan,
                    messages=messages,
                    raw_text=raw_text,
                    usage=usage,
                    endpoint=endpoint,
                    idempotency_key=idempotency_key,
                    request_hash=request_hash,
                )
                raise

        llm_call_id = record_stream_success(
            service,
            user_id=user.id,
            purpose="plan_regenerate_range",
            prompt_version=PLAN_REGENERATE_PROMPT_VERSION,
            provider_name=provider_name,
            model=service.settings.llm_model_study_plan,
            messages=messages,
            raw_text=raw_text,
            parsed_output=parsed.model_dump(mode="json"),
            usage=usage,
        )
        response_body = {
            "plan_id": params.plan_id,
            "events": created_events,
            "event_count": len(created_events),
            "llm_call_id": llm_call_id,
        }
        should_release_claim = False
        try:
            yield store_replay_and_build_done_frame(
                service,
                user_id=user.id,
                endpoint=endpoint,
                idempotency_key=idempotency_key,
                request_hash=request_hash,
                response_body=response_body,
            )
        except (asyncio.CancelledError, GeneratorExit):
            should_release_claim = False
            cleanup_aborted_stream(
                service,
                user_id=user.id,
                purpose="plan_regenerate_range",
                prompt_version=PLAN_REGENERATE_PROMPT_VERSION,
                provider_name=provider_name,
                model=service.settings.llm_model_study_plan,
                messages=messages,
                raw_text=raw_text,
                usage=usage,
                endpoint=endpoint,
                idempotency_key=idempotency_key,
                request_hash=request_hash,
            )
            raise
    finally:
        if should_release_claim:
            service._release_idempotency_claim(
                user_id=user.id,
                endpoint=endpoint,
                idempotency_key=idempotency_key,
                request_hash=request_hash,
            )
