from __future__ import annotations

CURRENT_PRACTICE_PREFERENCES_SCHEMA_VERSION = 1

PRACTICE_PREFERENCE_RESET_SECTIONS = (
    "ui",
    "pacing",
    "auto_save",
    "keyboard",
    "reminders",
    "custom_practice",
)

RESET_SECTION_ALIAS_MAP = {
    "ui": "ui",
    "pacing": "pacing",
    "auto_save": "autoSave",
    "keyboard": "keyboard",
    "reminders": "reminders",
    "custom_practice": "customPractice",
}

AUDIT_TRACKED_PAYLOAD_PATHS = frozenset(
    {
        "ui.themePreference",
        "keyboard.enabled",
        "keyboard.bindings",
    }
)
