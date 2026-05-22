"""Prompt builder for Home plan adjustments."""

from __future__ import annotations

import json
from typing import Any

from sikao_api.modules.llm.application.llm.prompts._shared import with_tone
from sikao_api.modules.llm.application.llm.provider import LLMMessage

PROMPT_VERSION = "plan_adjust@v1"

SYSTEM_MESSAGE = with_tone(
    "You are Sikao's plan adjuster. Return JSON only. "
    "Suggest at most 8 future-only changes. "
    "Output {reason, changes, skip_reason}."
)


def build_plan_adjust_messages(*, payload: dict[str, Any]) -> list[LLMMessage]:
    return [
        LLMMessage(role="system", content=SYSTEM_MESSAGE),
        LLMMessage(
            role="user",
            content=(
                "Generate a future-only adjustment proposal as JSON.\n"
                f"{json.dumps(payload, ensure_ascii=False, sort_keys=True)}"
            ),
        ),
    ]
