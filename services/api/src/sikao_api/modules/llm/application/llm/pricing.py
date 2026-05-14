"""LLM model pricing — Slice 0b.

价格来自官方公布 (DeepSeek: https://api-docs.deepseek.com/quick_start/pricing,
2026-04-29 验证). 单位 cents per 1M tokens. cache hit / miss 二档分价
(DeepSeek 命中 5min 内 prompt cache 时按 hit 价 = ~1/50 miss 价).

Pro 当前 75% 折扣中, 折扣价直接列. 到期 2026-05-31 15:59 UTC 后:
- 改下面三个 deepseek-v4-pro 字段 4x 升回 base price (input_hit=1.45 / miss=174 /
  output=348)
- admin dashboard 加提醒 (Slice 0b TODO)

价格表硬编码在代码里 (而非 settings env). 跟 plan §4.5 微调:
- env 注 9 个数字 cluttered, 改 module constant 集中维护
- BYOM 用户给的 endpoint (Slice 0c) 没价格 → cost_cents=None, dashboard 标 N/A
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ModelPrice:
    """Per-1M-tokens cents 价格. 三档: cache hit / cache miss / output."""

    input_hit: float       # prompt 命中 prompt cache 部分单价 (cents/M)
    input_miss: float      # prompt 未命中 cache 部分单价 (cents/M)
    output: float          # completion 单价 (cents/M)


# 来自官方价格表, 截至 2026-04-29 验证. Pro 当前 75% 折扣价 (到期 2026-05-31).
MODEL_PRICES: dict[str, ModelPrice] = {
    # DeepSeek V4 系列 (preview)
    "deepseek-v4-flash": ModelPrice(input_hit=0.28, input_miss=14.0, output=28.0),
    # Pro 当前 75% 折扣价. 到期后 4x: input_hit=1.45 / miss=174 / output=348
    "deepseek-v4-pro": ModelPrice(input_hit=0.3625, input_miss=43.5, output=87.0),
    # Legacy V3.2 (deprecated 2026-07-24, 前都可作 fallback). 同 V4 flash 价.
    "deepseek-chat": ModelPrice(input_hit=0.28, input_miss=14.0, output=28.0),
    "deepseek-reasoner": ModelPrice(input_hit=0.28, input_miss=14.0, output=28.0),
}


def compute_cost_cents(
    *,
    model: str,
    prompt_cache_hit_tokens: int,
    prompt_cache_miss_tokens: int,
    completion_tokens: int,
) -> int | None:
    """Compute call cost in cents.

    Returns:
        Integer cents (rounded). None if model not in MODEL_PRICES (BYOM 用户
        给的 endpoint 默认无价 → admin dashboard 标 N/A).

    cost = (hit * hit_price + miss * miss_price + output * output_price) / 1M
    """
    price = MODEL_PRICES.get(model)
    if price is None:
        return None
    cents = (
        prompt_cache_hit_tokens * price.input_hit
        + prompt_cache_miss_tokens * price.input_miss
        + completion_tokens * price.output
    ) / 1_000_000.0
    # round 后转 int (整数 cents 入 DB cost_cents column).
    return round(cents)
