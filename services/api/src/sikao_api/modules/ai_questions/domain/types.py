from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from sikao_api.modules.llm.application.question_generator import ParsedGeneratedQuestion, SourceQuestion

YearRange = Literal["all", "recent_3", "recent_5", "recent_10"]
PracticeType = Literal["xingce", "essay"]


@dataclass(frozen=True)
class AiGenerateConfig:
    user_id: int
    type: PracticeType
    category_l1: str | None
    category_l2: str | None
    year_range: YearRange
    difficulty_range: tuple[float, float]
    count: int
    exclude_already_done: bool = True
    only_wrong: bool = False


@dataclass(frozen=True)
class GeneratedQuestionCandidate:
    question: ParsedGeneratedQuestion
    source: SourceQuestion


@dataclass(frozen=True)
class AiGenerateResult:
    question_ids: list[int]
    status: str
    pool_count: int
    llm_generated_count: int
    request_id: int
    duration_ms: int


@dataclass(frozen=True)
class LlmGenerationBundle:
    questions: list[GeneratedQuestionCandidate]
    llm_call_id: int | None
    self_audit_passed_count: int

