"""Prompt builder for Home range regeneration."""

from __future__ import annotations

import json
from typing import Any

from sikao_api.modules.llm.application.llm.prompts._shared import with_tone
from sikao_api.modules.llm.application.llm.provider import LLMMessage

PROMPT_VERSION = "plan_regenerate_range@v2"

SYSTEM_MESSAGE = with_tone(
    "You are Sikao's range plan generator. Return JSON only. "
    "Regenerate events inside the requested date window and keep categories valid. "
    "Every start_at and end_at must be an ISO 8601 datetime with an explicit timezone offset. "
    "Every event object must use the exact keys title, category, subject, start_at, end_at, notes, target_id. "
    "Do not use start, end, description, actionType, or markdown."
)


def build_regenerate_range_messages(*, payload: dict[str, Any]) -> list[LLMMessage]:
    return [
        LLMMessage(role="system", content=SYSTEM_MESSAGE),
        LLMMessage(
            role="user",
            content=(
                "Regenerate the requested plan range as JSON. "
                "Return {events, summary, errors} only.\n"
                'Schema example: {"events":[{"title":"Essay review","category":"essay","subject":"essay","start_at":"2026-06-02T19:00:00+08:00","end_at":"2026-06-02T20:00:00+08:00","notes":"Refine outline and evidence.","target_id":null}],"summary":{"total_minutes":60},"errors":[]}\n'
                "Keys must match the schema exactly. "
                "Do not rename fields. Do not emit prose outside JSON.\n"
                f"{json.dumps(payload, ensure_ascii=False, sort_keys=True)}"
            ),
        ),
    ]
