from __future__ import annotations

import json

from sikao_api.modules.llm.application.llm.prompts._shared import with_tone
from sikao_api.modules.llm.application.llm.prompts.cause_analysis_single import (
    DEFAULT_TAG_DEFINITIONS,
    OUTPUT_SCHEMA,
)
from sikao_api.modules.llm.application.llm.provider import LLMMessage
from sikao_api.modules.review.application.cause_analysis_cache import render_taxonomy_block


PROMPT_VERSION = "cause_analysis_deep@v1"


def build_cause_analysis_deep_messages(
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
    re_fail_count: int,
    total_wrong_count: int,
    historical_dimensions_freq: dict[str, int],
    taxonomy_block: str | None = None,
) -> list[LLMMessage]:
    resolved_taxonomy_block = taxonomy_block or render_taxonomy_block(DEFAULT_TAG_DEFINITIONS)
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
        "DeepHardQuestionContext:\n"
        f"- reFailCount: {re_fail_count}\n"
        f"- totalWrongCount: {total_wrong_count}\n"
        f"- historicalDimensionsFreq: {historical_dimensions_freq}\n"
        "- this item is already marked as a hard question and needs a deeper diagnosis than the normal single analysis\n"
        "- focus on repeated failure pattern, misconception persistence, and a tighter corrective action plan"
    )
    return [
        LLMMessage(role="system", content=system_content),
        LLMMessage(role="user", content=user_content),
    ]


__all__ = [
    "PROMPT_VERSION",
    "build_cause_analysis_deep_messages",
]
