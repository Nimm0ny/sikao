"""Home plan generation helpers."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any

from sikao_api.modules.llm.application.llm.provider import LLMMessage
from sikao_api.modules.llm.application.llm.prompts.plan_generate import (
    PROMPT_VERSION as PLAN_GENERATE_PROMPT_VERSION,
    build_plan_generate_messages,
)
from sikao_api.modules.llm.application.llm.prompts.plan_regenerate_range import (
    PROMPT_VERSION as PLAN_REGENERATE_PROMPT_VERSION,
    build_regenerate_range_messages,
)
from sikao_api.modules.llm.application.parsers.plan_output_parser import PlanOutput
from sikao_api.modules.llm.application.parsers.plan_output_parser import parse_plan_output


@dataclass(frozen=True)
class PlanGenerateParams:
    name: str
    target_exam_id: str
    target_exam_date: date
    daily_minutes_target: int
    style: str
    focus_subjects: list[str] = field(default_factory=list)
    baseline: dict[str, Any] = field(default_factory=dict)
    user_notes: str = ""


@dataclass(frozen=True)
class RegenerateRangeParams:
    plan_id: int
    from_date: date
    to_date: date
    user_notes: str = ""


def build_plan_generate_request_payload(*, params: PlanGenerateParams) -> dict[str, Any]:
    return {
        "name": params.name,
        "target_exam_id": params.target_exam_id,
        "target_exam_date": params.target_exam_date.isoformat(),
        "daily_minutes_target": params.daily_minutes_target,
        "style": params.style,
        "focus_subjects": params.focus_subjects,
        "baseline": params.baseline,
        "user_notes": params.user_notes,
    }


def build_regenerate_range_request_payload(
    *,
    params: RegenerateRangeParams,
    future_events: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "plan_id": params.plan_id,
        "from_date": params.from_date.isoformat(),
        "to_date": params.to_date.isoformat(),
        "future_events": future_events,
        "user_notes": params.user_notes,
    }


def build_regenerate_range_hash_payload(*, params: RegenerateRangeParams) -> dict[str, Any]:
    return {
        "plan_id": params.plan_id,
        "from_date": params.from_date.isoformat(),
        "to_date": params.to_date.isoformat(),
        "user_notes": params.user_notes,
    }


def build_generate_messages(
    *,
    params: PlanGenerateParams,
    today: date,
    timezone: str,
) -> list[LLMMessage]:
    return build_plan_generate_messages(
        today=today,
        timezone=timezone,
        payload=build_plan_generate_request_payload(params=params),
    )


def build_regenerate_messages(
    *,
    params: RegenerateRangeParams,
    future_events: list[dict[str, Any]],
) -> list[LLMMessage]:
    return build_regenerate_range_messages(
        payload=build_regenerate_range_request_payload(
            params=params,
            future_events=future_events,
        )
    )


def parse_generated_plan(raw: str) -> PlanOutput:
    return parse_plan_output(raw)


__all__ = [
    "PLAN_GENERATE_PROMPT_VERSION",
    "PLAN_REGENERATE_PROMPT_VERSION",
    "PlanGenerateParams",
    "RegenerateRangeParams",
    "build_generate_messages",
    "build_plan_generate_request_payload",
    "build_regenerate_range_hash_payload",
    "build_regenerate_messages",
    "build_regenerate_range_request_payload",
    "parse_generated_plan",
]
