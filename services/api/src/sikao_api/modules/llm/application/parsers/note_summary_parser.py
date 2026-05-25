from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from sikao_api.modules.llm.application.llm.json_parser import parse_with_recovery


class NoteSummaryCardDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=50)


class NoteSummaryOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cards: list[NoteSummaryCardDraft] = Field(min_length=1, max_length=3)


def parse_note_summary_output(raw: str) -> NoteSummaryOutput:
    payload = parse_with_recovery(raw)
    return NoteSummaryOutput.model_validate(payload)


__all__ = [
    "NoteSummaryCardDraft",
    "NoteSummaryOutput",
    "parse_note_summary_output",
]
