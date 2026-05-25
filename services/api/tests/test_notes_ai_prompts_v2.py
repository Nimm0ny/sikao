from __future__ import annotations

from sikao_api.modules.llm.application.llm.prompts.cause_analysis_weekly import (
    PROMPT_VERSION as WEEKLY_PROMPT_VERSION,
    build_cause_analysis_weekly_messages,
)
from sikao_api.modules.llm.application.llm.prompts.note_summary_cards import (
    OUTPUT_SCHEMA as NOTE_SUMMARY_OUTPUT_SCHEMA,
    PROMPT_VERSION as NOTE_SUMMARY_PROMPT_VERSION,
    build_note_summary_cards_messages,
)


def test_build_note_summary_cards_messages_embed_required_context() -> None:
    messages = build_note_summary_cards_messages(
        body_text="排列组合中，捆绑法适用于相邻约束。",
        question_stem="若四人相邻而坐，求不同排法。",
    )
    assert NOTE_SUMMARY_PROMPT_VERSION == "note_summary_cards@v1"
    assert NOTE_SUMMARY_OUTPUT_SCHEMA["properties"]["cards"]["maxItems"] == 3
    assert len(messages) == 2
    assert "只能输出 JSON 对象" in messages[0].content
    assert "关联题面" in messages[1].content
    assert "排列组合中" in messages[1].content


def test_build_cause_analysis_weekly_messages_embed_required_metrics() -> None:
    messages = build_cause_analysis_weekly_messages(
        week_number=12,
        date_range="2026-05-18 ~ 2026-05-24",
        review_count=18,
        redo_accuracy_pct=77.8,
        accuracy_delta_pct=5.5,
        graduated_count=4,
        practice_count=26,
        module_accuracy_summary="判断推理 82%，资料分析 71%",
        weakness_detail="资料分析耗时偏高，申论概括归纳不稳",
        note_count=5,
        question_note_count=3,
        note_titles="资料分析公式, 判断推理陷阱",
    )
    assert WEEKLY_PROMPT_VERSION == "cause_analysis_weekly@v1"
    assert len(messages) == 2
    assert "严格四个二级标题的 Markdown" in messages[0].content
    assert "第 12 周" in messages[1].content
    assert "正确率 77.8%" in messages[1].content
    assert "变化 +5.5%" in messages[1].content
