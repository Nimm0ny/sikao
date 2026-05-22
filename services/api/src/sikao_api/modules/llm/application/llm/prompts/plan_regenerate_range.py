"""Prompt builder for Home range regeneration."""

from __future__ import annotations

import json
from typing import Any

from sikao_api.modules.llm.application.llm.prompts._shared import with_tone
from sikao_api.modules.llm.application.llm.provider import LLMMessage

PROMPT_VERSION = "plan_regenerate_range@v1"

SYSTEM_MESSAGE = with_tone(
    "You are Sikao's range plan generator. Return JSON only. "
    "Regenerate events inside the requested date window and keep categories valid. "
    "Every start_at and end_at must be an ISO 8601 datetime with an explicit timezone offset."
)


def build_regenerate_range_messages(*, payload: dict[str, Any]) -> list[LLMMessage]:
    return [
        LLMMessage(role="system", content=SYSTEM_MESSAGE),
        LLMMessage(
            role="user",
            content=(
                "Regenerate the requested plan range as JSON. "
                "Return {events, summary, errors} only.\n"
                f"{json.dumps(payload, ensure_ascii=False, sort_keys=True)}"
            ),
        ),
    ]
