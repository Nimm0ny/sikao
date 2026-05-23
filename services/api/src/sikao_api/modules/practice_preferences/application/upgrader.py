from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from sikao_api.db.schemas_v2 import PracticePreferencesPayloadV1
from sikao_api.modules.practice_preferences.domain.errors import (
    UnsupportedPracticePreferencesSchemaVersionError,
)
from sikao_api.modules.practice_preferences.domain.types import (
    CURRENT_PRACTICE_PREFERENCES_SCHEMA_VERSION,
)

UpgradeStep = Callable[[dict[str, Any]], dict[str, Any]]
_UPGRADE_STEPS: dict[int, UpgradeStep] = {}


@dataclass(frozen=True)
class PracticePreferencesUpgradeResult:
    payload: PracticePreferencesPayloadV1
    from_version: int
    to_version: int
    upgraded: bool


def upgrade_preferences_payload(
    *,
    payload: dict[str, Any],
    from_version: int,
    to_version: int = CURRENT_PRACTICE_PREFERENCES_SCHEMA_VERSION,
) -> PracticePreferencesUpgradeResult:
    if from_version > to_version:
        raise UnsupportedPracticePreferencesSchemaVersionError(
            from_version=from_version,
            to_version=to_version,
        )

    current_payload = dict(payload)
    current_version = from_version
    while current_version < to_version:
        step = _UPGRADE_STEPS.get(current_version)
        if step is None:
            raise UnsupportedPracticePreferencesSchemaVersionError(
                from_version=from_version,
                to_version=to_version,
            )
        current_payload = step(dict(current_payload))
        current_version += 1

    validated = PracticePreferencesPayloadV1.model_validate(current_payload)
    return PracticePreferencesUpgradeResult(
        payload=validated,
        from_version=from_version,
        to_version=to_version,
        upgraded=from_version != to_version,
    )
