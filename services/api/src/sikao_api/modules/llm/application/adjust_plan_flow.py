from __future__ import annotations

from datetime import timedelta
from typing import TYPE_CHECKING

from pydantic import ValidationError as PydanticValidationError

from sikao_api.db.models_v2 import PlanAdjustmentV2, UserV2
from sikao_api.modules.llm.application.plan_adjustor import (
    PLAN_ADJUST_PROMPT_VERSION,
    PlanAdjustmentContext,
    build_adjustment_messages,
    parse_adjustment,
)
from sikao_api.modules.llm.application.llm.json_parser import LlmJsonParseError
from sikao_api.modules.plans.application.helpers import now_utc
from sikao_api.modules.system.application.errors import LLMParseError

if TYPE_CHECKING:
    from sikao_api.modules.llm.application.service import HomeLlmService


async def run_adjust_plan(
    service: HomeLlmService,
    *,
    user: UserV2,
    context: PlanAdjustmentContext,
) -> PlanAdjustmentV2 | None:
    service.quotas.check_quota(user_id=user.id, purpose="plan_adjust")
    messages = build_adjustment_messages(context=context)
    raw_text, usage, provider_name = await service._call_json_completion(
        user_id=user.id,
        purpose="plan_adjust",
        prompt_version=PLAN_ADJUST_PROMPT_VERSION,
        model=service.settings.llm_model_study_plan,
        messages=messages,
    )
    try:
        parsed = parse_adjustment(raw_text)
    except LlmJsonParseError as exc:
        service._record_failed_llm_parse(
            user_id=user.id,
            purpose="plan_adjust",
            prompt_version=PLAN_ADJUST_PROMPT_VERSION,
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
            purpose="plan_adjust",
            prompt_version=PLAN_ADJUST_PROMPT_VERSION,
            provider=provider_name,
            model=service.settings.llm_model_study_plan,
            messages=messages,
            raw_text=raw_text,
            usage=usage,
            error=exc,
            parse_status="schema_violation",
        )
        raise LLMParseError("plan_adjust response schema invalid") from exc

    llm_call = service._record_success_call(
        user_id=user.id,
        purpose="plan_adjust",
        prompt_version=PLAN_ADJUST_PROMPT_VERSION,
        provider=provider_name,
        model=service.settings.llm_model_study_plan,
        messages=messages,
        raw_text=raw_text,
        parsed_output=parsed.model_dump(mode="json"),
        usage=usage,
    )
    if parsed.skip_reason:
        return None
    adjustment = PlanAdjustmentV2(
        plan_id=context.plan_id,
        user_id=user.id,
        proposed_at=now_utc(),
        expires_at=now_utc() + timedelta(hours=24),
        reason=parsed.reason,
        changes=[change.model_dump(mode="json") for change in parsed.changes],
        status="pending",
        source=context.source,
        llm_call_id=llm_call.id,
    )
    service.session.add(adjustment)
    service.session.flush()
    return adjustment
