"""OpenAI ChatCompletions-compatible LLM provider — Slice 0a.

DeepSeek V4 / OpenAI / 通义 / 智谱 / vLLM 都遵循同一接口, 单 impl 处理所有
(差异在 base_url / api_key / model 参数, 详 plan §3.1).

API ref:
- OpenAI: https://platform.openai.com/docs/api-reference/chat/create
- DeepSeek: https://api-docs.deepseek.com/

Failure semantics:
- HTTP 非 2xx → raise httpx.HTTPStatusError (调用方决定 swallow/retry-fallback)
- timeout → raise httpx.TimeoutException
- stream parse 错 → log warn + 跳过单 chunk (不阻塞整流)

SSE 帧格式假设 (Narrow scope, plan §3.1 PoC verify DS V4):
本 impl 假设单帧 = 单 `data: {json}` 行 + 双换行分隔. SSE spec 允许同一 event
含多 `data:` 行 (拼接 newline), 现实 OpenAI / DeepSeek 不发. BYOM 用户接老
OpenAI proxy / 早期 vLLM build 若发 multi-data 帧, 本 parser 只读最后一行
(前面的 silent 丢). Slice 0c 接 BYOM 时如发现真有 multi-data 帧客户再加完整
spec parser. 当前接 DS V4 已验证不出现.
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass
from urllib.parse import urlsplit

import httpx

from sikao_api.modules.llm.application.llm.provider import (
    FINISH_REASON_KNOWN,
    ChatCompletionChunk,
    ChatCompletionResult,
    LLMMessage,
    ResponseFormat,
)

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_SECONDS = 120.0
_JSON_RESPONSE_FORMAT_HOSTS = frozenset(
    {
        "api.openai.com",
        "api.deepseek.com",
        "dashscope.aliyuncs.com",
    }
)


@dataclass(frozen=True)
class OpenAICompatibleConfig:
    """Provider 实例化 config. factory 端读 settings (system default) 或
    user_llm_configs (BYOM, Slice 0c)."""

    base_url: str
    api_key: str
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS


def _normalize_finish_reason(raw: str | None) -> str:
    """Normalize OpenAI/DeepSeek finish_reason to known whitelist.

    Unknown values → warn log + default 'stop' (避免 LLM 返奇怪字符串穿透
    业务 logic). None 也 default 'stop' (sync result 必有, 误中调 None 走默认).
    """
    if raw is None:
        return "stop"
    if raw in FINISH_REASON_KNOWN:
        return raw
    logger.warning("llm.unknown_finish_reason raw=%s, defaulting to 'stop'", raw)
    return "stop"


def _build_messages_payload(messages: list[LLMMessage]) -> list[dict[str, str]]:
    return [{"role": m.role, "content": m.content} for m in messages]


def _build_completion_payload(
    *,
    base_url: str,
    messages: list[LLMMessage],
    model: str,
    max_tokens: int | None,
    temperature: float,
    stream: bool,
    response_format: ResponseFormat | None,
) -> dict[str, object]:
    """OpenAI chat/completions request payload. stream=True 时加 stream_options
    让最后 chunk 带 usage (OpenAI 2024-04 加的, DeepSeek V4 行为未承诺稳定 → R9 fallback)."""
    payload: dict[str, object] = {
        "model": model,
        "messages": _build_messages_payload(messages),
        "temperature": temperature,
    }
    if max_tokens is not None:
        payload["max_tokens"] = max_tokens
    if response_format == "json_object" and _supports_json_response_format(
        base_url=base_url
    ):
        payload["response_format"] = {"type": "json_object"}
    if stream:
        payload["stream"] = True
        payload["stream_options"] = {"include_usage": True}
    return payload


def _supports_json_response_format(*, base_url: str) -> bool:
    host = urlsplit(base_url).hostname or ""
    return host in _JSON_RESPONSE_FORMAT_HOSTS


class OpenAICompatibleProvider:
    """OpenAI ChatCompletions impl. Implements LLMProvider Protocol structurally.

    httpx.AsyncClient 注入让 test 用 MockTransport. 默认懒构造 short-lived
    client per call (creation 开销低, async 兼容简单).
    """

    def __init__(
        self,
        config: OpenAICompatibleConfig,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._config = config
        self._client = client

    @property
    def _completions_url(self) -> str:
        return f"{self._config.base_url.rstrip('/')}/chat/completions"

    @property
    def _auth_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._config.api_key}",
            "Content-Type": "application/json",
        }

    async def chat_completion(
        self,
        *,
        messages: list[LLMMessage],
        model: str,
        max_tokens: int | None = None,
        temperature: float = 0.7,
        response_format: ResponseFormat | None = None,
    ) -> ChatCompletionResult:
        payload = _build_completion_payload(
            base_url=self._config.base_url,
            messages=messages,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            stream=False,
            response_format=response_format,
        )
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=self._config.timeout_seconds)
        try:
            resp = await client.post(self._completions_url, json=payload, headers=self._auth_headers)
            resp.raise_for_status()
            data = resp.json()
        finally:
            if owns_client:
                await client.aclose()

        choice = data["choices"][0]
        usage = data.get("usage", {})
        return ChatCompletionResult(
            content=choice["message"]["content"],
            prompt_tokens=usage.get("prompt_tokens", 0),
            prompt_cache_hit_tokens=usage.get("prompt_cache_hit_tokens", 0),
            prompt_cache_miss_tokens=usage.get("prompt_cache_miss_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            model=data.get("model", model),
            finish_reason=_normalize_finish_reason(choice.get("finish_reason")),
        )

    async def chat_completion_stream(
        self,
        *,
        messages: list[LLMMessage],
        model: str,
        max_tokens: int | None = None,
        temperature: float = 0.7,
        response_format: ResponseFormat | None = None,
    ) -> AsyncIterator[ChatCompletionChunk]:
        payload = _build_completion_payload(
            base_url=self._config.base_url,
            messages=messages,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            stream=True,
            response_format=response_format,
        )
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=self._config.timeout_seconds)
        try:
            async with client.stream(
                "POST", self._completions_url, json=payload, headers=self._auth_headers
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    chunk = _parse_sse_line(line)
                    if chunk is not None:
                        yield chunk
        finally:
            if owns_client:
                await client.aclose()


def _parse_sse_line(line: str) -> ChatCompletionChunk | None:
    """Parse 单 SSE 帧行. 返 None 表示该行不是 data event (空行 / [DONE] /
    parse 失败), 调用方跳过."""
    line = line.strip()
    if not line or not line.startswith("data: "):
        return None
    raw = line[len("data: "):]
    if raw == "[DONE]":
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("llm.stream.parse_failed line=%r", line)
        return None

    choices = data.get("choices") or []
    delta_content = ""
    finish_reason: str | None = None
    if choices:
        delta = choices[0].get("delta") or {}
        delta_content = delta.get("content", "") or ""
        finish_reason = choices[0].get("finish_reason")

    usage = data.get("usage")
    # is_final 双 chunk 兼容:
    # - DeepSeek V4: 单 chunk choices=[{finish_reason='stop',...}] usage={...}
    #   → finish_reason 存在 → True
    # - OpenAI stream_options.include_usage=True: 分两 chunk
    #   · penultimate: choices=[{finish_reason='stop',...}] usage=null
    #     → finish_reason 存在 → True
    #   · final usage-only: choices=[] usage={...} (no finish_reason)
    #     → choices 空 + usage 真值 → True
    # - BYOM 非标 endpoint 误把 usage 注入中间 chunk (choices 非空 + usage 非空
    #   + finish_reason=None): 仍 False, 防业务层提前 conclude.
    is_final = finish_reason is not None or (not choices and usage is not None)

    return ChatCompletionChunk(
        content_delta=delta_content,
        is_final=is_final,
        prompt_tokens=usage.get("prompt_tokens") if usage else None,
        prompt_cache_hit_tokens=usage.get("prompt_cache_hit_tokens") if usage else None,
        prompt_cache_miss_tokens=usage.get("prompt_cache_miss_tokens") if usage else None,
        completion_tokens=usage.get("completion_tokens") if usage else None,
        finish_reason=_normalize_finish_reason(finish_reason) if finish_reason else None,
    )
