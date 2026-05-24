from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from sikao_api.modules.progress.application.aggregates import CN_TIME_OFFSET, day_bounds_cn, to_cn_date, week_bounds_cn


def iso_week_code_from_date(value: date) -> str:
    iso_year, iso_week, _ = value.isocalendar()
    return f"{iso_year:04d}-{iso_week:02d}"


def parse_iso_week_code(value: str) -> date:
    try:
        year_text, week_text = value.split("-", 1)
        year = int(year_text)
        week = int(week_text)
    except ValueError as exc:
        raise ValueError("week must use YYYY-WW format") from exc
    return date.fromisocalendar(year, week, 1)


def week_bounds_utc_from_cn_week_start(week_start: date) -> tuple[datetime, datetime]:
    start = datetime.combine(week_start, datetime.min.time()).replace(tzinfo=UTC) - CN_TIME_OFFSET
    end = start + timedelta(days=7)
    return start.replace(tzinfo=None), end.replace(tzinfo=None)


def current_cn_date() -> date:
    return (datetime.now(UTC) + CN_TIME_OFFSET).date()


def previous_week_start(anchor_day: date | None = None) -> date:
    current_day = anchor_day or current_cn_date()
    this_week_start, _ = week_bounds_cn(current_day)
    return this_week_start - timedelta(days=7)


def trailing_90_day_start(anchor_day: date | None = None) -> date:
    current_day = anchor_day or current_cn_date()
    return current_day - timedelta(days=89)


__all__ = [
    "current_cn_date",
    "day_bounds_cn",
    "iso_week_code_from_date",
    "parse_iso_week_code",
    "previous_week_start",
    "to_cn_date",
    "trailing_90_day_start",
    "week_bounds_cn",
    "week_bounds_utc_from_cn_week_start",
]

