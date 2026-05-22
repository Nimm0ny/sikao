from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sikao_api.db.models_v2 import UserV2

if TYPE_CHECKING:
    from sikao_api.modules.llm.application.service import HomeLlmService, HomeLlmStreamFrame


def create_generated_event_frames(
    service: HomeLlmService,
    *,
    user: UserV2,
    plan_id: int,
    events: list[Any],
    request_id: str | None,
    ip: str | None,
) -> tuple[list[dict[str, Any]], list[HomeLlmStreamFrame]]:
    created_events: list[dict[str, Any]] = []
    frames: list[HomeLlmStreamFrame] = []
    for event in events:
        event_model = service.event_command_service.create_event(
            user=user,
            payload=service._build_generated_event_request(
                plan_id=plan_id,
                event=event.model_dump(mode="python"),
            ),
            request_id=request_id,
            ip=ip,
        )
        created_event = event_model.model_dump(mode="json")
        created_events.append(created_event)
        frames.append(service.build_stream_frame(type_="event", payload={"event": created_event}))
    return created_events, frames
