from __future__ import annotations

from typing import Any

from sikao_api.db.schemas_v2 import PracticePreferencesPayloadV1
from sikao_api.modules.practice_preferences.application.defaults import (
    build_default_preferences,
)
from sikao_api.modules.practice_preferences.domain.errors import (
    InvalidResetSectionError,
)
from sikao_api.modules.practice_preferences.domain.types import (
    PRACTICE_PREFERENCE_RESET_SECTIONS,
    RESET_SECTION_ALIAS_MAP,
)


def apply_reset_sections(
    *,
    payload: PracticePreferencesPayloadV1,
    sections: list[str],
) -> tuple[dict[str, Any], list[str]]:
    merged = payload.model_dump(mode="json")
    defaults = build_default_preferences().model_dump(mode="json")
    resolved_sections = _normalize_sections(sections)
    for section in resolved_sections:
        alias = RESET_SECTION_ALIAS_MAP[section]
        merged[alias] = defaults[alias]
    return merged, resolved_sections


def _normalize_sections(sections: list[str]) -> list[str]:
    if not sections:
        return list(PRACTICE_PREFERENCE_RESET_SECTIONS)

    normalized: list[str] = []
    seen: set[str] = set()
    for section in sections:
        if section not in RESET_SECTION_ALIAS_MAP:
            raise InvalidResetSectionError(
                section=section,
                message="invalid reset section",
            )
        if section in seen:
            continue
        normalized.append(section)
        seen.add(section)
    return normalized
