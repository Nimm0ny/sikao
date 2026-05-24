from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from sikao_api.modules.llm.application.llm.json_parser import parse_with_recovery
from sikao_api.modules.llm.application.llm.prompts.cause_analysis_single import CAUSE_TAGS


_ALLOWED_SLUGS = {slug for slug, _name in CAUSE_TAGS}


class CauseAnalysisDimension(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slug: str
    name_display: str = Field(min_length=1)
    severity: Literal["high", "medium", "low"]
    suggestion: str = Field(min_length=3, max_length=160)
    llm_original: dict[str, object] | None = Field(
        default=None,
        alias="_llm_original",
        serialization_alias="_llm_original",
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_unknown_slug(cls, value: object) -> object:
        if not isinstance(value, dict):
            return value
        data = dict(value)
        normalized = str(data.get("slug", "")).strip().lower()
        if normalized and normalized not in _ALLOWED_SLUGS:
            data["_llm_original"] = {
                key: data[key]
                for key in ("slug", "name_display")
                if key in data
            }
            data["slug"] = "other"
            data["name_display"] = "其他"
            data["severity"] = "low"
        return data

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in _ALLOWED_SLUGS:
            raise ValueError("unsupported cause-analysis slug")
        return normalized


class ComparisonJudgment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    improved_dimensions: list[str] = Field(default_factory=list)
    persisted_dimensions: list[str] = Field(default_factory=list)
    newly_emerged_dimensions: list[str] = Field(default_factory=list)
    actions_likely_completed: list[bool] = Field(default_factory=list)
    overall_trend: Literal["improved", "partial_improvement", "stagnant", "regressed"]


class EvolutionContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    comparison_judgment: ComparisonJudgment


class CauseAnalysisPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str = Field(min_length=10, max_length=300)
    dimensions: list[CauseAnalysisDimension] = Field(default_factory=list, max_length=5)
    suggested_actions: list[str] = Field(default_factory=list, max_length=3)
    related_questions: list[int] = Field(default_factory=list)
    evolution_context: EvolutionContext | None = None


def parse_cause_analysis(raw: str) -> CauseAnalysisPayload:
    payload = parse_with_recovery(raw)
    return CauseAnalysisPayload.model_validate(payload)


__all__ = [
    "CauseAnalysisDimension",
    "CauseAnalysisPayload",
    "ComparisonJudgment",
    "EvolutionContext",
    "parse_cause_analysis",
]
