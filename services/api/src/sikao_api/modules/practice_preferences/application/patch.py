from __future__ import annotations

from typing import Any

from sikao_api.db.schemas_v2 import PracticePreferencesPatchV2, PracticePreferencesPayloadV1
from sikao_api.modules.practice_preferences.domain.errors import InvalidPatchPathError


def apply_patches_to_preferences_payload(
    *,
    payload: PracticePreferencesPayloadV1,
    patches: list[PracticePreferencesPatchV2],
) -> dict[str, Any]:
    merged = payload.model_dump(mode="json")
    for patch in patches:
        _apply_patch_path(merged, path=patch.path, value=patch.value)
    return merged


def _apply_patch_path(target: dict[str, Any], *, path: str, value: Any) -> None:
    raw_segments = path.split(".")
    if not path or any(segment == "" for segment in raw_segments):
        raise InvalidPatchPathError(path=path, message="patch path cannot be empty")
    segments = raw_segments

    cursor: Any = target
    for segment in segments[:-1]:
        if not isinstance(cursor, dict) or segment not in cursor:
            raise InvalidPatchPathError(path=path, message="invalid patch path")
        cursor = cursor[segment]
        if not isinstance(cursor, dict):
            raise InvalidPatchPathError(path=path, message="patch path must target an object field")

    leaf = segments[-1]
    if not isinstance(cursor, dict) or leaf not in cursor:
        raise InvalidPatchPathError(path=path, message="invalid patch path")
    if isinstance(cursor[leaf], dict):
        raise InvalidPatchPathError(
            path=path,
            message="patch path must target a leaf field",
        )
    cursor[leaf] = value
