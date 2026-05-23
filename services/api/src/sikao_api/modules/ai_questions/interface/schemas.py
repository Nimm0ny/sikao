from __future__ import annotations

from typing import Literal

from pydantic import Field, model_validator

from sikao_api.core.schemas import CamelModel, UtcDatetime


class AiQuestionsGenerateConfigV2(CamelModel):
    type: Literal["xingce", "essay"]
    category_l1: str | None = None
    category_l2: str | None = None
    year_range: Literal["all", "recent_3", "recent_5", "recent_10"] = "all"
    difficulty_range: tuple[float, float] = (0.0, 1.0)
    count: int = Field(ge=1, le=30)
    exclude_already_done: bool = True
    only_wrong: bool = False

    @model_validator(mode="after")
    def validate_difficulty_range(self) -> "AiQuestionsGenerateConfigV2":
        lower, upper = self.difficulty_range
        if not (0.0 <= lower <= 1.0 and 0.0 <= upper <= 1.0 and lower <= upper):
            raise ValueError("difficulty_range must stay within [0, 1] and lower <= upper")
        return self


class AiQuestionsGenerateRequestV2(CamelModel):
    config: AiQuestionsGenerateConfigV2


class AiQuestionRequestDetailV2(CamelModel):
    id: int
    status: str
    request_params: dict[str, object]
    pool_question_ids: list[int]
    llm_generated_question_ids: list[int]
    llm_self_audit_passed_count: int
    llm_call_id: int | None = None
    error_message: str | None = None
    started_at: UtcDatetime
    completed_at: UtcDatetime | None = None
    duration_ms: int | None = None


class AiQuestionFeedbackRequestV2(CamelModel):
    action: Literal["like", "report"]
    note: str | None = Field(default=None, max_length=512)


class AiQuestionFeedbackResponseV2(CamelModel):
    question_id: int
    action: Literal["like", "report"]
    quality_score: float
    report_count: int
    is_active: bool
