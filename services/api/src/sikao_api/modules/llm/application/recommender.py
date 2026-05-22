"""Home recommendation helpers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sikao_api.modules.llm.application.llm.provider import LLMMessage
from sikao_api.modules.llm.application.llm.prompts.recommend_today import (
    PROMPT_VERSION as RECOMMEND_TODAY_PROMPT_VERSION,
    build_recommend_today_messages,
)
from sikao_api.modules.llm.application.parsers.recommendation_parser import RecommendationOutput
from sikao_api.modules.llm.application.parsers.recommendation_parser import parse_recommendation_output
from sikao_api.modules.llm.application.recommender_policy import build_recommendation_policy_header


@dataclass(frozen=True)
class RecommendationContext:
    payload: dict[str, Any]


def build_recommendation_messages(*, context: RecommendationContext) -> list[LLMMessage]:
    return build_recommend_today_messages(
        payload=context.payload,
        policy_header=build_recommendation_policy_header(),
    )


def parse_recommendations(raw: str) -> RecommendationOutput:
    return parse_recommendation_output(raw)


__all__ = [
    "RECOMMEND_TODAY_PROMPT_VERSION",
    "RecommendationContext",
    "build_recommendation_messages",
    "parse_recommendations",
]
