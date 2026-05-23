from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from sikao_api.modules.llm.application.llm.json_parser import parse_with_recovery


class ReferenceAnswerPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str = Field(min_length=100)
    structure_outline: list[str] = Field(min_length=3)
    key_points: list[str] = Field(min_length=3, max_length=8)
    estimated_score: float | None = Field(default=None, ge=60.0, le=100.0)


class ReferenceAnswerAuditIssue(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dimension: Literal[
        "grounding",
        "coverage",
        "structure",
        "length",
        "safety",
    ]
    description: str = Field(min_length=3)


class ReferenceAnswerAuditResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    passed: bool
    confidence: float = Field(ge=0.0, le=1.0)
    reason: str = Field(min_length=5, max_length=200)
    issues: list[ReferenceAnswerAuditIssue] = Field(default_factory=list)


def parse_reference_answer(raw: str) -> ReferenceAnswerPayload:
    payload = parse_with_recovery(raw)
    return ReferenceAnswerPayload.model_validate(payload)


def parse_reference_answer_audit(raw: str) -> ReferenceAnswerAuditResult:
    payload = parse_with_recovery(raw)
    return ReferenceAnswerAuditResult.model_validate(payload)


__all__ = [
    "ReferenceAnswerAuditIssue",
    "ReferenceAnswerAuditResult",
    "ReferenceAnswerPayload",
    "parse_reference_answer",
    "parse_reference_answer_audit",
]
