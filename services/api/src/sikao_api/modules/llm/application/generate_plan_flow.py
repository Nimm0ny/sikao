from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING

from sikao_api.db.models_v2 import UserV2
from sikao_api.modules.llm.application.flow_replay import build_replay_frames
from sikao_api.modules.llm.application.generated_plan_parsing import parse_generated_plan_response
from sikao_api.modules.llm.application.plan_generator import (
    PLAN_GENERATE_PROMPT_VERSION,
    PlanGenerateParams,
    build_generate_messages,
    build_plan_generate_request_payload,
)
from sikao_api.modules.llm.application.stream_persistence import create_generated_plan_with_frames
from sikao_api.modules.llm.application.stream_abort import cleanup_aborted_stream
from sikao_api.modules.llm.application.stream_success import (
    record_stream_success,
    store_replay_and_build_done_frame,
)

if TYPE_CHECKING:
    from sikao_api.modules.llm.application.service import HomeLlmService, HomeLlmStreamFrame


async def run_generate_plan_stream(
    service: HomeLlmService,
    *,
    user: UserV2,
    params: PlanGenerateParams,
    idempotency_key: str,
    request_id: str | None,
    ip: str | None,
) -> AsyncIterator[HomeLlmStreamFrame]:
    payload = build_plan_generate_request_payload(params=params)
    request_hash = service.build_idempotent_request_hash(payload=payload)
    service._validate_idempotency_key(idempotency_key)
    endpoint = "POST /api/v2/plans/auto-generate"
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
        service.quotas.check_quota(user_id=user.id, purpose="plan_generate")
        messages = build_generate_messages(
            params=service._sanitize_generate_params(params),
            today=service.today_cn(),
            timezone=service.local_timezone,
        )
        raw_text, usage, provider_name = await service._collect_stream_text(
            user_id=user.id,
            purpose="plan_generate",
            prompt_version=PLAN_GENERATE_PROMPT_VERSION,
            messages=messages,
            model=service.settings.llm_model_study_plan,
        )
        parsed = parse_generated_plan_response(
            service,
            user_id=user.id,
            purpose="plan_generate",
            prompt_version=PLAN_GENERATE_PROMPT_VERSION,
            provider_name=provider_name,
            model=service.settings.llm_model_study_plan,
            messages=messages,
            raw_text=raw_text,
            usage=usage,
            empty_error_message="plan_generate returned no events",
            empty_error_code="plan_generate_empty",
        )

        plan, created_events, frames = create_generated_plan_with_frames(
            service,
            user=user,
            params=params,
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
                    purpose="plan_generate",
                    prompt_version=PLAN_GENERATE_PROMPT_VERSION,
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
            purpose="plan_generate",
            prompt_version=PLAN_GENERATE_PROMPT_VERSION,
            provider_name=provider_name,
            model=service.settings.llm_model_study_plan,
            messages=messages,
            raw_text=raw_text,
            parsed_output=parsed.model_dump(mode="json"),
            usage=usage,
        )
        response_body = {
            "plan": plan,
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
                purpose="plan_generate",
                prompt_version=PLAN_GENERATE_PROMPT_VERSION,
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
