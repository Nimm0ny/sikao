"""LLM provider unit tests — Slice 0a.

Cover OpenAICompatibleProvider 跟 OpenAI ChatCompletions 协议:
- chat_completion (sync) happy / 4xx / 5xx / cache tokens / finish_reason normalize
- chat_completion_stream (SSE) deltas / final chunk usage / [DONE] / parse error 跳过

httpx.MockTransport 注入让测试不打真网络. asyncio.run 包 async test (避免加
pytest-asyncio dep).
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import Awaitable, Callable
from typing import TypeVar

import httpx
import pytest

from sikao_api.modules.llm.application.llm.openai_compatible import (
    OpenAICompatibleConfig,
    OpenAICompatibleProvider,
)
from sikao_api.modules.llm.application.llm.provider import (
    ChatCompletionChunk,
    ChatCompletionResult,
    LLMMessage,
)


T = TypeVar("T")


def _run(coro: Awaitable[T]) -> T:
    """asyncio.run 包同步 test runner. 避免加 pytest-asyncio dep."""
    return asyncio.run(coro)  # type: ignore[arg-type]


def _make_provider(
    handler: Callable[[httpx.Request], httpx.Response],
    *,
    base_url: str = "https://mock.test/v1",
) -> OpenAICompatibleProvider:
    """Build provider with MockTransport-backed AsyncClient."""
    transport = httpx.MockTransport(handler)
    client = httpx.AsyncClient(transport=transport)
    config = OpenAICompatibleConfig(
        base_url=base_url,
        api_key="sk-test",
        timeout_seconds=5.0,
    )
    return OpenAICompatibleProvider(config, client=client)


# ─── sync chat_completion ──────────────────────────────────────────────────


def test_chat_completion_happy_path() -> None:
    """200 响应 + 完整 usage → ChatCompletionResult 字段对齐."""
    response_body = {
        "id": "test-1",
        "model": "deepseek-v4-flash",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": "Hello"},
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": 12,
            "completion_tokens": 5,
            "total_tokens": 17,
        },
    }
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["auth"] = request.headers.get("authorization")
        captured["payload"] = json.loads(request.content)
        return httpx.Response(200, json=response_body)

    provider = _make_provider(handler)
    result = _run(
        provider.chat_completion(
            messages=[LLMMessage(role="user", content="hi")],
            model="deepseek-v4-flash",
        )
    )

    assert isinstance(result, ChatCompletionResult)
    assert result.content == "Hello"
    assert result.prompt_tokens == 12
    assert result.completion_tokens == 5
    assert result.prompt_cache_hit_tokens == 0  # OpenAI 不返这字段, default 0
    assert result.prompt_cache_miss_tokens == 0
    assert result.model == "deepseek-v4-flash"
    assert result.finish_reason == "stop"
    # request shape 校验: URL, auth, body
    assert captured["url"] == "https://mock.test/v1/chat/completions"
    assert captured["auth"] == "Bearer sk-test"
    payload = captured["payload"]
    assert isinstance(payload, dict)
    assert payload["model"] == "deepseek-v4-flash"
    assert payload["messages"] == [{"role": "user", "content": "hi"}]
    assert "stream" not in payload  # sync call 不带 stream
    assert "response_format" not in payload


def test_chat_completion_includes_json_response_format_when_requested() -> None:
    captured_payload: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured_payload.update(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "model": "deepseek-v4-flash",
                "choices": [
                    {"message": {"content": "{}"}, "finish_reason": "stop"}
                ],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1},
            },
        )

    provider = _make_provider(
        handler,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )
    _run(
        provider.chat_completion(
            messages=[LLMMessage(role="user", content="return json")],
            model="deepseek-v4-flash",
            response_format="json_object",
        )
    )

    assert captured_payload["response_format"] == {"type": "json_object"}


def test_chat_completion_omits_json_response_format_for_unknown_endpoint() -> None:
    captured_payload: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured_payload.update(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "model": "deepseek-v4-flash",
                "choices": [
                    {"message": {"content": "{}"}, "finish_reason": "stop"}
                ],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1},
            },
        )

    provider = _make_provider(handler)
    _run(
        provider.chat_completion(
            messages=[LLMMessage(role="user", content="return json")],
            model="deepseek-v4-flash",
            response_format="json_object",
        )
    )

    assert "response_format" not in captured_payload


def test_chat_completion_carries_deepseek_cache_tokens() -> None:
    """DeepSeek 扩展字段 prompt_cache_hit_tokens / prompt_cache_miss_tokens 正确解析."""
    response_body = {
        "model": "deepseek-v4-flash",
        "choices": [
            {"message": {"role": "assistant", "content": "ok"}, "finish_reason": "stop"}
        ],
        "usage": {
            "prompt_tokens": 100,
            "prompt_cache_hit_tokens": 80,
            "prompt_cache_miss_tokens": 20,
            "completion_tokens": 10,
        },
    }

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=response_body)

    provider = _make_provider(handler)
    result = _run(
        provider.chat_completion(
            messages=[LLMMessage(role="user", content="x")],
            model="deepseek-v4-flash",
        )
    )

    assert result.prompt_tokens == 100
    assert result.prompt_cache_hit_tokens == 80
    assert result.prompt_cache_miss_tokens == 20


def test_chat_completion_4xx_raises_http_status_error() -> None:
    """401 unauthenticated → httpx.HTTPStatusError 调用方决定 swallow/retry."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "invalid api key"})

    provider = _make_provider(handler)
    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        _run(
            provider.chat_completion(
                messages=[LLMMessage(role="user", content="hi")], model="deepseek-v4-flash"
            )
        )
    assert exc_info.value.response.status_code == 401


