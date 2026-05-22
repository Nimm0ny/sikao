"""Prompt builder for Home today recommendations."""

from __future__ import annotations

import json
from typing import Any

from sikao_api.modules.llm.application.llm.prompts._shared import with_tone
from sikao_api.modules.llm.application.llm.provider import LLMMessage

PROMPT_VERSION = "recommend_today@v1"

SYSTEM_MESSAGE = with_tone(
    "You are Sikao's today recommender. Return JSON only. "
    "Produce 2-3 recommendation cards with action_type in review, continue, rest."
)


def build_recommend_today_messages(*, payload: dict[str, Any], policy_header: str) -> list[LLMMessage]:
    return [
        LLMMessage(role="system", content=f"{SYSTEM_MESSAGE}\n\nPolicy:\n{policy_header}"),
        LLMMessage(
            role="user",
            content=(
                "Generate 2-3 recommendation cards as JSON. "
                "Return {recommendations} only.\n"
                f"{json.dumps(payload, ensure_ascii=False, sort_keys=True)}"
            ),
        ),
    ]
