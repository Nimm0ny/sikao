"""Slice 2c · LLM JSON 容错 parser unit tests (R6).

三段容错:
  (a) 直接 json.loads → happy
  (b) regex 提取 `{...}` 子串再 parse → markdown fence / 前后说明文字 / 等容错
  (c) 仍失败 raise LlmJsonParseError
"""

from __future__ import annotations

import pytest

from sikao_api.modules.llm.application.llm.json_parser import LlmJsonParseError, parse_with_recovery

# ── (a) 直接 json.loads ─────────────────────────────────────────────────────


def test_parse_clean_json_object() -> None:
    out = parse_with_recovery('{"a": 1, "b": "x"}')
    assert out == {"a": 1, "b": "x"}


def test_parse_clean_json_with_chinese() -> None:
    out = parse_with_recovery('{"题干": "材料一说...", "score": 8}')
    assert out["题干"].startswith("材料一")
    assert out["score"] == 8


# ── (b) regex 提取 — markdown fence / 前后说明文字 ──────────────────────────


def test_parse_markdown_fenced_json() -> None:
    raw = '```json\n{"score": 9, "comment": "ok"}\n```'
    assert parse_with_recovery(raw) == {"score": 9, "comment": "ok"}


def test_parse_markdown_fenced_no_lang() -> None:
    raw = "```\n{\"a\": 1}\n```"
    assert parse_with_recovery(raw) == {"a": 1}


def test_parse_with_leading_explanation() -> None:
    raw = 'Here is the JSON evaluation:\n\n{"overallScore": 75.0, "dimensions": []}'
    out = parse_with_recovery(raw)
    assert out["overallScore"] == 75.0
    assert out["dimensions"] == []


def test_parse_with_trailing_text() -> None:
    raw = '{"a": 1}\n\nHope this helps!'
    assert parse_with_recovery(raw) == {"a": 1}


def test_parse_with_both_pre_and_post_text() -> None:
    raw = '我的评估如下:\n\n{"score": 10, "feedback": "good"}\n\n以上.'
    assert parse_with_recovery(raw) == {"score": 10, "feedback": "good"}


def test_parse_nested_object_within_fence() -> None:
    raw = """```json
{
    "outer": {
        "inner": [1, 2, 3]
    }
}
```"""
    out = parse_with_recovery(raw)
    assert out["outer"]["inner"] == [1, 2, 3]


# ── 失败路径 ────────────────────────────────────────────────────────────


def test_parse_empty_raises() -> None:
    with pytest.raises(LlmJsonParseError, match="empty"):
        parse_with_recovery("")


def test_parse_whitespace_only_raises() -> None:
    with pytest.raises(LlmJsonParseError, match="empty"):
        parse_with_recovery("   \n\t  ")


def test_parse_no_braces_raises() -> None:
    with pytest.raises(LlmJsonParseError, match="no JSON object braces"):
        parse_with_recovery("plain text no braces here")


def test_parse_top_level_array_raises() -> None:
    """top-level 必须 dict; LLM 给 array 拒 (申论评分 schema 要 object)."""
    with pytest.raises(LlmJsonParseError, match="is not an object"):
        parse_with_recovery('[1, 2, 3]')


def test_parse_top_level_scalar_raises() -> None:
    with pytest.raises(LlmJsonParseError, match="is not an object"):
        parse_with_recovery('42')


def test_parse_invalid_json_after_regex_extract_raises() -> None:
    """{...} 提取出来但内部坏 (e.g. 中文逗号 / 单引号), parse 仍失败."""
    raw = "Here: {'score': 9}"  # 单引号不是合法 JSON
    with pytest.raises(LlmJsonParseError, match="failed to parse"):
        parse_with_recovery(raw)


def test_parse_truncated_json_raises() -> None:
    """LLM 输出截断 (token limit), 缺收尾 } — regex 抓到的不闭合."""
    raw = '{"a": 1, "b": [1, 2, 3'
    with pytest.raises(LlmJsonParseError):
        parse_with_recovery(raw)
