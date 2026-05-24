from __future__ import annotations

from sikao_api.modules.llm.application.llm.prompts.cause_analysis_single import (
    build_cause_analysis_single_messages,
)


PROMPT_VERSION = "cause_analysis_forced@v1"


def build_cause_analysis_forced_messages(
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
    mismatch_count: int,
    taxonomy_block: str | None = None,
) -> list:
    forced_context = (
        "ForcedMismatchContext:\n"
        f"- mismatchCount: {mismatch_count}\n"
        "- this analysis was triggered because the user answered incorrectly with high confidence\n"
        "- emphasize why the user thought they understood the concept but still failed"
    )
    return build_cause_analysis_single_messages(
        question_type=question_type,
        category_l1=category_l1,
        category_l2=category_l2,
        question_body=question_body,
        options_text=options_text,
        correct_answer=correct_answer,
        explanation=explanation,
        error_count=error_count,
        answer_history_block=answer_history_block,
        confidence_history=confidence_history,
        avg_duration_s=avg_duration_s,
        duration_ratio=duration_ratio,
        taxonomy_block=taxonomy_block,
        evolution_context_block=forced_context,
    )


__all__ = [
    "PROMPT_VERSION",
    "build_cause_analysis_forced_messages",
]
