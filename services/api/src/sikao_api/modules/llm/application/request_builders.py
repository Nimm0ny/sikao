from __future__ import annotations

from datetime import datetime
from typing import Any

from sikao_api.db.schemas_v2 import PlanCreateRequestV2, PlanEventCreateRequestV2
from sikao_api.modules.llm.application.plan_generator import PlanGenerateParams, RegenerateRangeParams
from sikao_api.modules.llm.application.sanitizer import sanitize_user_input
from sikao_api.modules.system.application.errors import ValidationError


def sanitize_generate_params(
    params: PlanGenerateParams,
    *,
    max_input_tokens: int,
) -> PlanGenerateParams:
    return PlanGenerateParams(
        name=params.name,
        target_exam_id=params.target_exam_id,
        target_exam_date=params.target_exam_date,
        daily_minutes_target=params.daily_minutes_target,
        style=params.style,
        focus_subjects=params.focus_subjects,
        baseline=params.baseline,
        user_notes=sanitize_user_input(params.user_notes, max_chars=max_input_tokens),
    )


def sanitize_regenerate_params(
    params: RegenerateRangeParams,
    *,
    max_input_tokens: int,
) -> RegenerateRangeParams:
    return RegenerateRangeParams(
        plan_id=params.plan_id,
        from_date=params.from_date,
        to_date=params.to_date,
        user_notes=sanitize_user_input(params.user_notes, max_chars=max_input_tokens),
    )


def build_generated_plan_request(*, params: PlanGenerateParams) -> PlanCreateRequestV2:
    return PlanCreateRequestV2(
        name=params.name,
        target_exam_id=params.target_exam_id,
        target_exam_date=params.target_exam_date,
        daily_minutes_target=params.daily_minutes_target,
        style=params.style,
        baseline=params.baseline,
        focus_subjects=params.focus_subjects,
    )


def build_generated_event_request(
    *,
    plan_id: int,
    event: dict[str, Any],
    default_timezone: str,
) -> PlanEventCreateRequestV2:
    return PlanEventCreateRequestV2(
        plan_id=plan_id,
        title=str(event["title"]),
        category=str(event["category"]),
        notes=str(event.get("notes") or ""),
        start_at=normalize_datetime(event["start_at"]),
        end_at=normalize_datetime(event["end_at"]),
        timezone=str(event.get("timezone") or default_timezone),
        recurring_rule=event.get("recurring_rule"),
        source="ai_generated",
        target_id=event.get("target_id"),
    )


def normalize_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValidationError(
                "datetime must include an explicit timezone offset",
                code="llm_datetime_timezone_required",
            )
        return value
    parsed = datetime.fromisoformat(str(value))
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValidationError(
            "datetime must include an explicit timezone offset",
            code="llm_datetime_timezone_required",
        )
    return parsed
