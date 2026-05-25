from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sikao_api.db.enums_v2 import RampupPhase
from sikao_api.db.models_v2 import ProfileInfoV2
from sikao_api.modules.system.application.errors import ValidationError

REVIEW_DAILY_LIMIT_KEY = "review_daily_limit"
REVIEW_DEBT_REDISTRIBUTE_ENABLED_KEY = "review_debt_redistribute_enabled"
REVIEW_RAMPUP_ENABLED_KEY = "review_rampup_enabled"
REVIEW_HARD_QUESTION_AUTO_DEEP_ANALYSIS_KEY = "review_hard_question_auto_deep_analysis"
REVIEW_DEBT_RUNTIME_KEY = "_review_debt_runtime"

DEFAULT_REVIEW_DAILY_LIMIT = 30
DEFAULT_REVIEW_DEBT_REDISTRIBUTE_ENABLED = True
DEFAULT_REVIEW_RAMPUP_ENABLED = True
DEFAULT_REVIEW_HARD_QUESTION_AUTO_DEEP_ANALYSIS = True


@dataclass(frozen=True)
class ReviewDebtPreferences:
    daily_limit: int = DEFAULT_REVIEW_DAILY_LIMIT
    redistribute_enabled: bool = DEFAULT_REVIEW_DEBT_REDISTRIBUTE_ENABLED
    rampup_enabled: bool = DEFAULT_REVIEW_RAMPUP_ENABLED
    hard_question_auto_deep_analysis: bool = DEFAULT_REVIEW_HARD_QUESTION_AUTO_DEEP_ANALYSIS


@dataclass(frozen=True)
class ReviewRampupRuntime:
    phase: RampupPhase | None = None
    started_at: datetime | None = None
    unlock_at: datetime | None = None
    last_transition_on: date | None = None
    active: bool = False


def validate_review_dashboard_preferences(preferences: dict[str, Any]) -> None:
    if REVIEW_DAILY_LIMIT_KEY in preferences:
        daily_limit = preferences[REVIEW_DAILY_LIMIT_KEY]
        if not isinstance(daily_limit, int):
            raise ValidationError("review_daily_limit must be an integer", code="invalid_review_daily_limit")
        if not 10 <= daily_limit <= 100:
            raise ValidationError("review_daily_limit must be between 10 and 100", code="invalid_review_daily_limit")
    for key in (
        REVIEW_DEBT_REDISTRIBUTE_ENABLED_KEY,
        REVIEW_RAMPUP_ENABLED_KEY,
        REVIEW_HARD_QUESTION_AUTO_DEEP_ANALYSIS_KEY,
    ):
        if key in preferences and not isinstance(preferences[key], bool):
            raise ValidationError(f"{key} must be a boolean", code="invalid_review_dashboard_preferences")


def read_review_debt_preferences(info: ProfileInfoV2 | None) -> ReviewDebtPreferences:
    dashboard_preferences = info.dashboard_preferences if info is not None else {}
    raw = dashboard_preferences if isinstance(dashboard_preferences, dict) else {}
    daily_limit = raw.get(REVIEW_DAILY_LIMIT_KEY, DEFAULT_REVIEW_DAILY_LIMIT)
    redistribute_enabled = raw.get(
        REVIEW_DEBT_REDISTRIBUTE_ENABLED_KEY,
        DEFAULT_REVIEW_DEBT_REDISTRIBUTE_ENABLED,
    )
    rampup_enabled = raw.get(
        REVIEW_RAMPUP_ENABLED_KEY,
        DEFAULT_REVIEW_RAMPUP_ENABLED,
    )
    hard_question_auto_deep_analysis = raw.get(
        REVIEW_HARD_QUESTION_AUTO_DEEP_ANALYSIS_KEY,
        DEFAULT_REVIEW_HARD_QUESTION_AUTO_DEEP_ANALYSIS,
    )
    validated = {
        REVIEW_DAILY_LIMIT_KEY: daily_limit,
        REVIEW_DEBT_REDISTRIBUTE_ENABLED_KEY: redistribute_enabled,
        REVIEW_RAMPUP_ENABLED_KEY: rampup_enabled,
        REVIEW_HARD_QUESTION_AUTO_DEEP_ANALYSIS_KEY: hard_question_auto_deep_analysis,
    }
    validate_review_dashboard_preferences(validated)
    return ReviewDebtPreferences(
        daily_limit=daily_limit,
        redistribute_enabled=redistribute_enabled,
        rampup_enabled=rampup_enabled,
        hard_question_auto_deep_analysis=hard_question_auto_deep_analysis,
    )


def read_review_rampup_runtime(info: ProfileInfoV2 | None) -> ReviewRampupRuntime:
    recommender_preferences = info.recommender_preferences if info is not None else {}
    raw = recommender_preferences if isinstance(recommender_preferences, dict) else {}
    runtime = raw.get(REVIEW_DEBT_RUNTIME_KEY, {})
    if not isinstance(runtime, dict):
        return ReviewRampupRuntime()
    phase_raw = runtime.get("phase")
    started_at_raw = runtime.get("started_at")
    unlock_at_raw = runtime.get("unlock_at")
    active = bool(runtime.get("active", False))
    phase = None
    if isinstance(phase_raw, str) and phase_raw in {phase.value for phase in RampupPhase}:
        phase = RampupPhase(phase_raw)
    started_at = _parse_datetime(started_at_raw)
    unlock_at = _parse_datetime(unlock_at_raw)
    last_transition_on = _parse_date(runtime.get("last_transition_on"))
    return ReviewRampupRuntime(
        phase=phase,
        started_at=started_at,
        unlock_at=unlock_at,
        last_transition_on=last_transition_on,
        active=active and phase is not None,
    )


def write_review_rampup_runtime(
    info: ProfileInfoV2,
    *,
    phase: RampupPhase | None,
    started_at: datetime | None,
    unlock_at: datetime | None,
    last_transition_on: date | None = None,
) -> None:
    recommender_preferences = dict(info.recommender_preferences or {})
    if phase is None:
        recommender_preferences.pop(REVIEW_DEBT_RUNTIME_KEY, None)
    else:
        recommender_preferences[REVIEW_DEBT_RUNTIME_KEY] = {
            "phase": phase.value,
            "started_at": started_at.isoformat() if started_at is not None else None,
            "unlock_at": unlock_at.isoformat() if unlock_at is not None else None,
            "last_transition_on": last_transition_on.isoformat() if last_transition_on is not None else None,
            "active": True,
        }
    info.recommender_preferences = recommender_preferences


def _parse_datetime(value: object) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _parse_date(value: object) -> date | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None
