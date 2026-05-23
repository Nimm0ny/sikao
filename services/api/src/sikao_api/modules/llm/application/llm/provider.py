"""LLM Provider Protocol + DTOs — Slice 0a (LLM infra).

OpenAI ChatCompletions-compatible 抽象. DeepSeek V4 / OpenAI / 通义 / 智谱 /
vLLM 都遵循同一接口, 单一 OpenAICompatibleProvider impl 处理所有 (差异在
base_url / api_key / model 三参数, 详 plan §3.1).

PoC 阶段实施范围: 系统默认 + e2e 测试只 verify DeepSeek V4. 用户 BYOM (Slice
0c) 给的其他 endpoint 协议层兼容但不主动测试调试.

Sync vs stream 拆两 method (而非 stream=True flag 切返回类型 Union): 返回
类型本质不同 (Result vs AsyncIterator), 调用方按需选, 类型友好.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Literal, Protocol


@dataclass(frozen=True)
class LLMMessage:
    """ChatCompletions message (OpenAI 标准).

    role 限 'system' | 'user' | 'assistant'. 不约束 Literal 因为未来可能加
    'tool' / 'function' 角色 (out of scope for PoC, plan §2.2).
    """

    role: str
    content: str


@dataclass(frozen=True)
class ChatCompletionResult:
    """Sync chat_completion 返回. usage 字段从 OpenAI/DeepSeek 响应解出.

    DeepSeek 扩展字段 prompt_cache_hit_tokens / prompt_cache_miss_tokens
    OpenAI 不返 → 解析时缺省 0. cost 计算时按 hit-miss 二档分价 (plan §4.5).
    """

    content: str
    prompt_tokens: int
    prompt_cache_hit_tokens: int
    prompt_cache_miss_tokens: int
    completion_tokens: int
    model: str
    finish_reason: str  # provider 内 normalize 到 known 值, 详 FINISH_REASON_KNOWN


@dataclass(frozen=True)
class ChatCompletionChunk:
    """Streaming chunk. 最后 chunk is_final=True 时附带 usage 字段.

    OpenAI stream_options={'include_usage': true} → 最后 chunk 单独带 usage,
    payload 形如 `{usage: {...}, choices: []}`. 中间 chunk usage 为 None,
    finish_reason 也为 None.

    DeepSeek V4 stream final usage 字段未承诺稳定, 缺失时 prompt_tokens /
    completion_tokens 为 None — 业务层 fallback tiktoken 估算 (R9, plan §6).
    """

    content_delta: str  # incremental text since last chunk
    is_final: bool
    # 仅 final chunk 有, 中间 chunk 全 None:
    prompt_tokens: int | None
    prompt_cache_hit_tokens: int | None
    prompt_cache_miss_tokens: int | None
    completion_tokens: int | None
    finish_reason: str | None


# finish_reason normalize 白名单. 未识别值 → warn log + default 'stop'
# (避免奇怪 LLM 输出穿透业务 logic). 来源 OpenAI ChatCompletions API doc.
FINISH_REASON_KNOWN = frozenset({
    "stop",
    "length",
    "content_filter",
    "tool_calls",
    "function_call",
})


ResponseFormat = Literal["json_object"]


class LLMProvider(Protocol):
    """OpenAI ChatCompletions-compatible. DeepSeek/OpenAI/通义/etc 通用."""

    async def chat_completion(
        self,
        *,
        messages: list[LLMMessage],
        model: str,
        max_tokens: int | None = None,
        temperature: float = 0.7,
        response_format: ResponseFormat | None = None,
    ) -> ChatCompletionResult:
        """Sync-style call (内部 await httpx). 失败 raise (httpx.HTTPStatusError /
        httpx.TimeoutException). 调用方决定 retry-with-fallback 还是 surface."""
        ...

    def chat_completion_stream(
        self,
        *,
        messages: list[LLMMessage],
        model: str,
        max_tokens: int | None = None,
        temperature: float = 0.7,
        response_format: ResponseFormat | None = None,
    ) -> AsyncIterator[ChatCompletionChunk]:
        """Async streaming. 调用方负责 cancel (route 层 request.is_disconnected).

        返 AsyncIterator 不是 Iterator — async for 配 async with httpx 配合
        客户端断连立即 cancel upstream call (plan §3.3.2).
        """
        ...
