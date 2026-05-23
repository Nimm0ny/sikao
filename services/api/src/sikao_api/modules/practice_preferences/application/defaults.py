from __future__ import annotations

from sikao_api.db.schemas_v2 import (
    AutoSavePreferences,
    CustomPracticeDefaults,
    KeyBindings,
    KeyboardPreferences,
    PacingPreferences,
    PracticePreferencesPayloadV1,
    ReminderPreferences,
    UiPreferences,
)


def build_default_preferences() -> PracticePreferencesPayloadV1:
    return PracticePreferencesPayloadV1(
        ui=UiPreferences(),
        pacing=PacingPreferences(),
        auto_save=AutoSavePreferences(),
        keyboard=KeyboardPreferences(bindings=KeyBindings()),
        reminders=ReminderPreferences(),
        custom_practice=CustomPracticeDefaults(),
    )
