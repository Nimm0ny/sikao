from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from sikao_api.modules.llm.application.llm.json_parser import parse_with_recovery
from sikao_api.modules.review.application.cause_analysis_cache import CauseTagDefinition
from sikao_api.modules.review.data.cause_tag_seed_v1 import CAUSE_TAG_SEED_V1


_DEFAULT_ALLOWED_TAGS = {
    str(row["slug"]): CauseTagDefinition(
        slug=str(row["slug"]),
        name=str(row["name"]),
        category=str(row["category"]),
        severity_default=str(row["severity_default"]),
        description=str(row["description"]),
        display_order=int(str(row["display_order"])),
        taxonomy_version="v1",
    )
    for row in CAUSE_TAG_SEED_V1
}


class CauseAnalysisDimensionOverride(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slug_original: str
    slug_overridden: str
    severity_overridden: Literal["high", "medium", "low"] | None = None
    user_note: str | None = None
    overridden_at: str


class CauseAnalysisDimension(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slug: str
    name_display: str = Field(min_length=1)
    severity: Literal["high", "medium", "low"]
    suggestion: str = Field(min_length=1, max_length=500)
    user_override: CauseAnalysisDimensionOverride | None = None
    llm_original: dict[str, object] | None = Field(
        default=None,
        alias="_llm_original",
        serialization_alias="_llm_original",
    )
    llm_original_slug: str | None = Field(
        default=None,
        alias="_llm_original_slug",
        serialization_alias="_llm_original_slug",
    )


class ComparisonJudgment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    improved_dimensions: list[str] = Field(default_factory=list)
    persisted_dimensions: list[str] = Field(default_factory=list)
    newly_emerged_dimensions: list[str] = Field(default_factory=list)
    actions_likely_completed: list[bool] = Field(default_factory=list)
    overall_trend: Literal["improved", "partial_improvement", "stagnant", "regressed"]


class EvolutionContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    previous_analysis_id: int | None = None
    previous_analyzed_at: str | None = None
    previous_dimensions: list[CauseAnalysisDimension] = Field(default_factory=list)
    previous_suggested_actions: list[str] = Field(default_factory=list)
    previous_confidence: str | None = None
    comparison_judgment: ComparisonJudgment


class CauseAnalysisPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str = Field(min_length=1, max_length=300)
    dimensions: list[CauseAnalysisDimension] = Field(default_factory=list, max_length=5)
    suggested_actions: list[str] = Field(default_factory=list, max_length=3)
    related_questions: list[int] = Field(default_factory=list)
    evolution_context: EvolutionContext | None = None


@dataclass(frozen=True)
class ParsedCauseAnalysis:
    payload: CauseAnalysisPayload
    fallback_count: int


def parse_cause_analysis(
    raw: str,
    *,
    allowed_tags: dict[str, CauseTagDefinition] | None = None,
) -> CauseAnalysisPayload:
    return parse_cause_analysis_with_meta(raw, allowed_tags=allowed_tags).payload


def parse_cause_analysis_with_meta(
    raw: str,
    *,
    allowed_tags: dict[str, CauseTagDefinition] | None = None,
) -> ParsedCauseAnalysis:
    payload = parse_with_recovery(raw)
    allowed = allowed_tags or _DEFAULT_ALLOWED_TAGS
    normalized = _normalize_payload(payload, allowed_tags=allowed)
    parsed = CauseAnalysisPayload.model_validate(normalized)
    fallback_count = sum(1 for dimension in parsed.dimensions if dimension.llm_original is not None)
    return ParsedCauseAnalysis(payload=parsed, fallback_count=fallback_count)


def _normalize_payload(
    payload: object,
    *,
    allowed_tags: dict[str, CauseTagDefinition],
) -> object:
    if not isinstance(payload, dict):
        return payload
    data = dict(payload)
    raw_dimensions = data.get("dimensions", [])
    if isinstance(raw_dimensions, list):
        data["dimensions"] = [
            _normalize_dimension(dimension, allowed_tags=allowed_tags)
            for dimension in raw_dimensions[:5]
            if isinstance(dimension, dict)
        ]
    else:
        data["dimensions"] = []
    return data


def _normalize_dimension(
    value: dict[str, object],
    *,
    allowed_tags: dict[str, CauseTagDefinition],
) -> dict[str, object]:
    data = dict(value)
    raw_slug = str(data.get("slug", "")).strip().lower()
    raw_name = str(data.get("name_display", "") or data.get("name", "")).strip()
    severity = str(data.get("severity", "medium")).strip().lower()
    if severity not in {"high", "medium", "low"}:
        severity = "medium"

    if raw_slug in allowed_tags:
        tag = allowed_tags[raw_slug]
        data["slug"] = raw_slug
        data["name_display"] = raw_name or tag.name
        data["severity"] = severity
        return data

    other = allowed_tags.get("other")
    if other is None:
        raise ValueError("cause-analysis taxonomy is missing required 'other' tag")
    data["_llm_original"] = dict(value)
    data["_llm_original_slug"] = raw_slug or "other"
    data["slug"] = "other"
    data["name_display"] = other.name
    data["severity"] = "low"
    if not str(data.get("suggestion", "")).strip():
        data["suggestion"] = raw_name or "LLM returned an unsupported cause tag."
    return data


__all__ = [
    "CauseAnalysisDimension",
    "CauseAnalysisDimensionOverride",
    "CauseAnalysisPayload",
    "ComparisonJudgment",
    "EvolutionContext",
    "ParsedCauseAnalysis",
    "parse_cause_analysis",
    "parse_cause_analysis_with_meta",
]
