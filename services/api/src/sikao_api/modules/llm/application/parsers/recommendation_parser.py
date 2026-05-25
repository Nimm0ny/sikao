"""Parser for Home today recommendations."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from sikao_api.modules.llm.application.llm.json_parser import parse_with_recovery


class RecommendationDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=4, max_length=80)
    reason: str = Field(min_length=10, max_length=200)
    estimated_minutes: int = Field(ge=5, le=60)
    action_type: Literal["review", "continue", "rest"]
    cta: str = Field(min_length=1, max_length=12)
    payload: dict[str, Any]

    @model_validator(mode="before")
    @classmethod
    def normalize_bailian_shape(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        data = dict(value)
        if "action_type" not in data and isinstance(data.get("actionType"), str):
            data["action_type"] = data.pop("actionType")
        if "reason" not in data and isinstance(data.get("description"), str):
            data["reason"] = data.pop("description")
        if "estimated_minutes" not in data and isinstance(data.get("estimatedMinutes"), int):
            data["estimated_minutes"] = data.pop("estimatedMinutes")
        if "cta" not in data and isinstance(data.get("ctaLabel"), str):
            data["cta"] = data.pop("ctaLabel")
        return data


class RecommendationOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    recommendations: list[RecommendationDraft] = Field(default_factory=list, max_length=3)


def parse_recommendation_output(raw: str) -> RecommendationOutput:
    payload = parse_with_recovery(raw)
    return RecommendationOutput.model_validate(payload)
