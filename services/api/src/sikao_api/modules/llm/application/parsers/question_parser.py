from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator, model_validator

from sikao_api.modules.llm.application.llm.json_parser import parse_with_recovery


class ParsedGeneratedQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_question_id: int
    type: Literal["single_choice", "multi_choice"]
    stem: str = Field(min_length=10)
    options: dict[str, str]
    correct_answer: str
    explanation: str = Field(min_length=30)
    estimated_difficulty: float | None = Field(default=None, ge=0.0, le=1.0)

    @model_validator(mode="before")
    @classmethod
    def normalize_shape(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        data = dict(value)
        if "source_question_id" not in data and "sourceQuestionId" in data:
            data["source_question_id"] = data.pop("sourceQuestionId")
        if "correct_answer" not in data and "correctAnswer" in data:
            data["correct_answer"] = data.pop("correctAnswer")
        if "estimated_difficulty" not in data and "estimatedDifficulty" in data:
            data["estimated_difficulty"] = data.pop("estimatedDifficulty")
        return data

    @field_validator("options")
    @classmethod
    def validate_options(cls, value: dict[str, str]) -> dict[str, str]:
        keys = sorted(value)
        if keys != ["A", "B", "C", "D"]:
            raise ValueError("options must contain exactly A/B/C/D")
        normalized = {key: item.strip() for key, item in value.items()}
        if any(not item for item in normalized.values()):
            raise ValueError("options cannot be empty")
        return normalized

    @field_validator("correct_answer")
    @classmethod
    def normalize_correct_answer(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not normalized or any(char not in {"A", "B", "C", "D"} for char in normalized):
            raise ValueError("correct_answer must use only A/B/C/D")
        if len(set(normalized)) != len(normalized):
            raise ValueError("correct_answer cannot repeat option letters")
        return "".join(sorted(normalized))

    @field_validator("correct_answer")
    @classmethod
    def validate_correct_answer(cls, value: str, info: ValidationInfo) -> str:
        question_type = info.data.get("type")
        if question_type == "single_choice" and len(value) != 1:
            raise ValueError("single_choice must have exactly one correct option")
        if question_type == "multi_choice" and not 2 <= len(value) <= 4:
            raise ValueError("multi_choice must have 2-4 correct options")
        return value


class QuestionGenerationPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    questions: list[ParsedGeneratedQuestion]


class QuestionAuditIssue(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dimension: Literal[
        "answer_correctness",
        "stem_clarity",
        "options_balance",
        "difficulty",
        "safety",
    ]
    description: str = Field(min_length=3)


class QuestionAuditResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    passed: bool
    confidence: float = Field(ge=0.0, le=1.0)
    reason: str = Field(min_length=5, max_length=200)
    issues: list[QuestionAuditIssue] = Field(default_factory=list)


def parse_question_generation(raw: str) -> list[ParsedGeneratedQuestion]:
    payload = parse_with_recovery(raw)
    return QuestionGenerationPayload.model_validate(payload).questions


def parse_question_audit(raw: str) -> QuestionAuditResult:
    payload = parse_with_recovery(raw)
    return QuestionAuditResult.model_validate(payload)


__all__ = [
    "ParsedGeneratedQuestion",
    "QuestionAuditIssue",
    "QuestionAuditResult",
    "parse_question_audit",
    "parse_question_generation",
]
