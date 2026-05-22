"""Prompt builder for Home full-plan generation."""

from __future__ import annotations

import json
from datetime import date
from typing import Any

from sikao_api.modules.llm.application.llm.prompts._shared import with_tone
from sikao_api.modules.llm.application.llm.provider import LLMMessage

PROMPT_VERSION = "plan_generate@v2"

SYSTEM_MESSAGE = with_tone(
    "You are Sikao's plan generator. Return JSON only. "
    "Create future study events for the user. Categories must be one of "
    "xingce, essay, review, mock, break, custom. "
    "Every start_at and end_at must be an ISO 8601 datetime with an explicit timezone offset. "
    "Every event object must use the exact keys title, category, subject, start_at, end_at, notes, target_id. "
    "Do not use start, end, description, actionType, or markdown."
)


def build_plan_generate_messages(
    *,
    today: date,
    timezone: str,
    payload: dict[str, Any],
) -> list[LLMMessage]:
    user_payload = json.dumps(
        {
            "today": today.isoformat(),
            "timezone": timezone,
            **payload,
        },
        ensure_ascii=False,
        sort_keys=True,
    )
    return [
        LLMMessage(role="system", content=SYSTEM_MESSAGE),
        LLMMessage(
            role="user",
            content=(
                "Generate a complete study plan as JSON. "
                "Return {events, summary, errors} only.\n"
                'Schema example: {"events":[{"title":"Xingce verbal drill","category":"xingce","subject":"verbal","start_at":"2026-06-01T09:00:00+08:00","end_at":"2026-06-01T10:30:00+08:00","notes":"Focus on logic fill-in.","target_id":null}],"summary":{"total_minutes":90},"errors":[]}\n'
                "Keys must match the schema exactly. "
                "Do not rename fields. Do not emit prose outside JSON.\n"
                f"{user_payload}"
            ),
        ),
    ]
