"""LLM provider end-to-end smoke against real DeepSeek V4 — Slice 0a.

Skipped if LLM_API_KEY unset (CI without secret / dev without key file).

目标:
1. 验证 plan §3.1 — DeepSeek V4 真调通, 路径 (api.deepseek.com/v1/chat/completions
   + Bearer auth + OpenAI ChatCompletions schema) 跟 OpenAICompatibleProvider 对齐.
2. 验证 plan §6 风险 R9 — DeepSeek V4 stream final chunk usage 字段是否真稳定.
   实际 finish_reason / cache tokens / 计费 token 数 全部 log 出来给 dev 看.

测试默认 skipped, 跑法:
    cd apps/exam-api
    python -m pytest tests/test_llm_smoke.py -v -s

记录的真实数据后续记入 plan §6 R9 备注 (确认 fallback 必要性).
"""

from __future__ import annotations

import asyncio
import logging

import pytest

from sikao_api.core.config import Settings
from sikao_api.modules.llm.application.llm import LLMMessage, build_llm_provider

logger = logging.getLogger(__name__)


@pytest.fixture
def real_settings() -> Settings:
    """Settings with llm_api_key from env or .env/apikey. Skip if missing."""
    settings = Settings(_env_file=None)  # type: ignore[call-arg]
    if not settings.llm_api_key:
        pytest.skip("LLM_API_KEY not configured (set env or write .env/apikey)")
    return settings


def test_smoke_deepseek_v4_chat_completion_sync(
    real_settings: Settings, caplog: pytest.LogCaptureFixture
) -> None:
    """Real DeepSeek V4 sync call: 'hello' → non-empty response + valid usage."""
    provider, _label = build_llm_provider(real_settings)

    async def _call() -> object:
        return await provider.chat_completion(
            messages=[
                LLMMessage(role="system", content="You answer in 1-3 words."),
                LLMMessage(role="user", content="Say hello."),
            ],
            model=real_settings.llm_model_qa,
            # max_tokens=200: DeepSeek V4 是 thinking model, completion_tokens 含
            # 隐藏 reasoning. 给小了 (e.g. 20) 整 budget 烧 thinking 上 content
            # 输出空, finish_reason=length. PoC 实战 prompt 都用 default 4000 +.
            max_tokens=200,
        )

    with caplog.at_level(logging.INFO, logger=__name__):
        result = asyncio.run(_call())  # type: ignore[assignment]

    # 跟踪实际数据 (caplog + pytest -s 都能看到)
    logger.info(
        "smoke.sync content_len=%d prompt=%d cache_hit=%d cache_miss=%d "
        "completion=%d model=%s finish=%s",
        len(result.content),  # type: ignore[attr-defined]
        result.prompt_tokens,  # type: ignore[attr-defined]
        result.prompt_cache_hit_tokens,  # type: ignore[attr-defined]
        result.prompt_cache_miss_tokens,  # type: ignore[attr-defined]
        result.completion_tokens,  # type: ignore[attr-defined]
        result.model,  # type: ignore[attr-defined]
        result.finish_reason,  # type: ignore[attr-defined]
    )
    # 实际显示给 dev 看 (避免 caplog 被吞)
    print(
        f"\n[smoke sync] content={result.content!r}\n"  # type: ignore[attr-defined]
        f"[smoke sync] prompt_tokens={result.prompt_tokens} "  # type: ignore[attr-defined]
        f"cache_hit={result.prompt_cache_hit_tokens} "  # type: ignore[attr-defined]
        f"cache_miss={result.prompt_cache_miss_tokens} "  # type: ignore[attr-defined]
        f"completion={result.completion_tokens}\n"  # type: ignore[attr-defined]
        f"[smoke sync] model={result.model} finish={result.finish_reason}"  # type: ignore[attr-defined]
    )

    assert result.content  # type: ignore[attr-defined]
    assert result.prompt_tokens > 0  # type: ignore[attr-defined]
    assert result.completion_tokens > 0  # type: ignore[attr-defined]
    assert result.finish_reason in {"stop", "length"}  # type: ignore[attr-defined]
    # cache_hit + cache_miss 应该 ≤ prompt_tokens (DS 拆分逻辑)
    cache_total = result.prompt_cache_hit_tokens + result.prompt_cache_miss_tokens  # type: ignore[attr-defined]
    assert cache_total <= result.prompt_tokens  # type: ignore[attr-defined]


def test_smoke_deepseek_v4_chat_completion_stream(
    real_settings: Settings, caplog: pytest.LogCaptureFixture
) -> None:
    """Real DeepSeek V4 stream: collect chunks + 验证 final usage R9.

    Critical: 看 final chunk.prompt_tokens 是否非 None. 若 None → R9 fallback
    (tiktoken estimator) 必要; 若有 → 直接用 LLM 返的真值.
    """
    provider, _label = build_llm_provider(real_settings)

    async def _collect() -> list[object]:
        chunks: list[object] = []
        async for chunk in provider.chat_completion_stream(
            messages=[LLMMessage(role="user", content="Count 1 to 3.")],
            model=real_settings.llm_model_qa,
            max_tokens=200,  # 同 sync, thinking model 需要预算
        ):
            chunks.append(chunk)
        return chunks

    with caplog.at_level(logging.INFO, logger=__name__):
        chunks = asyncio.run(_collect())

    assert len(chunks) > 0
    full_content = "".join(c.content_delta for c in chunks)  # type: ignore[attr-defined]
    assert full_content

    final_chunks = [c for c in chunks if c.is_final]  # type: ignore[attr-defined]
    assert len(final_chunks) >= 1
    final = final_chunks[-1]

    # 关键 R9 数据点: 实际 stream final chunk 是否带 usage
    has_usage = final.prompt_tokens is not None  # type: ignore[attr-defined]
    print(
        f"\n[smoke stream] total_chunks={len(chunks)} content_len={len(full_content)}\n"
        f"[smoke stream] full_content={full_content!r}\n"
        f"[smoke stream] final.prompt={final.prompt_tokens} "  # type: ignore[attr-defined]
        f"cache_hit={final.prompt_cache_hit_tokens} "  # type: ignore[attr-defined]
        f"cache_miss={final.prompt_cache_miss_tokens} "  # type: ignore[attr-defined]
        f"completion={final.completion_tokens} finish={final.finish_reason}\n"  # type: ignore[attr-defined]
        f"[smoke stream] R9_has_usage={has_usage} "
        f"({'fallback unnecessary' if has_usage else 'tiktoken FALLBACK NEEDED'})"
    )

    # 不强制 assert has_usage: R9 风险点 = 不确定 DS V4 是否稳带, 测试目的就是
    # 揭示行为. 业务层 (Slice 0b token usage recorder) 调 estimate_tokens fallback.
