from __future__ import annotations

import json
from typing import Any

from sikao_api.modules.llm.application.llm.prompts._shared import with_tone
from sikao_api.modules.llm.application.llm.prompts.cause_analysis_single import (
    DEFAULT_TAG_DEFINITIONS,
)
from sikao_api.modules.llm.application.llm.provider import LLMMessage
from sikao_api.modules.review.application.cause_analysis_cache import render_taxonomy_block


PROMPT_VERSION = "cause_analysis_group@v1"

OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["summary", "dimensions", "suggested_actions", "related_questions"],
    "properties": {
        "summary": {"type": "string", "minLength": 10},
        "dimensions": {
            "type": "array",
            "maxItems": 5,
            "items": {
                "type": "object",
                "required": ["slug", "name_display", "severity", "suggestion"],
                "properties": {
                    "slug": {"type": "string"},
                    "name_display": {"type": "string"},
                    "severity": {"enum": ["high", "medium", "low"]},
                    "suggestion": {"type": "string"},
                },
                "additionalProperties": False,
            },
        },
        "suggested_actions": {
            "type": "array",
            "maxItems": 3,
            "items": {"type": "string"},
        },
        "related_questions": {"type": "array", "items": {"type": "integer"}},
    },
    "additionalProperties": False,
}


def build_cause_analysis_group_messages(
    *,
    question_count: int,
    questions_summary_block: str,
    taxonomy_block: str | None = None,
) -> list[LLMMessage]:
    resolved_taxonomy_block = taxonomy_block or render_taxonomy_block(DEFAULT_TAG_DEFINITIONS)
    output_schema = json.dumps(OUTPUT_SCHEMA, ensure_ascii=False, indent=2)
    system_content = with_tone(
        "你是 Sikao 的公考错因分析器。任务：针对多题聚合输入，提炼共同错因模式。"
        "必须只输出 JSON 对象，不要附加说明文字。\n\n"
        f"允许的错因 taxonomy：\n{resolved_taxonomy_block}\n\n"
        f"JSON Schema:\n{output_schema}"
    )
    user_content = (
        f"QuestionCount: {question_count}\n"
        "请聚焦跨题共性，而不是逐题解释。\n\n"
        f"QuestionsSummary:\n{questions_summary_block}"
    )
    return [
        LLMMessage(role="system", content=system_content),
        LLMMessage(role="user", content=user_content),
    ]


__all__ = [
    "OUTPUT_SCHEMA",
    "PROMPT_VERSION",
    "build_cause_analysis_group_messages",
]

