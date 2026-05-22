"""Parser for Home plan adjustment proposals."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from sikao_api.modules.llm.application.llm.json_parser import parse_with_recovery


class AdjustmentChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["edit", "add", "delete"]
    event_id: int | None = None
    before: dict[str, Any] | None = None
    after: dict[str, Any] | None = None
    diff_summary: str = Field(min_length=1, max_length=100)


class AdjustmentOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(min_length=8, max_length=200)
    changes: list[AdjustmentChange] = Field(default_factory=list, max_length=8)
    skip_reason: str | None = None


def parse_adjustment_output(raw: str) -> AdjustmentOutput:
    payload = parse_with_recovery(raw)
    return AdjustmentOutput.model_validate(payload)
