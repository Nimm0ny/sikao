"""申论批改 prompt builder — Slice 2c.

单 call 双输出 (plan §3.4): system 强制 LLM 返 JSON 含 evaluation (5 维度评分)
+ sample_answer (AI 生成示范答案) 两顶级字段, 节省一次 LLM call vs 评分和示范
答案各一 call.

5 维度 (plan §3.4 表格):
  论点准确 30% — 是否回应题干 / 论据是否对应给定材料
  材料运用 25% — 是否引用材料原话 / 是否过度抄袭
  语言 20% — 表达是否准确 / 是否有公文体感
  结构 15% — 是否有清晰开头-论证-结尾
  字数符合度 10% — 题干字数要求是否满足

R10 sanity check 在 service 层做 (单维 clamp [0,10] + 总分按权重重算 + 5 维全
相等标 suspicious + sample_answer 字数偏离 ±20% 标 suspicious). 这里只构造
prompt + 描述输出格式, 不做校验.

prompt builder 是纯函数, 不直接拿 ORM 实体, db 解耦 (跟 qa.py 一致). question
+ 用户答案文本由 service 层从 ORM 提取后传入.
"""

from __future__ import annotations

from sikao_api.modules.llm.application.llm.prompts._shared import with_tone
from sikao_api.modules.llm.application.llm.provider import LLMMessage

# 5 维度 + 权重 + 评分细则. 顺序固定 (业务层 sanity check / weight 计算依赖).
ESSAY_DIMENSIONS: list[tuple[str, float, str]] = [
    ("论点准确", 0.30, "是否回应题干 / 论据是否对应给定材料"),
    ("材料运用", 0.25, "是否引用材料原话 / 是否过度抄袭原文"),
    ("语言", 0.20, "表达是否准确 / 是否有公文体感"),
    ("结构", 0.15, "是否有清晰开头-论证-结尾"),
    ("字数符合度", 0.10, "题干字数要求是否满足 (上下界都看)"),
]

ESSAY_DIMENSION_NAMES = tuple(name for name, _w, _r in ESSAY_DIMENSIONS)
ESSAY_DIMENSION_WEIGHTS: dict[str, float] = {
    name: weight for name, weight, _ in ESSAY_DIMENSIONS
}


def _format_dimensions_for_prompt() -> str:
    """5 维度描述 markdown 化, 拼到 system prompt 里给 LLM 参考."""
    lines = ["## 评分维度 (5 项, 权重总和 1.0):"]
    for name, weight, rubric in ESSAY_DIMENSIONS:
        pct = int(weight * 100)
        lines.append(f"- {name} ({pct}%): {rubric}")
    return "\n".join(lines)


_ESSAY_GRADING_SYSTEM_BODY = f"""\
你的任务是评估用户提交的申论作答, 给出 5 维度评分 + 写作建议 + AI 示范答案.
严格按 JSON 格式输出, 不要附加任何说明文字 / markdown fence.

{_format_dimensions_for_prompt()}

## 输出 schema (top-level JSON 必须含 `evaluation` + `sample_answer` 两字段):

```
{{
  "evaluation": {{
    "dimensions": [
      {{"name": "论点准确", "score": 0-10, "comment": "<不超 60 字>"}},
      {{"name": "材料运用", "score": 0-10, "comment": "..."}},
      {{"name": "语言", "score": 0-10, "comment": "..."}},
      {{"name": "结构", "score": 0-10, "comment": "..."}},
      {{"name": "字数符合度", "score": 0-10, "comment": "..."}}
    ],
    "strengths": ["<1-3 条优点, 每条不超 40 字>"],
    "weaknesses": ["<1-3 条问题, 每条不超 40 字>"],
    "suggestions": ["<1-3 条改进, 每条不超 40 字>"]
  }},
  "sample_answer": "<示范答案全文, 字数严格按题干要求>"
}}
```

## 评分硬约束:

- score 是 0-10 整数 / 一位小数, 拒绝 negative / >10
- comment 简短, 引用具体差异 ("第 2 段缺中心句", "字数差 80"), 不空话
- weaknesses / suggestions 不说"加油" / "再多练" / "继续努力"

## 示范答案硬约束 (sample_answer):

- 必须基于"给定材料"内容, 不能编造数据 / 案例 / 政策出处
- 长度严格在题干字数要求 ±10% (e.g. 题干 1000-1200 字 → 示范 900-1320 字)
- 调性: 公文体, 不"加油" / 不"我们要时刻..." 空话
- 用户 UI 会标 "AI 生成示范, 仅供对照, 非官方参考答案"
"""


ESSAY_GRADING_SYSTEM_MESSAGE = with_tone(_ESSAY_GRADING_SYSTEM_BODY)


def build_essay_grading_messages(
    *,
    question_stem: str,
    materials: list[str],
    word_limit_min: int | None,
    word_limit_max: int | None,
    full_score: int | None,
    user_answer: str,
) -> list[LLMMessage]:
    """组 system + user messages 给 LLM. 单 call 双输出.

    DeepSeek prompt cache 5min 窗口策略 (plan §3.3 / R13): system 大头固定 (调性
    + schema), user 大头题干 + 材料 (跟该题所有用户共享, 同题同请求 → 高 cache
    hit). 用户答案放 user message 末段, 是唯一变 byte.
    """
    user_parts: list[str] = []
    user_parts.append("## 题干:\n" + question_stem)

    if materials:
        materials_block = "\n\n".join(
            f"### 材料 {i}\n{text}" for i, text in enumerate(materials, start=1)
        )
        user_parts.append("## 给定材料:\n" + materials_block)

    constraints: list[str] = []
    if word_limit_min is not None:
        constraints.append(f"字数下限 {word_limit_min}")
    if word_limit_max is not None:
        constraints.append(f"字数上限 {word_limit_max}")
    if full_score is not None:
        constraints.append(f"满分 {full_score}")
    if constraints:
        user_parts.append("## 题目要求: " + " / ".join(constraints))

    user_parts.append("## 用户作答:\n" + user_answer)
    user_parts.append(
        "请按 system message 中描述的 JSON schema 输出 evaluation + sample_answer."
    )

    return [
        LLMMessage(role="system", content=ESSAY_GRADING_SYSTEM_MESSAGE),
        LLMMessage(role="user", content="\n\n".join(user_parts)),
    ]


__all__ = [
    "ESSAY_DIMENSION_NAMES",
    "ESSAY_DIMENSION_WEIGHTS",
    "ESSAY_DIMENSIONS",
    "ESSAY_GRADING_SYSTEM_MESSAGE",
    "build_essay_grading_messages",
]


# Sanity check at import: weights sum to 1.0 (避免编辑时 drift, R10 重算总分依赖).
_total_weight = sum(w for _name, w, _r in ESSAY_DIMENSIONS)
assert abs(_total_weight - 1.0) < 1e-9, (
    f"ESSAY_DIMENSIONS weights must sum to 1.0, got {_total_weight}"
)
del _total_weight
