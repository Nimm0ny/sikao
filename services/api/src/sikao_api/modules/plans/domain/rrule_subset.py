from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from dateutil.parser import isoparse  # type: ignore[import-untyped]
from dateutil.rrule import rrulestr  # type: ignore[import-untyped]

from sikao_api.modules.system.application.errors import ValidationError

_ALLOWED_KEYS = {"FREQ", "INTERVAL", "COUNT", "UNTIL", "BYDAY", "BYMONTHDAY"}
_ALLOWED_FREQS = {"DAILY", "WEEKLY", "MONTHLY"}
_ALLOWED_DAYS = {"MO", "TU", "WE", "TH", "FR", "SA", "SU"}


def validate_rrule_subset(rule: str) -> None:
    if not rule:
        raise ValidationError("recurring rule is required", code="bad_recurring_rule")
    parts = _parse_rule_parts(rule)
    freq = parts.get("FREQ")
    if freq not in _ALLOWED_FREQS:
        raise ValidationError("unsupported recurring frequency", code="bad_recurring_rule")
    if "INTERVAL" in parts:
        interval = _parse_int(parts["INTERVAL"], key="INTERVAL")
        if interval < 1 or interval > 99:
            raise ValidationError("INTERVAL must be between 1 and 99", code="bad_recurring_rule")
    if "COUNT" in parts:
        count = _parse_int(parts["COUNT"], key="COUNT")
        if count < 1 or count > 365:
            raise ValidationError("COUNT must be between 1 and 365", code="bad_recurring_rule")
    if "UNTIL" in parts:
        _parse_until(parts["UNTIL"])
    if "BYDAY" in parts:
        days = parts["BYDAY"].split(",")
        if not days or any(day not in _ALLOWED_DAYS for day in days):
            raise ValidationError("BYDAY contains unsupported values", code="bad_recurring_rule")
    if "BYMONTHDAY" in parts:
        month_days = [_parse_int(item, key="BYMONTHDAY") for item in parts["BYMONTHDAY"].split(",")]
        if not month_days or any(item == 0 or item < -1 or item > 31 for item in month_days):
            raise ValidationError("BYMONTHDAY contains unsupported values", code="bad_recurring_rule")
    try:
        rrulestr(rule, dtstart=datetime(2026, 1, 1, 9, 0, 0))
    except Exception as exc:  # noqa: BLE001
        raise ValidationError("recurring rule failed to parse", code="bad_recurring_rule") from exc


def expand_occurrences(
    *,
    rule: str,
    dtstart: datetime,
    range_start: datetime,
    range_end: datetime,
) -> list[datetime]:
    validate_rrule_subset(rule)
    schedule = rrulestr(rule, dtstart=dtstart)
    return list(schedule.between(range_start, range_end, inc=True))


def build_occurrence_ref(*, parent_id: int, occurrence_start: datetime, timezone: str) -> str:
    zone = ZoneInfo(timezone)
    local_date = occurrence_start.replace(tzinfo=UTC).astimezone(zone).date()
    return f"{parent_id}:{local_date.isoformat()}"


def parse_occurrence_ref(ref: str) -> tuple[int, date]:
    try:
        parent_raw, day_raw = ref.split(":", 1)
        return int(parent_raw), isoparse(day_raw).date()
    except Exception as exc:  # noqa: BLE001
        raise ValidationError("invalid recurring occurrence ref", code="invalid_recurring_occurrence_ref") from exc


def start_of_local_day(day: date, *, timezone: str) -> datetime:
    zone = ZoneInfo(timezone)
    return _to_naive_utc(datetime.combine(day, time.min, tzinfo=zone))


def end_of_local_day(day: date, *, timezone: str) -> datetime:
    zone = ZoneInfo(timezone)
    return _to_naive_utc(datetime.combine(day + timedelta(days=1), time.min, tzinfo=zone))


def truncate_rule_until(*, rule: str, cutoff: datetime) -> str:
    parts = _parse_rule_parts(rule)
    parts.pop("COUNT", None)
    parts["UNTIL"] = cutoff.strftime("%Y%m%dT%H%M%S")
    ordered_keys = ["FREQ", "INTERVAL", "COUNT", "UNTIL", "BYDAY", "BYMONTHDAY"]
    return ";".join(f"{key}={parts[key]}" for key in ordered_keys if key in parts)


def build_future_rule(*, rule: str, dtstart: datetime, split_start: datetime) -> str:
    parts = _parse_rule_parts(rule)
    if "COUNT" not in parts:
        return rule
    schedule = rrulestr(rule, dtstart=dtstart)
    requested = _parse_int(parts["COUNT"], key="COUNT")
    remaining_occurrences = list(schedule.xafter(split_start, count=requested, inc=True))
    remaining_count = len(remaining_occurrences)
    if remaining_count < 1:
        raise ValidationError("future split produced no remaining recurring occurrences", code="invalid_event_scope")
    parts["COUNT"] = str(remaining_count)
    ordered_keys = ["FREQ", "INTERVAL", "COUNT", "UNTIL", "BYDAY", "BYMONTHDAY"]
    return ";".join(f"{key}={parts[key]}" for key in ordered_keys if key in parts)


def _parse_rule_parts(rule: str) -> dict[str, str]:
    parts: dict[str, str] = {}
    for raw_part in rule.split(";"):
        if not raw_part or "=" not in raw_part:
            raise ValidationError("invalid recurring rule segment", code="bad_recurring_rule")
        key, value = raw_part.split("=", 1)
        if key not in _ALLOWED_KEYS:
            raise ValidationError("unsupported recurring rule component", code="bad_recurring_rule")
        parts[key] = value
    if "FREQ" not in parts:
        raise ValidationError("FREQ is required", code="bad_recurring_rule")
    return parts


def _parse_int(value: str, *, key: str) -> int:
    try:
        return int(value)
    except ValueError as exc:
        raise ValidationError(f"{key} must be an integer", code="bad_recurring_rule") from exc


def _parse_until(value: str) -> datetime:
    try:
        if value.endswith("Z") and "T" in value:
            return datetime.strptime(value, "%Y%m%dT%H%M%SZ")
        if len(value) == 8 and value.isdigit():
            return datetime.strptime(value, "%Y%m%d")
        return isoparse(value).replace(tzinfo=None)
    except ValueError as exc:
        raise ValidationError("UNTIL must be a valid UTC datetime or date", code="bad_recurring_rule") from exc


def _to_naive_utc(value: datetime) -> datetime:
    return value.astimezone(UTC).replace(tzinfo=None)
