"""PR-6 MVP: progress dashboard aggregation service.

Weekly progress summary (GET /api/v2/progress/weekly):
  - xingce questions answered + accuracy for the current week
  - essay grading submissions in the current week
  - study plan tasks completed / total for the current week
  - current streak_days (reuses PredictedScore logic)

Accuracy trend (GET /api/v2/progress/accuracy-trend?days=7|30|90):
  - Per-day accuracy and answer count for the last N days
  - Days with zero activity produce a point with accuracy=0 and answered=0
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from sikao_api.db import schemas
from sikao_api.db.models import (
    EssayGradingRecord,
    PracticeSessionAnswer,
    StudyPlan,
    StudyPlanTask,
)

_VALID_TREND_DAYS = (7, 30, 90, 180)


def _week_bounds(today: date) -> tuple[date, date]:
    start = today - timedelta(days=today.weekday())
    return start, start + timedelta(days=6)


def _grouped_day(value: object) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value)
    return None


def get_weekly_progress(db: Session, *, user_id: int) -> schemas.WeeklyProgressSummaryV2:
    today = datetime.now(timezone.utc).date()
    week_start, week_end = _week_bounds(today)
    week_start_dt = datetime(week_start.year, week_start.month, week_start.day, tzinfo=timezone.utc)
    week_end_dt = datetime(week_end.year, week_end.month, week_end.day, 23, 59, 59, tzinfo=timezone.utc)

    xingce_rows = db.execute(
        select(
            func.count(PracticeSessionAnswer.id).label("answered"),
            func.coalesce(
                func.sum(case((PracticeSessionAnswer.is_correct.is_(True), 1), else_=0)),
                0,
            ).label("correct"),
        ).where(
            PracticeSessionAnswer.session.has(user_id=user_id),
            PracticeSessionAnswer.answered_at >= week_start_dt,
            PracticeSessionAnswer.answered_at <= week_end_dt,
        )
    ).one()

    xingce_answered = xingce_rows.answered or 0
    xingce_correct = xingce_rows.correct or 0
    xingce_accuracy = round((xingce_correct / xingce_answered) * 100, 1) if xingce_answered else 0.0

    essay_submitted = db.scalar(
        select(func.count(EssayGradingRecord.id)).where(
            EssayGradingRecord.user_id == user_id,
            EssayGradingRecord.created_at >= week_start_dt,
            EssayGradingRecord.created_at <= week_end_dt,
        )
    ) or 0

    task_rows = db.execute(
        select(
            func.count(StudyPlanTask.id).label("total"),
            func.coalesce(
                func.sum(case((StudyPlanTask.status == "completed", 1), else_=0)),
                0,
            ).label("completed"),
        ).where(
            StudyPlanTask.plan.has(user_id=user_id),
            StudyPlanTask.created_at >= week_start_dt,
            StudyPlanTask.created_at <= week_end_dt,
        )
    ).one()

    tasks_total = task_rows.total or 0
    tasks_completed = task_rows.completed or 0

    streak_days = _compute_streak(db, user_id=user_id, today=today)

    return schemas.WeeklyProgressSummaryV2(
        week_start=week_start,
        week_end=week_end,
        xingce_answered=xingce_answered,
        xingce_accuracy=xingce_accuracy,
        essay_submitted=essay_submitted,
        tasks_completed=tasks_completed,
        tasks_total=tasks_total,
        streak_days=streak_days,
    )


def _compute_streak(db: Session, *, user_id: int, today: date) -> int:
    rows = db.scalars(
        select(func.date(PracticeSessionAnswer.answered_at).label("d"))
        .where(PracticeSessionAnswer.session.has(user_id=user_id))
        .group_by(func.date(PracticeSessionAnswer.answered_at))
        .order_by(func.date(PracticeSessionAnswer.answered_at).desc())
        .limit(180)
    ).all()

    active_dates = {
        grouped_day for raw_day in rows if (grouped_day := _grouped_day(raw_day)) is not None
    }
    streak = 0
    cursor = today
    while cursor in active_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def get_accuracy_trend(
    db: Session, *, user_id: int, days: int
) -> schemas.AccuracyTrendResponseV2:
    if days not in _VALID_TREND_DAYS:
        raise ValueError(f"days must be one of {_VALID_TREND_DAYS}")

    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)
    start_dt = datetime(start.year, start.month, start.day, tzinfo=timezone.utc)

    rows = db.execute(
        select(
            func.date(PracticeSessionAnswer.answered_at).label("d"),
            func.count(PracticeSessionAnswer.id).label("answered"),
            func.coalesce(
                func.sum(case((PracticeSessionAnswer.is_correct.is_(True), 1), else_=0)),
                0,
            ).label("correct"),
        ).where(
            PracticeSessionAnswer.session.has(user_id=user_id),
            PracticeSessionAnswer.answered_at >= start_dt,
        ).group_by(func.date(PracticeSessionAnswer.answered_at))
    ).all()

    by_date: dict[date, tuple[int, int]] = {}
    for row in rows:
        grouped_day = _grouped_day(row.d)
        if grouped_day is None:
            continue
        by_date[grouped_day] = (row.answered or 0, row.correct or 0)

    points: list[schemas.AccuracyTrendPointV2] = []
    for i in range(days):
        d = start + timedelta(days=i)
        answered, correct = by_date.get(d, (0, 0))
        accuracy = round((correct / answered) * 100, 1) if answered else 0.0
        points.append(schemas.AccuracyTrendPointV2(date=d, accuracy=accuracy, answered=answered))

    return schemas.AccuracyTrendResponseV2(days=days, points=points)
