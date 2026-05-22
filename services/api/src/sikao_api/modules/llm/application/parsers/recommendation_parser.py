"""Parser for Home today recommendations."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from sikao_api.modules.llm.application.llm.json_parser import parse_with_recovery


class RecommendationDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=4, max_length=80)
    reason: str = Field(min_length=10, max_length=200)
    estimated_minutes: int = Field(ge=5, le=60)
    action_type: Literal["review", "continue", "rest"]
    cta: str = Field(min_length=1, max_length=12)
    payload: dict[str, Any] = Field(default_factory=dict)


class RecommendationOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    recommendations: list[RecommendationDraft] = Field(default_factory=list, max_length=3)


def parse_recommendation_output(raw: str) -> RecommendationOutput:
    payload = parse_with_recovery(raw)
    return RecommendationOutput.model_validate(payload)
