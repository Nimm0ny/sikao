"""共享 LLM provider stub helpers.

抽出动机 (subagent review P1-5): test_essay_grading_routes.py +
test_cross_feature_smoke.py 各自维护 _StubProvider + well_formed_essay_payload
近乎逐字重复. provider 接口 (chat_completion args / ChatCompletionResult shape)
变化时, 两份独立 stub 都要跟, 容易漏一份.

使用约定:
- StubLlmProvider 实现 LlmProvider Protocol 结构 (不继承). 测试方按需 import,
  不绑死单 provider.
- well_formed_essay_payload() 返一份过 essay sanity check 的 JSON. 调用方按
  需 monkeypatch sikao_api.modules.llm.application.essay_grader.build_llm_provider.
"""
from __future__ import annotations

import json

from sikao_api.modules.llm.application.llm.provider import ChatCompletionResult


class StubLlmProvider:
    """LLM provider Protocol structural stub. chat_completion 返固定 content,
    chat_completion_stream 不实现 (整流接 SSE 测试别用本 stub, 见 test_llm_conversations.py)."""

    def __init__(self, content: str) -> None:
        self.content = content

    async def chat_completion(self, **_kwargs: object) -> ChatCompletionResult:
        return ChatCompletionResult(
            content=self.content,
            prompt_tokens=100,
            prompt_cache_hit_tokens=0,
            prompt_cache_miss_tokens=100,
            completion_tokens=50,
            model="deepseek-v4-pro-stub",
            finish_reason="stop",
        )

    def chat_completion_stream(self, **_kwargs: object) -> object:
        raise NotImplementedError(
            "StubLlmProvider 不接 SSE — 流式测试用 test_llm_conversations.py 自己的 stub"
        )


def well_formed_essay_payload(*, sample_chars: int = 950) -> str:
    """过 essay sanity check 的 JSON: 5 维度 score [6,9] + sample_answer 长度.

    weighted score: 0.30*8 + 0.25*7 + 0.20*8 + 0.15*9 + 0.10*6 = 7.7 → 77.0.
    """
    return json.dumps(
        {
            "evaluation": {
                "dimensions": [
                    {"name": "论点准确", "score": 8, "comment": "ok"},
                    {"name": "材料运用", "score": 7, "comment": "ok"},
                    {"name": "语言", "score": 8, "comment": "ok"},
                    {"name": "结构", "score": 9, "comment": "ok"},
                    {"name": "字数符合度", "score": 6, "comment": "ok"},
                ],
                "strengths": ["s1"],
                "weaknesses": ["w1"],
                "suggestions": ["sg1"],
            },
            "sample_answer": "x" * sample_chars,
        },
        ensure_ascii=False,
    )
