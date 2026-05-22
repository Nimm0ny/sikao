"""Cost helpers and LlmCallV2 persistence."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import LlmCallV2


@dataclass(frozen=True)
class LlmCallRecord:
    user_id: int
    purpose: str
    prompt_version: str
    provider: str
    model: str
    input_tokens: int | None
    output_tokens: int | None
    request_payload: dict[str, Any]
    response_payload: dict[str, Any] | None
    parsed_output: dict[str, Any] | None
    parse_status: str
    error_class: str | None
    error_message: str | None
    retry_count: int
    latency_ms: int


def compute_cost_cny(
    *,
    settings: Settings,
    input_tokens: int | None,
    output_tokens: int | None,
) -> Decimal | None:
    if input_tokens is None or output_tokens is None:
        return None
    input_cost = Decimal(input_tokens) * Decimal(str(settings.llm_cost_input_per_1m))
    output_cost = Decimal(output_tokens) * Decimal(str(settings.llm_cost_output_per_1m))
    total = (input_cost + output_cost) / Decimal("1000000")
    return total.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def truncate_payload(payload: dict[str, Any] | None, *, max_chars: int = 32768) -> dict[str, Any] | None:
    if payload is None:
        return None
    text = str(payload)
    if len(text) <= max_chars:
        return payload
    return {"truncated": True, "preview": text[:max_chars]}


def add_llm_call(
    session: Session,
    *,
    settings: Settings,
    record: LlmCallRecord,
) -> LlmCallV2:
    row = LlmCallV2(
        user_id=record.user_id,
        purpose=record.purpose,
        prompt_version=record.prompt_version,
        provider=record.provider,
        model=record.model,
        input_tokens=record.input_tokens,
        output_tokens=record.output_tokens,
        cost_cny=compute_cost_cny(
            settings=settings,
            input_tokens=record.input_tokens,
            output_tokens=record.output_tokens,
        ),
        latency_ms=record.latency_ms,
        request_payload=truncate_payload(record.request_payload) or {},
        response_payload=truncate_payload(record.response_payload),
        parsed_output=truncate_payload(record.parsed_output),
        parse_status=record.parse_status,
        error_class=record.error_class,
        error_message=record.error_message,
        retry_count=record.retry_count,
        created_at=datetime.now(UTC).replace(tzinfo=None),
    )
    session.add(row)
    session.flush()
    return row
