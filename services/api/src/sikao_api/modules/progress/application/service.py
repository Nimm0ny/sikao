from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import (
    DashboardProgressSummaryV2,
    DashboardProgressResponseV2,
    ProgressDiagnosisResponseV2,
    ProgressTimeseriesPointV2,
    ProgressTimeseriesResponseV2,
    ProgressWeaknessResponseV2,
)
from sikao_api.modules.progress.application.aggregates import (
    build_metric_bucket,
    build_subject_accuracies,
    build_weakness_items,
    day_bounds_cn,
    load_answers,
    load_sessions,
    today_cn,
    week_bounds_cn,
)
from sikao_api.modules.progress.application.dashboard_support import build_diagnosis, build_plan_slice, list_exam_targets, load_active_plan
from sikao_api.modules.progress.application.snapshot_store import load_latest_weakness_snapshot, load_or_compute_progress_snapshot
from sikao_api.modules.system.application.errors import ValidationError


def build_progress_overview(
    session: Session,
    *,
    user: UserV2,
    plan_id: int | None,
) -> DashboardProgressResponseV2:
    sessions = load_sessions(session, user_id=user.id)
    answers = load_answers(session, user_id=user.id)
    today = today_cn()
    today_start, today_end = day_bounds_cn(today)
    week_start, week_end = week_bounds_cn(today)
    week_range_start, _ = day_bounds_cn(week_start)
    _, week_range_end = day_bounds_cn(week_end)
    active_plan = load_active_plan(session, user_id=user.id)
    exam_targets = list_exam_targets(session, user=user, active_plan=active_plan)
    live_weakness = build_weakness_items(answers=answers, anchor_day=today)
    weakness_items = load_latest_weakness_snapshot(session, user_id=user.id) or live_weakness
    recent_subject_start, _ = day_bounds_cn(today - timedelta(days=29))
    return DashboardProgressResponseV2(
        summary=DashboardProgressSummaryV2(
            today=build_metric_bucket(
                sessions=sessions,
                answers=answers,
                range_start=today_start,
                range_end=today_end,
            ),
            week=build_metric_bucket(
                sessions=sessions,
                answers=answers,
                range_start=week_range_start,
                range_end=week_range_end,
            ),
            all_time=build_metric_bucket(
                sessions=sessions,
                answers=answers,
                range_start=None,
                range_end=None,
            ),
            plan_slice=build_plan_slice(session, user=user, plan_id=plan_id),
        ),
        weakness_top3=weakness_items[:3],
        subject_accuracies=build_subject_accuracies(
            answers=answers,
            range_start=recent_subject_start,
            range_end=None,
        ),
        nearest_exam_target=exam_targets[0] if exam_targets else None,
    )


def build_progress_timeseries(
    session: Session,
    *,
    user: UserV2,
    from_date: date,
    to_date: date,
    granularity: str,
) -> ProgressTimeseriesResponseV2:
    if to_date < from_date:
        raise ValidationError("to must be >= from", code="invalid_timeseries_window")
    if granularity not in {"day", "week"}:
        raise ValidationError("granularity must be one of day|week", code="invalid_timeseries_window")
    if granularity == "day" and (to_date - from_date).days > 89:
        raise ValidationError("day granularity cannot exceed 90 days", code="invalid_timeseries_window")
    if granularity == "week" and (to_date - from_date).days > 364:
        raise ValidationError("week granularity cannot exceed 52 weeks", code="invalid_timeseries_window")
    sessions = load_sessions(session, user_id=user.id)
    answers = load_answers(session, user_id=user.id)
    if granularity == "day":
        points = [
            _build_day_point(
                session,
                user_id=user.id,
                sessions=sessions,
                answers=answers,
                day=item,
            )
            for item in _iter_days(from_date, to_date)
        ]
    else:
        points = _build_week_points(
            session,
            user_id=user.id,
            sessions=sessions,
            answers=answers,
            from_date=from_date,
            to_date=to_date,
        )
    return ProgressTimeseriesResponseV2.model_validate(
        {
            "from": from_date,
            "to": to_date,
            "granularity": granularity,
            "points": [point.model_dump(mode="json") for point in points],
        }
    )


def build_progress_weakness(session: Session, *, user: UserV2) -> ProgressWeaknessResponseV2:
    items = load_latest_weakness_snapshot(session, user_id=user.id)
    if items:
        return ProgressWeaknessResponseV2(items=items)
    return ProgressWeaknessResponseV2(
        items=build_weakness_items(
            answers=load_answers(session, user_id=user.id),
            anchor_day=today_cn(),
        )
    )


def build_progress_diagnosis(session: Session, *, user: UserV2) -> ProgressDiagnosisResponseV2:
    answers = load_answers(session, user_id=user.id)
    weakness_items = load_latest_weakness_snapshot(session, user_id=user.id)
    if not weakness_items:
        weakness_items = build_weakness_items(answers=answers, anchor_day=today_cn())
    return build_diagnosis(session, user=user, weakness_items=weakness_items)


def _build_day_point(
    session: Session,
    *,
    user_id: int,
    sessions: list[Any],
    answers: list[Any],
    day: date,
) -> ProgressTimeseriesPointV2:
    bucket = load_or_compute_progress_snapshot(
        session,
        user_id=user_id,
        snapshot_date=day,
        sessions=sessions,
        answers=answers,
    )
    return ProgressTimeseriesPointV2(
        bucket_start=day,
        bucket_end=day,
        minutes_practiced=bucket.minutes_practiced,
        items_answered=bucket.items_answered,
        accuracy=bucket.accuracy,
        sessions_count=bucket.sessions_count,
    )


def _build_week_points(
    session: Session,
    *,
    user_id: int,
    sessions: list[Any],
    answers: list[Any],
    from_date: date,
    to_date: date,
) -> list[ProgressTimeseriesPointV2]:
    points: list[ProgressTimeseriesPointV2] = []
    current_start, current_end = week_bounds_cn(from_date)
    while current_start <= to_date:
        bucket_end = min(current_end, to_date)
        range_start, _ = day_bounds_cn(current_start)
        _, range_end = day_bounds_cn(bucket_end)
        bucket = build_metric_bucket(
            sessions=sessions,
            answers=answers,
            range_start=range_start,
            range_end=range_end,
        )
        points.append(
            ProgressTimeseriesPointV2(
                bucket_start=current_start,
                bucket_end=bucket_end,
                minutes_practiced=bucket.minutes_practiced,
                items_answered=bucket.items_answered,
                accuracy=bucket.accuracy,
                sessions_count=bucket.sessions_count,
            )
        )
        current_start = bucket_end + timedelta(days=1)
        current_end = current_start + timedelta(days=6)
    return points


def _iter_days(start: date, end: date) -> list[date]:
    days: list[date] = []
    current = start
    while current <= end:
        days.append(current)
        current += timedelta(days=1)
    return days
