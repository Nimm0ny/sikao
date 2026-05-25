from __future__ import annotations

from sikao_api.modules.llm.application.llm.prompts._shared import with_tone
from sikao_api.modules.llm.application.llm.provider import LLMMessage


PROMPT_VERSION = "cause_analysis_weekly@v1"


def build_cause_analysis_weekly_messages(
    *,
    week_number: int,
    date_range: str,
    review_count: int,
    redo_accuracy_pct: float,
    accuracy_delta_pct: float | None,
    graduated_count: int,
    practice_count: int,
    module_accuracy_summary: str,
    weakness_detail: str,
    note_count: int,
    question_note_count: int,
    note_titles: str,
) -> list[LLMMessage]:
    delta_text = (
        f"{accuracy_delta_pct:+.1f}%"
        if accuracy_delta_pct is not None
        else "N/A"
    )
    system_content = with_tone(
        "你是 Sikao 的每周学习复盘助手。"
        "请输出严格四个二级标题的 Markdown："
        "## 本周成果、## 薄弱环节、## 下周建议、## 本周知识沉淀。"
        "每个区块用项目符号列出 1 到 4 条内容。"
        "只输出 Markdown，不要输出 JSON 或额外说明。"
    )
    user_content = (
        f"第 {week_number} 周（{date_range}）\n"
        f"复盘：复盘 {review_count} 题，正确率 {redo_accuracy_pct:.1f}%（变化 {delta_text}），毕业 {graduated_count} 题\n"
        f"练习：答题 {practice_count} 次，模块正确率：{module_accuracy_summary}\n"
        f"薄弱模块：{weakness_detail}\n"
        f"笔记：新增 {note_count} 条（题级 {question_note_count} 条），标题：{note_titles}\n\n"
        "请生成本周回顾。"
    )
    return [
        LLMMessage(role="system", content=system_content),
        LLMMessage(role="user", content=user_content),
    ]


__all__ = [
    "PROMPT_VERSION",
    "build_cause_analysis_weekly_messages",
]