def test_chat_completion_5xx_raises_http_status_error() -> None:
    """500 server error → 同 4xx 抛."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, json={"error": "service unavailable"})

    provider = _make_provider(handler)
    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        _run(
            provider.chat_completion(
                messages=[LLMMessage(role="user", content="hi")], model="deepseek-v4-flash"
            )
        )
    assert exc_info.value.response.status_code == 503


def test_chat_completion_unknown_finish_reason_normalized_to_stop(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """LLM 返奇怪 finish_reason → normalize 'stop' + warn log."""
    import logging

    response_body = {
        "model": "deepseek-v4-flash",
        "choices": [
            {
                "message": {"role": "assistant", "content": "ok"},
                "finish_reason": "wat_is_this",
            }
        ],
        "usage": {"prompt_tokens": 1, "completion_tokens": 1},
    }

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=response_body)

    provider = _make_provider(handler)
    with caplog.at_level(logging.WARNING, logger="sikao_api.modules.llm.application.llm.openai_compatible"):
        result = _run(
            provider.chat_completion(
                messages=[LLMMessage(role="user", content="hi")], model="deepseek-v4-flash"
            )
        )

    assert result.finish_reason == "stop"
    assert any("unknown_finish_reason" in r.getMessage() for r in caplog.records)


def test_chat_completion_known_finish_reasons_passthrough() -> None:
    """known 白名单 (stop/length/content_filter/tool_calls/function_call) 原样返."""

    for reason in ("stop", "length", "content_filter", "tool_calls", "function_call"):
        response_body = {
            "model": "deepseek-v4-flash",
            "choices": [
                {"message": {"role": "assistant", "content": "ok"}, "finish_reason": reason}
            ],
            "usage": {"prompt_tokens": 1, "completion_tokens": 1},
        }

        def handler(request: httpx.Request, body: dict[str, object] = response_body) -> httpx.Response:
            return httpx.Response(200, json=body)

        provider = _make_provider(handler)
        result = _run(
            provider.chat_completion(
                messages=[LLMMessage(role="user", content="hi")], model="deepseek-v4-flash"
            )
        )
        assert result.finish_reason == reason, f"reason={reason!r} should passthrough"


def test_chat_completion_max_tokens_in_payload_when_set() -> None:
    """max_tokens 显式传 → 进 payload."""
    captured_payload: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured_payload.update(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "model": "deepseek-v4-flash",
                "choices": [
                    {"message": {"content": "x"}, "finish_reason": "length"}
                ],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1},
            },
        )

    provider = _make_provider(handler)
    _run(
        provider.chat_completion(
            messages=[LLMMessage(role="user", content="hi")],
            model="deepseek-v4-flash",
            max_tokens=200,
        )
    )
    assert captured_payload["max_tokens"] == 200


def test_chat_completion_max_tokens_omitted_when_none() -> None:
    """max_tokens=None (default) → 不进 payload (让 API 用 server-side default)."""
    captured_payload: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured_payload.update(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "model": "x",
                "choices": [{"message": {"content": "ok"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1},
            },
        )

    provider = _make_provider(handler)
    _run(
        provider.chat_completion(
            messages=[LLMMessage(role="user", content="hi")], model="x"
        )
    )
    assert "max_tokens" not in captured_payload


# ─── stream chat_completion_stream ─────────────────────────────────────────


def _build_sse_response(events: list[dict[str, object]]) -> bytes:
    """Build SSE event-stream bytes from list of JSON events. Trailing [DONE]."""
    lines: list[str] = []
    for event in events:
        lines.append(f"data: {json.dumps(event)}")
        lines.append("")  # 空行分隔 SSE 事件
    lines.append("data: [DONE]")
    lines.append("")
    return ("\n".join(lines) + "\n").encode("utf-8")


def test_chat_completion_stream_collects_deltas_and_final_usage() -> None:
    """SSE 多 chunks: 中间 chunk 有 content_delta + 最后 chunk 带 usage + finish."""
    events: list[dict[str, object]] = [
        {"choices": [{"index": 0, "delta": {"content": "Hello"}, "finish_reason": None}]},
        {"choices": [{"index": 0, "delta": {"content": " world"}, "finish_reason": None}]},
        {
            "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
            "usage": {
                "prompt_tokens": 10,
                "prompt_cache_hit_tokens": 6,
                "prompt_cache_miss_tokens": 4,
                "completion_tokens": 2,
            },
        },
    ]

    def handler(request: httpx.Request) -> httpx.Response:
        # 验证 stream payload 含 stream_options.include_usage
        body = json.loads(request.content)
        assert body["stream"] is True
        assert body["stream_options"] == {"include_usage": True}
        return httpx.Response(
            200,
            content=_build_sse_response(events),
            headers={"content-type": "text/event-stream"},
        )

    provider = _make_provider(handler)

    async def _collect() -> list[ChatCompletionChunk]:
        chunks: list[ChatCompletionChunk] = []
        async for chunk in provider.chat_completion_stream(
            messages=[LLMMessage(role="user", content="hi")], model="deepseek-v4-flash"
        ):
            chunks.append(chunk)
        return chunks

    chunks = _run(_collect())

    assert len(chunks) == 3
    assert chunks[0].content_delta == "Hello"
    assert chunks[0].is_final is False
    assert chunks[0].prompt_tokens is None
    assert chunks[1].content_delta == " world"
    assert chunks[1].is_final is False
    # final chunk: empty content_delta + usage + finish_reason
    assert chunks[2].content_delta == ""
    assert chunks[2].is_final is True
    assert chunks[2].finish_reason == "stop"
    assert chunks[2].prompt_tokens == 10
    assert chunks[2].prompt_cache_hit_tokens == 6
    assert chunks[2].prompt_cache_miss_tokens == 4
    assert chunks[2].completion_tokens == 2


def test_chat_completion_stream_skips_done_marker() -> None:
    """[DONE] sentinel 帧不 yield (生成器 return)."""
    events: list[dict[str, object]] = [
        {
            "choices": [{"delta": {"content": "x"}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 1, "completion_tokens": 1},
        },
    ]

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=_build_sse_response(events))

    provider = _make_provider(handler)

    async def _collect() -> list[ChatCompletionChunk]:
        return [c async for c in provider.chat_completion_stream(
            messages=[LLMMessage(role="user", content="hi")], model="x"
        )]

    chunks = _run(_collect())
    # 只该有 1 chunk (events 唯一), [DONE] 后停, 不 yield 它.
    assert len(chunks) == 1


def test_chat_completion_stream_skips_invalid_json(caplog: pytest.LogCaptureFixture) -> None:
    """Bad JSON 单帧 warn log 跳过, 不阻塞后续 chunk."""
    import logging

    valid_event = json.dumps({
        "choices": [{"delta": {"content": "hi"}, "finish_reason": "stop"}],
        "usage": {"prompt_tokens": 1, "completion_tokens": 1},
    }).encode("utf-8")
    body = (
        b"data: not-json\n\n"
        b"data: " + valid_event + b"\n\n"
        b"data: [DONE]\n\n"
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=body)

    provider = _make_provider(handler)

    async def _collect() -> list[ChatCompletionChunk]:
        return [c async for c in provider.chat_completion_stream(
            messages=[LLMMessage(role="user", content="hi")], model="x"
        )]

    with caplog.at_level(logging.WARNING, logger="sikao_api.modules.llm.application.llm.openai_compatible"):
        chunks = _run(_collect())

    # bad JSON 跳过, 后续 1 个有效 chunk 仍 yield
    assert len(chunks) == 1
    assert chunks[0].content_delta == "hi"
    assert any("parse_failed" in r.getMessage() for r in caplog.records)


def test_chat_completion_stream_4xx_raises_before_first_chunk() -> None:
    """SSE 也走 raise_for_status — 401 不 yield 任何 chunk."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "unauthorized"})

    provider = _make_provider(handler)

    async def _collect() -> list[ChatCompletionChunk]:
        return [c async for c in provider.chat_completion_stream(
            messages=[LLMMessage(role="user", content="hi")], model="x"
        )]

    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        _run(_collect())
    assert exc_info.value.response.status_code == 401


