"""LLM token usage estimation fallback — Slice 0a (R9).

DeepSeek V4 stream final chunk 是否带 usage 字段未承诺稳定. 缺失时本地估算
+ estimated=True 标记记账, 避免完全计 0 偏差大.

模式 (settings.llm_usage_estimate_fallback):
- tiktoken: OpenAI BPE encoder (cl100k_base, GPT-4 encoder). 跟 DeepSeek
  tokenizer 偏差 <5% (PoC 够用). 中文 ~1.5 char/token, 英文 ~3-4 char/token.
- none: 直接计 0 + warn log (用量记账偏低但不阻塞).

业务层用法:
    if final_chunk.prompt_tokens is None:
        prompt_tokens = estimate_tokens(prompt_text, settings.llm_usage_estimate_fallback)
        completion_tokens = estimate_tokens(completion_text, settings.llm_usage_estimate_fallback)
        # record llm_token_usage with estimated=True
"""

from __future__ import annotations

import logging
from importlib import import_module
from typing import Literal

logger = logging.getLogger(__name__)


# DeepSeek 跟 OpenAI BPE 同源, 用 cl100k_base (GPT-4 encoder) 估算 token 数.
# 真实 DS tokenizer 字典略不同, 偏差 <5%, PoC 阶段可接受.
_DEFAULT_ENCODING = "cl100k_base"


def estimate_tokens(text: str, mode: Literal["tiktoken", "none"]) -> int:
    """Estimate token count for given text.

    返回值用作 llm_token_usage.prompt_tokens / completion_tokens fallback 当
    stream final chunk 未带真实 usage. 业务层把 record.estimated 设 True.

    mode='none' / tiktoken 包不可用 → 返 0 + warn log (避免阻塞主流程).
    mode 字符串非法 → raise ValueError (调用方 logic bug).
    空字符串 → 返 0 (合理: 0 token).
    """
    if mode == "none":
        logger.warning("llm.usage_estimate fallback=none, recording 0 tokens")
        return 0
    if mode == "tiktoken":
        if not text:
            return 0
        try:
            tiktoken = import_module("tiktoken")
        except ImportError:
            logger.warning("llm.usage_estimate tiktoken not installed, recording 0 tokens")
            return 0
        try:
            encoder = tiktoken.get_encoding(_DEFAULT_ENCODING)
        except (OSError, ValueError) as exc:
            # tiktoken 第一次跑会 HTTP fetch encoder 文件到 ~/.cache/tiktoken.
            # 真实失败 path (verified by reading tiktoken source):
            # - 网络: requests.exceptions.RequestException 继承 OSError
            #   (ConnectionError / Timeout / HTTPError 都进 OSError 分支)
            # - 文件系统: OSError (cache dir 写不进 / 权限)
            # - hash mismatch / parse fail: ValueError
            # 不 catch Exception 避免吞 KeyError / AttributeError 等 logic bug
            # (CLAUDE.md §4 Fail-Fast).
            logger.warning(
                "llm.usage_estimate tiktoken encoder load failed (%s: %s), recording 0 tokens",
                type(exc).__name__,
                exc,
            )
            return 0
        return len(encoder.encode(text))
    raise ValueError(f"unknown estimate mode: {mode!r}")
