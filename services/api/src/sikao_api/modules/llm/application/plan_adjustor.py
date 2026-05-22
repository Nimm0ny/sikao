"""Home plan adjustment helpers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sikao_api.modules.llm.application.llm.provider import LLMMessage
from sikao_api.modules.llm.application.llm.prompts.plan_adjust import (
    PROMPT_VERSION as PLAN_ADJUST_PROMPT_VERSION,
    build_plan_adjust_messages,
)
from sikao_api.modules.llm.application.parsers.adjustment_parser import AdjustmentOutput
from sikao_api.modules.llm.application.parsers.adjustment_parser import parse_adjustment_output


@dataclass(frozen=True)
class PlanAdjustmentContext:
    plan_id: int
    source: str
    payload: dict[str, Any]


def build_adjustment_messages(*, context: PlanAdjustmentContext) -> list[LLMMessage]:
    return build_plan_adjust_messages(payload=context.payload)


def parse_adjustment(raw: str) -> AdjustmentOutput:
    return parse_adjustment_output(raw)


__all__ = [
    "PLAN_ADJUST_PROMPT_VERSION",
    "PlanAdjustmentContext",
    "build_adjustment_messages",
    "parse_adjustment",
]
