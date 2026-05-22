from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sikao_api.db.models_v2 import UserV2
from sikao_api.modules.llm.application.generated_event_frames import create_generated_event_frames
from sikao_api.modules.llm.application.plan_generator import PlanGenerateParams

if TYPE_CHECKING:
    from sikao_api.modules.llm.application.service import HomeLlmService, HomeLlmStreamFrame


def create_generated_plan_with_frames(
    service: HomeLlmService,
    *,
    user: UserV2,
    params: PlanGenerateParams,
    events: list[Any],
    request_id: str | None,
    ip: str | None,
) -> tuple[dict[str, Any], list[dict[str, Any]], list[HomeLlmStreamFrame]]:
    plan = service.plan_service.create_plan(
        user=user,
        payload=service._build_generated_plan_request(params=params),
        request_id=request_id,
        ip=ip,
    )
    created_events, frames = create_generated_event_frames(
        service,
        user=user,
        plan_id=plan.id,
        events=events,
        request_id=request_id,
        ip=ip,
    )
    return plan.model_dump(mode="json"), created_events, frames


def replace_generated_range_with_frames(
    service: HomeLlmService,
    *,
    user: UserV2,
    plan_id: int,
    from_date: Any,
    to_date: Any,
    events: list[Any],
    request_id: str | None,
    ip: str | None,
) -> tuple[list[dict[str, Any]], list[HomeLlmStreamFrame]]:
    service.event_delete_service.bulk_delete(
        user=user,
        plan_id=plan_id,
        from_date=from_date,
        to_date=to_date,
        source=None,
        dry_run=False,
        request_id=request_id,
        ip=ip,
    )
    return create_generated_event_frames(
        service,
        user=user,
        plan_id=plan_id,
        events=events,
        request_id=request_id,
        ip=ip,
    )
