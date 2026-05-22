from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sikao_api.modules.llm.application.service import HomeLlmService, HomeLlmStreamFrame


def build_replay_frames(
    service: HomeLlmService,
    *,
    replay: dict[str, Any],
) -> list[HomeLlmStreamFrame]:
    frames = [
        service.build_stream_frame(type_="event", payload={"event": event_payload})
        for event_payload in replay.get("events", [])
    ]
    frames.append(service.build_stream_frame(type_="done", payload=replay))
    return frames
