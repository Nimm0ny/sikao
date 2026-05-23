from __future__ import annotations

import pytest

from sikao_api.db.schemas_v2 import PracticePreferencesPatchV2
from sikao_api.modules.practice_preferences.application.defaults import (
    build_default_preferences,
)
from sikao_api.modules.practice_preferences.application.patch import (
    apply_patches_to_preferences_payload,
)
from sikao_api.modules.practice_preferences.application.reset import (
    apply_reset_sections,
)
from sikao_api.modules.practice_preferences.application.upgrader import (
    _UPGRADE_STEPS,
    upgrade_preferences_payload,
)
from sikao_api.modules.practice_preferences.application.validators import (
    validate_preferences_payload,
)
from sikao_api.modules.practice_preferences.domain.errors import (
    InvalidPatchPathError,
    InvalidPreferenceFieldError,
    InvalidResetSectionError,
    UnsupportedPracticePreferencesSchemaVersionError,
)


def test_build_default_preferences_is_stable() -> None:
    payload = build_default_preferences()
    assert payload.ui.font_size == "base"
    assert payload.keyboard.bindings.submit == "Ctrl+Enter"
    assert payload.custom_practice.last_used_count == 10


def test_validate_preferences_payload_rejects_duplicate_bindings() -> None:
    payload = build_default_preferences().model_dump(mode="python")
    payload["keyboard"]["bindings"]["favorite"] = "a"
    try:
        validate_preferences_payload(payload)
    except InvalidPreferenceFieldError as exc:
        assert exc.field == "keyboard.bindings"
        return
    raise AssertionError("expected InvalidPreferenceFieldError")


def test_apply_patches_uses_camel_case_paths() -> None:
    merged = apply_patches_to_preferences_payload(
        payload=build_default_preferences(),
        patches=[
            PracticePreferencesPatchV2(path="ui.themePreference", value="dark"),
            PracticePreferencesPatchV2(path="customPractice.lastUsedCount", value=20),
        ],
    )
    assert merged["ui"]["themePreference"] == "dark"
    assert merged["customPractice"]["lastUsedCount"] == 20


def test_apply_patches_rejects_unknown_path() -> None:
    with pytest.raises(InvalidPatchPathError) as exc_info:
        apply_patches_to_preferences_payload(
            payload=build_default_preferences(),
            patches=[PracticePreferencesPatchV2(path="ui.missingField", value=True)],
        )
    assert exc_info.value.message == "invalid patch path"


def test_apply_patches_rejects_object_level_replacement() -> None:
    with pytest.raises(InvalidPatchPathError) as exc_info:
        apply_patches_to_preferences_payload(
            payload=build_default_preferences(),
            patches=[
                PracticePreferencesPatchV2(
                    path="ui",
                    value={"themePreference": "dark"},
                )
            ],
    )
    assert exc_info.value.message == "patch path must target a leaf field"


def test_apply_patches_rejects_malformed_dot_path() -> None:
    with pytest.raises(InvalidPatchPathError) as exc_info:
        apply_patches_to_preferences_payload(
            payload=build_default_preferences(),
            patches=[
                PracticePreferencesPatchV2(
                    path="ui..themePreference",
                    value="dark",
                )
            ],
        )
    assert exc_info.value.message == "patch path cannot be empty"


def test_apply_reset_sections_uses_documented_section_names() -> None:
    payload = build_default_preferences()
    payload.ui.theme_preference = "dark"
    payload.custom_practice.last_used_count = 30
    payload.keyboard.bindings.favorite = "g"

    merged, sections = apply_reset_sections(
        payload=payload,
        sections=["custom_practice", "keyboard"],
    )
    assert sections == ["custom_practice", "keyboard"]
    assert merged["customPractice"]["lastUsedCount"] == 10
    assert merged["keyboard"]["bindings"]["favorite"] == "s"
    assert merged["ui"]["themePreference"] == "dark"


def test_apply_reset_sections_rejects_unknown_section() -> None:
    with pytest.raises(InvalidResetSectionError) as exc_info:
        apply_reset_sections(
            payload=build_default_preferences(),
            sections=["bogus"],
        )
    assert exc_info.value.message == "invalid reset section"


def test_upgrade_preferences_payload_supports_future_step_scaffold(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setitem(
        _UPGRADE_STEPS,
        0,
        lambda payload: {**payload, "ui": {"themePreference": "dark"}},
    )
    result = upgrade_preferences_payload(
        payload={},
        from_version=0,
        to_version=1,
    )
    assert result.upgraded is True
    assert result.payload.ui.theme_preference == "dark"


def test_upgrade_preferences_payload_rejects_unknown_path() -> None:
    with pytest.raises(UnsupportedPracticePreferencesSchemaVersionError):
        upgrade_preferences_payload(
            payload={},
            from_version=7,
            to_version=8,
        )