def test_chat_completion_stream_intermediate_chunk_with_usage_not_marked_final() -> None:
    """防御: 中间 chunk 误带 usage (BYOM 非标 endpoint, choices 非空) →
    is_final=False.

    is_final 双 chunk 兼容逻辑:
    - finish_reason 存在 → True
    - 或 choices=[] + usage 真值 → True (OpenAI usage-only chunk)
    - 否则 False (中间 chunk 即使误带 usage)
    """
    events: list[dict[str, object]] = [
        {
            # 中间 chunk: choices 非空 + usage 误带 + finish_reason=None
            "choices": [{"delta": {"content": "Mid"}, "finish_reason": None}],
            "usage": {"prompt_tokens": 5, "completion_tokens": 1},
        },
        {
            # final: finish_reason='stop'
            "choices": [{"delta": {"content": " end"}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 5, "completion_tokens": 2},
        },
    ]

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=_build_sse_response(events))

    provider = _make_provider(handler)

    async def _collect() -> list[ChatCompletionChunk]:
        return [c async for c in provider.chat_completion_stream(
            messages=[LLMMessage(role="user", content="hi")], model="x"
        )]

    chunks = _run(_collect())
    assert len(chunks) == 2
    # 第一 chunk: choices 非空, finish_reason=None → is_final=False (防御正确)
    assert chunks[0].is_final is False
    assert chunks[0].prompt_tokens == 5  # usage 数据仍解析 (业务层独立累积)
    # 第二 chunk: finish_reason='stop' → 真 final
    assert chunks[1].is_final is True
    assert chunks[1].finish_reason == "stop"


