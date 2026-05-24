from __future__ import annotations

import json
from typing import Any

from sikao_api.modules.llm.application.llm.prompts._shared import with_tone
from sikao_api.modules.llm.application.llm.provider import LLMMessage


PROMPT_VERSION = "cause_analysis_single@v1"

CAUSE_TAGS: list[tuple[str, str]] = [
    ("concept_confusion", "概念混淆"),
    ("knowledge_gap", "知识点遗漏"),
    ("formula_misremember", "公式记错"),
    ("boundary_neglect", "边界条件忽略"),
    ("definition_imprecise", "定义不精确"),
    ("comprehension_unclear", "审题不清"),
    ("trap_option", "陷阱中招"),
    ("elimination_mistake", "排除法失误"),
    ("inference_skip", "推理跳步"),
    ("logic_inversion", "逻辑倒置"),
    ("assumption_implicit", "隐含假设"),
    ("careless_calc", "计算粗心"),
    ("time_pressure", "时间不足"),
    ("guess_failed", "蒙猜失败"),
    ("unfamiliar_type", "题型不熟"),
    ("other", "其他"),
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


CAUSE_ANALYSIS_SINGLE_SYSTEM_MESSAGE = with_tone(
    "你是 Sikao 的公考错因分析器。任务：基于单题题面、正确答案、解析、以及用户历史答题记录，"
    "输出结构化错因分析。必须只输出 JSON 对象，不要额外解释。\n\n"
    f"允许的错因 slug：{', '.join(slug for slug, _ in CAUSE_TAGS)}\n\n"
    f"JSON Schema:\n{json.dumps(OUTPUT_SCHEMA, ensure_ascii=False, indent=2)}"
)


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
    evolution_context_block: str | None = None,
) -> list[LLMMessage]:
    evolution_block = evolution_context_block or "无历史分析。"
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
        LLMMessage(role="system", content=CAUSE_ANALYSIS_SINGLE_SYSTEM_MESSAGE),
        LLMMessage(role="user", content=user_content),
    ]


__all__ = [
    "CAUSE_ANALYSIS_SINGLE_SYSTEM_MESSAGE",
    "CAUSE_TAGS",
    "OUTPUT_SCHEMA",
    "PROMPT_VERSION",
    "build_cause_analysis_single_messages",
]
