from __future__ import annotations

from typing import Any

from sikao_api.modules.llm.application.llm.prompts._shared import with_tone
from sikao_api.modules.llm.application.llm.provider import LLMMessage

PROMPT_VERSION = "v1"

OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["passed", "confidence", "reason"],
    "properties": {
        "passed": {"type": "boolean"},
        "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
        "reason": {"type": "string", "minLength": 5, "maxLength": 200},
        "issues": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["dimension", "description"],
                "properties": {
                    "dimension": {
                        "enum": [
                            "answer_correctness",
                            "stem_clarity",
                            "options_balance",
                            "difficulty",
                            "safety",
                        ]
                    },
                    "description": {"type": "string", "minLength": 3},
                },
                "additionalProperties": False,
            },
        },
    },
    "additionalProperties": False,
}

QUESTION_SELF_AUDIT_SYSTEM_MESSAGE = with_tone(
    """你是 Sikao 的题目质量审核员。任务：审查一题改编题是否达到可上线标准。

审查维度：
- answer_correctness：答案与解析是否自洽。
- stem_clarity：题干是否清楚、无歧义。
- options_balance：选项是否均衡，是否存在明显提示。
- difficulty：题目难度是否与目标区间大体匹配。
- safety：内容是否合规。

输出必须是严格 JSON。任何显著问题都应判定 passed=false。
"""
)


def build_question_self_audit_messages(
    *,
    question: dict[str, Any],
    target_difficulty: tuple[float, float],
    source: dict[str, Any] | None = None,
) -> list[LLMMessage]:
    options = question["options"]
    source_block = ""
    if source is not None:
        source_block = (
            f"\n\nSourceQuestionId: {source['id']}\n"
            f"SourceStem: {source['stem']}\n"
            f"SourceCorrectAnswer: {source['correct_answer']}"
        )
    user_prompt = (
        f"请审核以下题目：\n"
        f"SourceQuestionId: {question['source_question_id']}\n"
        f"Type: {question['type']}\n"
        f"Stem: {question['stem']}\n"
        f"Options:\n"
        f"  A. {options['A']}\n"
        f"  B. {options['B']}\n"
        f"  C. {options['C']}\n"
        f"  D. {options['D']}\n"
        f"CorrectAnswer: {question['correct_answer']}\n"
        f"Explanation: {question['explanation']}\n"
        f"EstimatedDifficulty: {question.get('estimated_difficulty')}\n"
        f"TargetDifficultyRange: [{target_difficulty[0]:.2f}, {target_difficulty[1]:.2f}]\n"
        f"{source_block}\n\n"
        "请按 system message 中的 schema 输出。"
    )
    return [
        LLMMessage(role="system", content=QUESTION_SELF_AUDIT_SYSTEM_MESSAGE),
        LLMMessage(role="user", content=user_prompt),
    ]


__all__ = [
    "OUTPUT_SCHEMA",
    "PROMPT_VERSION",
    "QUESTION_SELF_AUDIT_SYSTEM_MESSAGE",
    "build_question_self_audit_messages",
]
