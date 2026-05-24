from __future__ import annotations

import json
from typing import Any

from sikao_api.modules.llm.application.llm.prompts._shared import with_tone
from sikao_api.modules.llm.application.llm.provider import LLMMessage
from sikao_api.modules.review.application.cause_analysis_cache import CauseTagDefinition, render_taxonomy_block
from sikao_api.modules.review.data.cause_tag_seed_v1 import CAUSE_TAG_SEED_V1


PROMPT_VERSION = "cause_analysis_single@v1"

CAUSE_TAGS: list[tuple[str, str]] = [
    (str(row["slug"]), str(row["name"]))
    for row in CAUSE_TAG_SEED_V1
]

DEFAULT_TAG_DEFINITIONS = [
    CauseTagDefinition(
        slug=str(row["slug"]),
        name=str(row["name"]),
        category=str(row["category"]),
        severity_default=str(row["severity_default"]),
        description=str(row["description"]),
        display_order=int(str(row["display_order"])),
        taxonomy_version="v1",
    )
    for row in CAUSE_TAG_SEED_V1
]

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
        "related_questions": {
            "type": "array",
            "items": {"type": "integer"},
        },
        "evolution_context": {
            "type": ["object", "null"],
        },
    },
    "additionalProperties": False,
}


def build_cause_analysis_single_messages(
    *,
    question_type: str,
    category_l1: str,
    category_l2: str,
    question_body: str,
    options_text: str,
    correct_answer: str,
    explanation: str,
    error_count: int,
    answer_history_block: str,
    confidence_history: str,
    avg_duration_s: float,
    duration_ratio: float,
    taxonomy_block: str | None = None,
    evolution_context_block: str | None = None,
) -> list[LLMMessage]:
    resolved_taxonomy_block = taxonomy_block or render_taxonomy_block(DEFAULT_TAG_DEFINITIONS)
    evolution_block = evolution_context_block or "No previous analysis."
    output_schema = json.dumps(OUTPUT_SCHEMA, ensure_ascii=False, indent=2)
    system_content = with_tone(
        "你是 Sikao 的公考错因分析器。任务：基于单题题面、正确答案、解析以及用户历史答题记录，"
        "输出结构化错因分析。必须只输出 JSON 对象，不要额外解释。\n\n"
        f"允许的错因 taxonomy：\n{resolved_taxonomy_block}\n\n"
        f"JSON Schema:\n{output_schema}"
    )
    user_content = (
        f"QuestionType: {question_type}\n"
        f"Category: {category_l1} > {category_l2}\n"
        f"QuestionBody:\n{question_body}\n\n"
        f"Options:\n{options_text}\n\n"
        f"CorrectAnswer: {correct_answer}\n"
        f"Explanation:\n{explanation}\n\n"
        f"ErrorCount: {error_count}\n"
        f"ConfidenceHistory: {confidence_history}\n"
        f"AvgDurationSeconds: {avg_duration_s:.2f}\n"
        f"DurationRatio: {duration_ratio:.2f}\n\n"
        f"AnswerHistory:\n{answer_history_block}\n\n"
        f"EvolutionContext:\n{evolution_block}"
    )
    return [
        LLMMessage(role="system", content=system_content),
        LLMMessage(role="user", content=user_content),
    ]


__all__ = [
    "CAUSE_TAGS",
    "DEFAULT_TAG_DEFINITIONS",
    "OUTPUT_SCHEMA",
    "PROMPT_VERSION",
    "build_cause_analysis_single_messages",
]
