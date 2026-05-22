"""Parser for Home plan generation payloads."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator, model_validator

from sikao_api.modules.llm.application.llm.json_parser import parse_with_recovery

_ALLOWED_CATEGORIES = {"xingce", "essay", "review", "mock", "break", "custom"}


class GeneratedPlanEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=2, max_length=80)
    category: str
    subject: str | None = None
    start_at: datetime
    end_at: datetime
    notes: str = Field(default="", max_length=200)
    target_id: int | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_bailian_shape(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        data = dict(value)
        if "start_at" not in data and "start" in data:
            data["start_at"] = data.pop("start")
        if "end_at" not in data and "end" in data:
            data["end_at"] = data.pop("end")
        if "notes" not in data and isinstance(data.get("description"), str):
            data["notes"] = data.pop("description")
        if "target_id" not in data and "targetId" in data:
            data["target_id"] = data.pop("targetId")
        return data

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str) -> str:
        if value not in _ALLOWED_CATEGORIES:
            raise ValueError(f"unsupported category: {value}")
        return value

    @field_validator("start_at", "end_at")
    @classmethod
    def validate_timezone_aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("datetime must include an explicit timezone offset")
        return value

    @field_validator("end_at")
    @classmethod
    def validate_window(
        cls, value: datetime, info: ValidationInfo
    ) -> datetime:
        start_at = info.data.get("start_at")
        if isinstance(start_at, datetime) and value <= start_at:
            raise ValueError("end_at must be after start_at")
        return value


class PlanOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    events: list[GeneratedPlanEvent]
    summary: dict[str, Any] = Field(default_factory=dict)
    errors: list[str] = Field(default_factory=list)


def parse_plan_output(raw: str) -> PlanOutput:
    payload = parse_with_recovery(raw)
    return PlanOutput.model_validate(payload)
