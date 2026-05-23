from __future__ import annotations

from typing import Any

from pydantic import ValidationError as PydanticValidationError

from sikao_api.db.schemas_v2 import PracticePreferencesPayloadV1
from sikao_api.modules.practice_preferences.domain.errors import InvalidPreferenceFieldError


def validate_preferences_payload(
    payload: PracticePreferencesPayloadV1 | dict[str, Any],
) -> PracticePreferencesPayloadV1:
    try:
        return PracticePreferencesPayloadV1.model_validate(payload)
    except PydanticValidationError as exc:
        first = exc.errors()[0]
        field = ".".join(str(part) for part in first["loc"])
        raise InvalidPreferenceFieldError(
            field=field,
            message=str(first["msg"]),
        ) from exc
