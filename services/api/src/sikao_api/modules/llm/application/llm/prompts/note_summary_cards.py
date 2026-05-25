from __future__ import annotations

import json
from typing import Any

from sikao_api.modules.llm.application.llm.prompts._shared import with_tone
from sikao_api.modules.llm.application.llm.provider import LLMMessage


PROMPT_VERSION = "note_summary_cards@v1"

OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["cards"],
    "properties": {
        "cards": {
            "type": "array",
            "minItems": 1,
            "maxItems": 3,
            "items": {
                "type": "object",
                "required": ["text"],
                "properties": {
                    "text": {"type": "string", "minLength": 1, "maxLength": 50},
                },
                "additionalProperties": False,
            },
        }
    },
    "additionalProperties": False,
}


def build_note_summary_cards_messages(
    *,
    body_text: str,
    question_stem: str | None = None,
) -> list[LLMMessage]:
    output_schema = json.dumps(OUTPUT_SCHEMA, ensure_ascii=False, indent=2)
    question_block = f"\n关联题面：{question_stem}" if question_stem else ""
    system_content = with_tone(
        "你是 Sikao 的笔记复盘卡片提炼器。"
        "从用户笔记中提取 1 到 3 张可加入复盘队列的知识卡片。"
        "每张卡片必须是单条可复述的学习要点，长度不超过 50 个字。"
        "只能输出 JSON 对象，不要输出解释文字。\n\n"
        f"JSON Schema:\n{output_schema}"
    )
    user_content = (
        "请根据下面的笔记内容提取复盘卡片。"
        "如果有题面，只把题面当作上下文，不要逐字复述。\n\n"
        f"笔记正文：{body_text}"
        f"{question_block}"
    )
    return [
        LLMMessage(role="system", content=system_content),
        LLMMessage(role="user", content=user_content),
    ]


__all__ = [
    "OUTPUT_SCHEMA",
    "PROMPT_VERSION",
    "build_note_summary_cards_messages",
]
