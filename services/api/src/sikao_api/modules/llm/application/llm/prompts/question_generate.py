from __future__ import annotations

from typing import Any

from sikao_api.modules.llm.application.llm.prompts._shared import with_tone
from sikao_api.modules.llm.application.llm.provider import LLMMessage

PROMPT_VERSION = "v1"

OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["questions"],
    "properties": {
        "questions": {
            "type": "array",
            "minItems": 1,
            "maxItems": 30,
            "items": {
                "type": "object",
                "required": [
                    "source_question_id",
                    "type",
                    "stem",
                    "options",
                    "correct_answer",
                    "explanation",
                ],
                "properties": {
                    "source_question_id": {"type": "integer"},
                    "type": {"enum": ["single_choice", "multi_choice"]},
                    "stem": {"type": "string", "minLength": 10},
                    "options": {
                        "type": "object",
                        "required": ["A", "B", "C", "D"],
                        "additionalProperties": False,
                        "properties": {
                            "A": {"type": "string", "minLength": 1},
                            "B": {"type": "string", "minLength": 1},
                            "C": {"type": "string", "minLength": 1},
                            "D": {"type": "string", "minLength": 1},
                        },
                    },
                    "correct_answer": {"type": "string", "pattern": "^[ABCD]+$"},
                    "explanation": {"type": "string", "minLength": 30},
                    "estimated_difficulty": {
                        "type": "number",
                        "minimum": 0.0,
                        "maximum": 1.0,
                    },
                },
                "additionalProperties": False,
            },
        }
    },
    "additionalProperties": False,
}

QUESTION_GENERATE_SYSTEM_MESSAGE = with_tone(
    """你是 Sikao 的题目生成器。任务：基于给定真题做改编，不要凭空造题。

硬约束：
- 只输出严格 JSON，不要附加解释。
- 每道新题都必须关联一个 source_question_id。
- 新题必须 self-contained，不能依赖外部上下文。
- 单选题 correct_answer 只能有 1 个字母；多选题必须有 2-4 个字母。
- explanation 必须能解释为什么答案成立，且不能空泛。
- 保留原题考点，但题干、选项和表达必须是真正改编，不是复制粘贴。
"""
)


def _format_source(source: dict[str, Any]) -> str:
    options = source.get("options") or {}
    option_lines = "\n".join(
        f"  {key}. {value}" for key, value in sorted(options.items())
    )
    return (
        f"### SourceQuestionId: {source['id']}\n"
        f"Type: {source['type']}\n"
        f"CategoryL1: {source.get('category_l1') or ''}\n"
        f"CategoryL2: {source.get('category_l2') or ''}\n"
        f"Year: {source.get('year') or ''}\n"
        f"Region: {source.get('region') or ''}\n"
        f"ExamType: {source.get('exam_type') or ''}\n"
        f"Stem: {source['stem']}\n"
        f"Options:\n{option_lines}\n"
        f"CorrectAnswer: {source['correct_answer']}\n"
        f"Explanation: {source.get('explanation') or ''}"
    )


def build_question_generate_messages(
    *,
    sources: list[dict[str, Any]],
    target_difficulty: tuple[float, float],
    count: int,
) -> list[LLMMessage]:
    source_block = "\n\n".join(_format_source(source) for source in sources)
    user_prompt = (
        f"请基于以下 source questions 改编生成 {count} 道新题。\n\n"
        f"{source_block}\n\n"
        f"TargetDifficultyRange: [{target_difficulty[0]:.2f}, {target_difficulty[1]:.2f}]\n"
        "输出必须满足 system message 里的 JSON schema。"
    )
    return [
        LLMMessage(role="system", content=QUESTION_GENERATE_SYSTEM_MESSAGE),
        LLMMessage(role="user", content=user_prompt),
    ]


__all__ = [
    "OUTPUT_SCHEMA",
    "PROMPT_VERSION",
    "QUESTION_GENERATE_SYSTEM_MESSAGE",
    "build_question_generate_messages",
]
