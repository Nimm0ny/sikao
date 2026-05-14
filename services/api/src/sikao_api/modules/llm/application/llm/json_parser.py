"""LLM JSON 容错 parser (R6) — Slice 2c.

LLM 输出 JSON 经常不规范: markdown fenced (```json ... ```), 中文逗号, 字段名错
位, 前后多余文本. plan §6 R6 三段容错:

  (a) 直接 json.loads(text) — happy path
  (b) regex 提取首个 `{...}` 子串再 parse — 砍掉前后说明文字 / markdown fence
  (c) caller 决定是否带"上次输出 invalid: <错>" 重试 LLM (本模块只负责 parse,
      不直接调 LLM, 让上游 service 控制重试节奏 + token 预算)
  (d) 仍失败 → raise LlmJsonParseError, caller 标 status='failed' + failure_reason

本模块**不**做 prompt 重试, 只暴露 parse_with_recovery 给上游用. 重试由
essay_grading.py service 层负责.

XSS / 代码注入: parse 返回的 dict 可能含 LLM 编造的 HTML / JS / unicode 控制符.
caller 责任 sanitize (DOMPurify 在 FE; backend 不直接 render). 本模块不裁剪
内容.
"""

from __future__ import annotations

import json
import re
from typing import Any


class LlmJsonParseError(ValueError):
    """LLM JSON parse 失败兜底 — caller 应标 status='failed' + 写 failure_reason."""


# 跨多行匹配第一个 `{...}` 子串. greedy 让匹配到最外层 {}
# (LLM 经常输出 `... here is the json: {...} hope this helps.` 这种).
#
# 已知限制 (PoC 接受):
# 1. 多 JSON blob 输入 (e.g. `{"a":1} junk {"b":2}`) greedy 会跨吃成
#    `{"a":1} junk {"b":2}` 整段 → json.loads 失败 → raise. prompt schema 强约束
#    单 evaluation+sample_answer dict, LLM 不该返多 blob.
# 2. 字符串内含 `}` (e.g. `{"k": "} hi"} extra`) greedy 仍抓最外层 `}`. 实操少见,
#    LLM 输出主要是 ASCII / 中文文本, `}` 在内容里出现概率低.
# 真触发 → caller 标 failed 重试 / 用户重提交, 不影响数据正确性.
_RE_JSON_BLOCK = re.compile(r"\{.*\}", re.DOTALL)


def parse_with_recovery(raw: str) -> dict[str, Any]:
    """三段尝试 parse LLM 输出为 JSON dict. 失败 raise LlmJsonParseError.

    返 top-level 是 list / scalar / null 时也 raise — caller 期待 dict 形 (5
    维度 evaluation + sample_answer 等).
    """
    if not raw or not raw.strip():
        raise LlmJsonParseError("LLM output is empty")

    # (a) 直接 json.loads
    try:
        result = json.loads(raw)
        if isinstance(result, dict):
            return result
        raise LlmJsonParseError(
            f"LLM JSON top-level is not an object (got {type(result).__name__})"
        )
    except json.JSONDecodeError:
        pass  # fall through (b)

    # (b) regex 提取 `{...}` 子串. 防 markdown fence / 前后说明文字 / "Here is..."
    block_match = _RE_JSON_BLOCK.search(raw)
    if block_match is None:
        raise LlmJsonParseError(
            "LLM output contains no JSON object braces"
        )
    block = block_match.group(0)
    try:
        result = json.loads(block)
    except json.JSONDecodeError as exc:
        raise LlmJsonParseError(
            f"LLM JSON object failed to parse after regex extract: {exc.msg}"
        ) from exc
    if not isinstance(result, dict):
        raise LlmJsonParseError(
            f"LLM JSON top-level is not an object (got {type(result).__name__})"
        )
    return result


__all__ = ["LlmJsonParseError", "parse_with_recovery"]