def test_chat_completion_stream_openai_two_chunk_pattern() -> None:
    """OpenAI stream_options.include_usage=True 真实协议: 分两 final chunk.

    P1-#4-A: 旧 logic 'is_final = finish_reason is not None' 让 OpenAI usage-only
    chunk is_final=False, 业务层 stream consumer 看不出真终点. 新 logic
    OR (choices 空 + usage 真值) 修复.
    """
    events: list[dict[str, object]] = [
        # content delta chunks
        {"choices": [{"delta": {"content": "Hello"}, "finish_reason": None}]},
        # penultimate: finish_reason='stop' + usage:null (OpenAI 行为)
        {"choices": [{"delta": {}, "finish_reason": "stop"}], "usage": None},
        # final usage-only chunk: choices=[] + usage 真值, no finish_reason
        {
            "choices": [],
            "usage": {
                "prompt_tokens": 8,
                "completion_tokens": 1,
                "total_tokens": 9,
            },
        },
    ]

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=_build_sse_response(events))

    provider = _make_provider(handler)

    async def _collect() -> list[ChatCompletionChunk]:
        return [c async for c in provider.chat_completion_stream(
            messages=[LLMMessage(role="user", content="hi")], model="x"
        )]

    chunks = _run(_collect())
    assert len(chunks) == 3
    # content chunk: 中间, 非 final
    assert chunks[0].content_delta == "Hello"
    assert chunks[0].is_final is False
    # penultimate: finish_reason='stop' → is_final=True (但还没 usage)
    assert chunks[1].is_final is True
    assert chunks[1].finish_reason == "stop"
    assert chunks[1].prompt_tokens is None  # OpenAI penultimate usage:null
    # final usage-only: choices=[] + usage 真值 → is_final=True
    assert chunks[2].is_final is True
    assert chunks[2].finish_reason is None  # 没 finish_reason, choices 空
    assert chunks[2].prompt_tokens == 8
    assert chunks[2].completion_tokens == 1
    # 业务层取最后 final chunk 作真 stream 终点 (有完整 usage 记账)
    final_chunks = [c for c in chunks if c.is_final]
    assert len(final_chunks) == 2  # OpenAI 双 final chunk
    last_with_usage = next(c for c in reversed(final_chunks) if c.prompt_tokens is not None)
    assert last_with_usage.prompt_tokens == 8
