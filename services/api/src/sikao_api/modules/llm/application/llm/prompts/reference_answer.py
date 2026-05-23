from __future__ import annotations

import json
from typing import Any

from sikao_api.modules.llm.application.llm.prompts._shared import with_tone
from sikao_api.modules.llm.application.llm.provider import LLMMessage

PROMPT_VERSION = "reference_answer@v1"
SELF_AUDIT_PROMPT_VERSION = "reference_answer_self_audit@v1"

OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["content", "structure_outline", "key_points"],
    "properties": {
        "content": {"type": "string", "minLength": 100},
        "structure_outline": {
            "type": "array",
            "minItems": 3,
            "items": {"type": "string", "minLength": 2},
        },
        "key_points": {
            "type": "array",
            "minItems": 3,
            "maxItems": 8,
            "items": {"type": "string", "minLength": 2},
        },
        "estimated_score": {
            "type": "number",
            "minimum": 60.0,
            "maximum": 100.0,
        },
    },
    "additionalProperties": False,
}

SELF_AUDIT_OUTPUT_SCHEMA: dict[str, Any] = {
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
                            "grounding",
                            "coverage",
                            "structure",
                            "length",
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

_REFERENCE_OUTPUT_SCHEMA_TEXT = json.dumps(
    OUTPUT_SCHEMA,
    ensure_ascii=False,
    indent=2,
)

_REFERENCE_SELF_AUDIT_SCHEMA_TEXT = json.dumps(
    SELF_AUDIT_OUTPUT_SCHEMA,
    ensure_ascii=False,
    indent=2,
)

REFERENCE_ANSWER_SYSTEM_MESSAGE = with_tone(
    f"""你是 Sikao 的公考申论范文撰写专家。任务：基于题干和材料，写一份高质量范文。
硬约束：
- 严格切题，不能脱离材料编造事实、数据、政策出处。
- 范文目标是高分实战风格，不追求文学性，追求清晰、稳定、可拿分。
- 结构必须完整，至少给出开头、主体展开、结尾总结。
- 字数必须控制在题目要求的 ±10% 区间内。
- 输出字段必须精确为：content / structure_outline / key_points / estimated_score。
- 输出必须是严格 JSON，不要附加解释、markdown fence 或额外文本。

JSON Schema:
{_REFERENCE_OUTPUT_SCHEMA_TEXT}"""
)

REFERENCE_ANSWER_SELF_AUDIT_SYSTEM_MESSAGE = with_tone(
    f"""你是 Sikao 的申论范文质检员。任务：审查一份 AI 范文是否达到可入库标准。
审查维度：
- grounding：是否基于题干和材料，是否存在明显编造。
- coverage：是否回应题干要求，关键论点是否完整。
- structure：结构是否清晰，是否具备可学习的段落组织。
- length：字数是否落在要求区间内。
- safety：内容是否合规、无明显不当表述。
任一显著问题都应判定 passed=false。
- 输出字段必须精确为：passed / confidence / reason / issues。
- 输出必须是严格 JSON。

JSON Schema:
{_REFERENCE_SELF_AUDIT_SCHEMA_TEXT}"""
)


def build_reference_answer_messages(
    *,
    question_stem: str,
    materials: list[str],
    word_limit: int,
) -> list[LLMMessage]:
    material_block = "\n\n".join(
        f"### 材料 {index}\n{text}" for index, text in enumerate(materials, start=1)
    )
    user_prompt = (
        f"请为以下申论题撰写范文：\n\n"
        f"【题目】\n{question_stem}\n\n"
        f"【背景材料】\n{material_block}\n\n"
        f"【字数要求】{word_limit} 字（允许 ±10%）\n\n"
        "请输出完整范文 content、结构大纲 structure_outline、关键得分点 key_points、"
        "可选 estimated_score，并严格遵守 system message 里的 JSON schema。"
    )
    return [
        LLMMessage(role="system", content=REFERENCE_ANSWER_SYSTEM_MESSAGE),
        LLMMessage(role="user", content=user_prompt),
    ]


def build_reference_answer_self_audit_messages(
    *,
    question_stem: str,
    materials: list[str],
    word_limit: int,
    candidate: dict[str, Any],
) -> list[LLMMessage]:
    material_block = "\n\n".join(
        f"### 材料 {index}\n{text}" for index, text in enumerate(materials, start=1)
    )
    outline = "\n".join(f"- {item}" for item in candidate["structure_outline"])
    points = "\n".join(f"- {item}" for item in candidate["key_points"])
    user_prompt = (
        f"请审查以下 AI 范文是否达到可入库标准：\n\n"
        f"【题目】\n{question_stem}\n\n"
        f"【背景材料】\n{material_block}\n\n"
        f"【字数要求】{word_limit} 字（允许 ±10%）\n\n"
        f"【范文正文】\n{candidate['content']}\n\n"
        f"【结构大纲】\n{outline}\n\n"
        f"【关键得分点】\n{points}\n\n"
        f"【模型自估分】{candidate.get('estimated_score')}\n\n"
        "请严格按 system message 里的 JSON schema 输出。"
    )
    return [
        LLMMessage(role="system", content=REFERENCE_ANSWER_SELF_AUDIT_SYSTEM_MESSAGE),
        LLMMessage(role="user", content=user_prompt),
    ]


__all__ = [
    "OUTPUT_SCHEMA",
    "PROMPT_VERSION",
    "REFERENCE_ANSWER_SELF_AUDIT_SYSTEM_MESSAGE",
    "REFERENCE_ANSWER_SYSTEM_MESSAGE",
    "SELF_AUDIT_OUTPUT_SCHEMA",
    "SELF_AUDIT_PROMPT_VERSION",
    "build_reference_answer_messages",
    "build_reference_answer_self_audit_messages",
]
