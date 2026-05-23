from __future__ import annotations

from typing import Literal

from pydantic import ConfigDict, Field

from sikao_api.core.schemas import CamelModel, UtcDatetime
from sikao_api.db.schemas_v2 import PracticePreferencesPayloadV1


class StrictCamelModel(CamelModel):
    model_config = ConfigDict(
        alias_generator=CamelModel.model_config.get("alias_generator"),
        populate_by_name=True,
        from_attributes=True,
        extra="forbid",
    )


class UiPreferencesPayloadWireV1(StrictCamelModel):
    font_size: str
    line_height: str
    theme_preference: str
    show_question_index: bool
    show_timing_indicator: bool
    show_overtime_warning: bool
    answer_panel_position: str


class PacingPreferencesPayloadWireV1(StrictCamelModel):
    default_practice_mode: str
    auto_advance_after_answer: bool
    auto_advance_delay_seconds: int
    confirm_before_submit: bool
    confirm_when_unanswered_count_gte: int


class AutoSavePreferencesPayloadWireV1(StrictCamelModel):
    enabled: bool
    interval_seconds: int
    save_to_local_storage: bool


class KeyBindingsPayloadWireV1(StrictCamelModel):
    select_a: str
    select_b: str
    select_c: str
    select_d: str
    next_question: str
    prev_question: str
    flag_uncertain: str
    favorite: str
    note: str
    submit: str


class KeyboardPreferencesPayloadWireV1(StrictCamelModel):
    enabled: bool
    bindings: KeyBindingsPayloadWireV1


class ReminderPreferencesPayloadWireV1(StrictCamelModel):
    daily_practice_reminder_enabled: bool
    daily_practice_reminder_time: str
    weekly_summary_reminder_enabled: bool
    overtime_threshold_seconds: int
    long_session_break_reminder_minutes: int


class CustomPracticeDefaultsPayloadWireV1(StrictCamelModel):
    last_used_source_mode: str
    last_used_year_range: str
    last_used_difficulty_range: tuple[float, float]
    last_used_count: int
    last_used_practice_mode: str
    last_used_exclude_done: bool
    last_used_only_wrong: bool


class PracticePreferencesPayloadWireV1(StrictCamelModel):
    ui: UiPreferencesPayloadWireV1
    pacing: PacingPreferencesPayloadWireV1
    auto_save: AutoSavePreferencesPayloadWireV1
    keyboard: KeyboardPreferencesPayloadWireV1
    reminders: ReminderPreferencesPayloadWireV1
    custom_practice: CustomPracticeDefaultsPayloadWireV1


class PracticePreferencesPutRequestV2(StrictCamelModel):
    schema_version: int = Field(ge=1)
    payload: PracticePreferencesPayloadWireV1


class PracticePreferencesPatchItemV2(StrictCamelModel):
    path: str = Field(min_length=1, max_length=128)
    value: object


class PracticePreferencesPatchRequestV2(StrictCamelModel):
    schema_version: int = Field(ge=1)
    patches: list[PracticePreferencesPatchItemV2] = Field(min_length=1)


class PracticePreferencesResetRequestV2(StrictCamelModel):
    sections: list[
        Literal[
            "ui",
            "pacing",
            "auto_save",
            "keyboard",
            "reminders",
            "custom_practice",
        ]
    ] = Field(default_factory=list)


class PracticePreferencesWriteResponseV2(StrictCamelModel):
    schema_version: int
    payload: PracticePreferencesPayloadV1
    updated_at: UtcDatetime | None = None
