"""Facade for Home LLM-backed planning, adjustment, and recommendation flows."""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy.orm import Session as SqlAlchemySession

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import LlmCallV2, PlanAdjustmentV2, UserV2
from sikao_api.db.schemas_v2 import PlanCreateRequestV2, PlanEventCreateRequestV2
from sikao_api.modules.llm.application.adjust_plan_flow import run_adjust_plan
from sikao_api.modules.llm.application.cache import (
    get_cached_value,
    invalidate_user_prefix,
    set_cached_value,
)
from sikao_api.modules.llm.application.call_execution import call_json_completion, collect_stream_text, provider_name
from sikao_api.modules.llm.application.call_recording import persist_failed_call, record_failed_call, record_success_call
from sikao_api.modules.llm.application.execution_lock import hold_user_execution_lock
from sikao_api.modules.llm.application.generate_plan_flow import run_generate_plan_stream
from sikao_api.modules.llm.application.idempotency import (
    build_idempotent_request_hash,
    claim_idempotency_key,
    get_replay,
    release_idempotency_claim,
    store_replay,
    validate_idempotency_key,
)
from sikao_api.modules.llm.application.llm import LLMMessage
from sikao_api.modules.llm.application.plan_adjustor import PlanAdjustmentContext
from sikao_api.modules.llm.application.plan_generator import PlanGenerateParams, RegenerateRangeParams
from sikao_api.modules.llm.application.quotas import HomeLlmQuotaService
from sikao_api.modules.llm.application.recommend_today_flow import run_recommend_today
from sikao_api.modules.llm.application.recommender import RecommendationContext
from sikao_api.modules.llm.application.regenerate_range_flow import run_regenerate_range_stream
from sikao_api.modules.llm.application.request_builders import (
    build_generated_event_request,
    build_generated_plan_request,
    normalize_datetime,
    sanitize_generate_params,
    sanitize_regenerate_params,
)
from sikao_api.modules.llm.application.window_queries import build_recommendation_cache_key, load_window_events
from sikao_api.modules.plans.application.event_command_service import EventCommandServiceV2
from sikao_api.modules.plans.application.event_delete_service import EventDeleteServiceV2
from sikao_api.modules.plans.application.helpers import today_cn
from sikao_api.modules.plans.application.plan_service import PlanServiceV2

_LOCAL_TZ = "Asia/Shanghai"


@dataclass(frozen=True)
class HomeLlmStreamFrame:
    type: str
    payload: dict[str, Any]


class HomeLlmService:
    def __init__(self, session: Session, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        self.quotas = HomeLlmQuotaService(session, settings)
        self.plan_service = PlanServiceV2(session)
        self.event_command_service = EventCommandServiceV2(session)
        self.event_delete_service = EventDeleteServiceV2(session)

    @property
    def local_timezone(self) -> str:
        return _LOCAL_TZ

    @staticmethod
    def today_cn() -> date:
        return today_cn()

    @staticmethod
    def build_stream_frame(*, type_: str, payload: dict[str, Any]) -> HomeLlmStreamFrame:
        return HomeLlmStreamFrame(type=type_, payload=payload)

    def build_idempotent_request_hash(self, *, payload: dict[str, Any]) -> str:
        return build_idempotent_request_hash(payload=payload)

    def invalidate_recommendation_cache(self, *, user_id: int) -> None:
        invalidate_user_prefix(
            ttl_seconds=self.settings.llm_cache_ttl_seconds,
            user_prefix=f"recommend_today:{user_id}:",
        )

    def _get_cached_recommendation(self, *, cache_key: str) -> tuple[list[dict[str, object]], LlmCallV2] | None:
        cached = get_cached_value(
            ttl_seconds=self.settings.llm_cache_ttl_seconds,
            key=cache_key,
        )
        if cached is None:
            return None
        rows, llm_call_id = cached
        llm_call = self.session.get(LlmCallV2, llm_call_id)
        if llm_call is None:
            return None
        return rows, llm_call

    def _set_cached_recommendation(
        self, *, cache_key: str, rows: list[dict[str, object]], llm_call_id: int
    ) -> None:
        set_cached_value(
            ttl_seconds=self.settings.llm_cache_ttl_seconds,
            key=cache_key,
            value=(rows, llm_call_id),
        )

    def _record_failed_llm_parse(
        self,
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
        with SqlAlchemySession(bind=self.session.get_bind()) as isolated_session:
            persist_failed_call(
                session=isolated_session,
                settings=self.settings,
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
            isolated_session.commit()

    async def generate_plan_stream(
        self,
        *,
        user: UserV2,
        params: PlanGenerateParams,
        idempotency_key: str,
        request_id: str | None,
        ip: str | None,
    ) -> AsyncIterator[HomeLlmStreamFrame]:
        async with hold_user_execution_lock(user_id=user.id):
            async for frame in run_generate_plan_stream(
                self,
                user=user,
                params=params,
                idempotency_key=idempotency_key,
                request_id=request_id,
                ip=ip,
            ):
                yield frame

    async def regenerate_range_stream(
        self,
        *,
        user: UserV2,
        params: RegenerateRangeParams,
        idempotency_key: str,
        request_id: str | None,
        ip: str | None,
    ) -> AsyncIterator[HomeLlmStreamFrame]:
        async with hold_user_execution_lock(user_id=user.id):
            async for frame in run_regenerate_range_stream(
                self,
                user=user,
                params=params,
                idempotency_key=idempotency_key,
                request_id=request_id,
                ip=ip,
            ):
                yield frame

    async def recommend_today(
        self,
        *,
        user: UserV2,
        context: RecommendationContext,
    ) -> tuple[list[dict[str, Any]], LlmCallV2]:
        async with hold_user_execution_lock(user_id=user.id):
            return await run_recommend_today(self, user=user, context=context)

    async def adjust_plan(
        self,
        *,
        user: UserV2,
        context: PlanAdjustmentContext,
    ) -> PlanAdjustmentV2 | None:
        async with hold_user_execution_lock(user_id=user.id):
            return await run_adjust_plan(self, user=user, context=context)

    async def _collect_stream_text(
        self,
        *,
        user_id: int,
        purpose: str,
        prompt_version: str,
        messages: list[LLMMessage],
        model: str,
    ) -> tuple[str, dict[str, int | None], str]:
        return await collect_stream_text(
            self,
            user_id=user_id,
            purpose=purpose,
            prompt_version=prompt_version,
            messages=messages,
            model=model,
        )

    async def _call_json_completion(
        self,
        *,
        user_id: int,
        purpose: str,
        prompt_version: str,
        model: str,
        messages: list[LLMMessage],
    ) -> tuple[str, dict[str, int | None], str]:
        return await call_json_completion(
            self,
            user_id=user_id,
            purpose=purpose,
            prompt_version=prompt_version,
            model=model,
            messages=messages,
        )
