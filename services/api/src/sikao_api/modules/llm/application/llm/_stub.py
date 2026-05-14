"""Stub LLM provider for e2e/smoke testing — returns fixed fixture without real API call.

Activated when LLM_API_KEY starts with 'mock-' or 'fake-'. 200ms simulated delay
to keep the BackgroundTask poll path realistic. Fixture is essay-grading-shaped
JSON; for non-essay LLM features (qa / study-plan) the same fixture is returned
and may not parse correctly — this stub focuses on essay grading e2e flow only.

Design rationale: keeping the stub in-process (vs HTTP mock server) avoids
network setup and lets pytest fixtures share the same path. Real essay grading
uses build_llm_provider() returning OpenAICompatibleProvider against DeepSeek.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

from sikao_api.modules.llm.application.llm.provider import (
    ChatCompletionChunk,
    ChatCompletionResult,
    LLMMessage,
)

# Schema 跟 essay_grading.py::_finalize_feedback 期望对齐:
# - 顶级 evaluation (object) + sample_answer (string)
# - evaluation.dimensions[].name 必须命中 ESSAY_DIMENSIONS 5 个 (论点准确 / 材料运用 / 语言 / 结构 / 字数符合度)
# - dimension.score 0-10 浮点
# 见 services/llm/prompts/essay_grading.py 第 28-34 行
_STUB_ESSAY_FEEDBACK: dict[str, object] = {
    "evaluation": {
        "dimensions": [
            {"name": "论点准确", "score": 8.0, "comment": "立意明确，紧扣题意，论点回应给定材料"},
            {"name": "材料运用", "score": 7.5, "comment": "材料引用充分，未过度抄袭原文"},
            {"name": "语言", "score": 7.0, "comment": "表达流畅，公文体感稍弱"},
            {"name": "结构", "score": 7.5, "comment": "开头-论证-结尾层次清晰"},
            {"name": "字数符合度", "score": 9.0, "comment": "字数符合题干上下界要求"},
        ],
        "strengths": ["立意切题明确", "结构层次工整", "材料引用恰当"],
        "weaknesses": ["论据深度可加强", "举例可更新颖"],
        "suggestions": ["第二段可补充对比论证", "结尾回扣立意 + 高位结论"],
    },
    "sample_answer": (
        "（mock 范文 · e2e 占位）\n\n"
        "立意先行，论据为支撑。本题应当从「治理理念升级」高位切入，以"
        "材料中的核心数据（如「1 万亿千瓦时」）开篇，三段式展开「现状—难点—路径」，"
        "结尾回扣立意。注意：本范文为 e2e 测试 stub provider 返回的固定 fixture，"
        "真实评分请配置 LLM_API_KEY 为真 key (sk-...)。"
    ),
}


class StubLLMProvider:
    """Stub provider — returns fixed fixture, no real API call.

    Implements LLMProvider Protocol. Activated by LLM_API_KEY=mock-* / fake-*.
    """

    async def chat_completion(
        self,
        *,
        messages: list[LLMMessage],
        model: str,
        max_tokens: int | None = None,
        temperature: float = 0.7,
    ) -> ChatCompletionResult:
        await asyncio.sleep(0.2)
        return ChatCompletionResult(
            content=json.dumps(_STUB_ESSAY_FEEDBACK, ensure_ascii=False),
            prompt_tokens=120,
            prompt_cache_hit_tokens=0,
            prompt_cache_miss_tokens=120,
            completion_tokens=180,
            model=model,
            finish_reason="stop",
        )

    async def chat_completion_stream(
        self,
        *,
        messages: list[LLMMessage],
        model: str,
        max_tokens: int | None = None,
        temperature: float = 0.7,
    ) -> AsyncIterator[ChatCompletionChunk]:
        await asyncio.sleep(0.05)
        full_content = json.dumps(_STUB_ESSAY_FEEDBACK, ensure_ascii=False)
        yield ChatCompletionChunk(
            content_delta=full_content,
            is_final=False,
            prompt_tokens=None,
            prompt_cache_hit_tokens=None,
            prompt_cache_miss_tokens=None,
            completion_tokens=None,
            finish_reason=None,
        )
        yield ChatCompletionChunk(
            content_delta="",
            is_final=True,
            prompt_tokens=120,
            prompt_cache_hit_tokens=0,
            prompt_cache_miss_tokens=120,
            completion_tokens=180,
            finish_reason="stop",
        )
