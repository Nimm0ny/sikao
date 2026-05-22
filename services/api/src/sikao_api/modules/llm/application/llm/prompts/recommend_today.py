"""Prompt builder for Home today recommendations."""

from __future__ import annotations

import json
from typing import Any

from sikao_api.modules.llm.application.llm.prompts._shared import with_tone
from sikao_api.modules.llm.application.llm.provider import LLMMessage

PROMPT_VERSION = "recommend_today@v2"

SYSTEM_MESSAGE = with_tone(
    "You are Sikao's today recommender. Return JSON only. "
    "Produce 2-3 recommendation cards with action_type in review, continue, rest. "
    "Every recommendation object must contain exactly these keys: "
    "title, reason, estimated_minutes, action_type, cta, payload. "
    "Do not use description, actionType, estimatedMinutes, start, end, markdown, or extra keys."
)


def build_recommend_today_messages(*, payload: dict[str, Any], policy_header: str) -> list[LLMMessage]:
    return [
        LLMMessage(role="system", content=f"{SYSTEM_MESSAGE}\n\nPolicy:\n{policy_header}"),
        LLMMessage(
            role="user",
            content=(
                "Generate 2-3 recommendation cards as JSON. "
                "Return {recommendations} only.\n"
                'Schema example: {"recommendations":[{"title":"Review weak items first","reason":"Why this is the best next action","estimated_minutes":20,"action_type":"review","cta":"Review","payload":{"session_template":{"track":"xingce","entry_kind":"review"}}}]}\n'
                "Keys must match the schema exactly. "
                "Do not rename fields. Do not emit prose outside JSON.\n"
                f"{json.dumps(payload, ensure_ascii=False, sort_keys=True)}"
            ),
        ),
    ]
