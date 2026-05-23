from __future__ import annotations

from typing import Literal

from pydantic import Field

from sikao_api.core.schemas import CamelModel, UtcDatetime


class TimingEventV2(CamelModel):
    type: Literal["question_enter", "question_leave", "answer_change"]
    answer_id: int
    ts: UtcDatetime
    from_value: str | None = Field(default=None, alias="from")
    to_value: str | None = Field(default=None, alias="to")


class TimingEventBatchRequestV2(CamelModel):
    events: list[TimingEventV2] = Field(default_factory=list)
    client_clock_skew_ms: int | None = None


class TimingEventBatchAckV2(CamelModel):
    accepted: int
    rejected: int
    last_ack_event_idx: int


class TimingBaselineResponseV2(CamelModel):
    p50_ms: int
    p90_ms: int
    p95_ms: int
    mean_ms: int
    sample_size: int
