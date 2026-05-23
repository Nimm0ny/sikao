from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from sikao_api.modules.llm.application.llm.json_parser import parse_with_recovery
from sikao_api.modules.llm.application.llm.prompts.essay_grading import (
    ESSAY_DIMENSION_NAMES,
)


EssayDimensionName = Literal[
    "论点准确",
    "材料运用",
    "语言",
    "结构",
    "字数符合度",
]


class EssayEvaluationDimension(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: EssayDimensionName
    score: float = Field(ge=0.0, le=10.0)
    comment: str = Field(min_length=1)


class EssayEvaluationPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dimensions: list[EssayEvaluationDimension] = Field(min_length=5)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def drop_provider_compat_fields(cls, value: object) -> object:
        if not isinstance(value, dict):
            return value
        data = dict(value)
        data.pop("total_score", None)
        return data


class EssayGradingPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    evaluation: EssayEvaluationPayload
    sample_answer: str = Field(min_length=1)


def parse_grading_output(raw: str) -> EssayGradingPayload:
    payload = parse_with_recovery(raw)
    parsed = EssayGradingPayload.model_validate(payload)
    seen_names = tuple(item.name for item in parsed.evaluation.dimensions)
    if seen_names != ESSAY_DIMENSION_NAMES:
        raise ValueError(
            "evaluation.dimensions must follow the documented order: "
            + ", ".join(ESSAY_DIMENSION_NAMES)
        )
    return parsed


__all__ = [
    "EssayEvaluationDimension",
    "EssayEvaluationPayload",
    "EssayGradingPayload",
    "parse_grading_output",
]
