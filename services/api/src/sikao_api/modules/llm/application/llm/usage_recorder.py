"""LLM token usage 记账 — Slice 0b.

每次 LLM call 后调一次 record_usage(db, UsageRecord(...)) 落 llm_token_usage 行.
跟 ChatCompletionResult / ChatCompletionChunk dataclass 解耦 (调用方提取 token
数后构造 UsageRecord, 不让本模块直接 import provider DTO).

cost_cents 在 record_usage 内部计算 (compute_cost_cents from pricing.py).
BYOM 模型无价 → cost_cents=None, dashboard 标 N/A.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from sikao_api.db.models import LlmTokenUsage
from sikao_api.modules.llm.application.llm.pricing import compute_cost_cents


@dataclass(frozen=True)
class UsageRecord:
    """Inputs to record_usage. caller 从 ChatCompletionResult 提 token 数.

    feature 字面量: 'qa' | 'essay_grading' | 'study_plan' (Slice 1a/2c/3a 用).
    provider 字面量: 'system' (lhr 默认 DS) | 'user_byom' (Slice 0c).
    estimated=True 当 usage 来自 tiktoken 估算 (R9 fallback).
    """

    feature: str
    user_id: int | None
    provider: str
    model: str
    prompt_tokens: int
    prompt_cache_hit_tokens: int
    prompt_cache_miss_tokens: int
    completion_tokens: int
    estimated: bool = False
    resource_type: str | None = None
    resource_id: int | None = None


def record_usage(db: Session, record: UsageRecord) -> LlmTokenUsage:
    """Insert one row to llm_token_usage. Compute cost_cents on the fly.

    DB session 由调用方管 (commit 在 route handler / service 层). 本函数仅
    add + flush 让 row.id 拿到 (供 message.token_usage_id FK reference).
    """
    cost = compute_cost_cents(
        model=record.model,
        prompt_cache_hit_tokens=record.prompt_cache_hit_tokens,
        prompt_cache_miss_tokens=record.prompt_cache_miss_tokens,
        completion_tokens=record.completion_tokens,
    )
    row = LlmTokenUsage(
        user_id=record.user_id,
        feature=record.feature,
        resource_type=record.resource_type,
        resource_id=record.resource_id,
        provider=record.provider,
        model=record.model,
        prompt_tokens=record.prompt_tokens,
        prompt_cache_hit_tokens=record.prompt_cache_hit_tokens,
        prompt_cache_miss_tokens=record.prompt_cache_miss_tokens,
        completion_tokens=record.completion_tokens,
        total_tokens=record.prompt_tokens + record.completion_tokens,
        cost_cents=cost,
        estimated=record.estimated,
    )
    db.add(row)
    db.flush()
    return row
