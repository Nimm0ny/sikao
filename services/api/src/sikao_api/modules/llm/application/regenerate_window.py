from __future__ import annotations

from sikao_api.modules.llm.application.plan_generator import RegenerateRangeParams
from sikao_api.modules.system.application.errors import ValidationError


def validate_regenerate_window(*, params: RegenerateRangeParams) -> None:
    if params.to_date < params.from_date:
        raise ValidationError("to_date must be on or after from_date", code="invalid_regenerate_window")
    if (params.to_date - params.from_date).days > 13:
        raise ValidationError("regenerate range cannot exceed 14 days", code="invalid_regenerate_window")
