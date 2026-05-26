from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import ProgressSnapshotV2, WeaknessSnapshotV2
from sikao_api.db.schemas_v2 import ProgressMetricBucketV2, WeaknessItemV2
from sikao_api.modules.progress.application.aggregates import (
    build_metric_bucket,
    build_weakness_items,
    day_bounds_cn,
    load_answers,
    load_sessions,
    normalize_subject_label,
    today_cn,
)

SNAPSHOT_ACCURACY_KEY = "accuracy"


def decimal_from_payload(value: Any) -> Decimal | None:
    if value is None:
        return None
    return Decimal(str(value)).quantize(Decimal("0.01"))


def serialize_metric_bucket(bucket: ProgressMetricBucketV2) -> dict[str, Any]:
    return {
        "minutesPracticed": bucket.minutes_practiced,
        "itemsAnswered": bucket.items_answered,
        "accuracy": str(bucket.accuracy) if bucket.accuracy is not None else None,
        "sessionsCount": bucket.sessions_count,
    }


def parse_metric_bucket(payload: dict[str, Any]) -> ProgressMetricBucketV2:
    return ProgressMetricBucketV2(
        minutes_practiced=int(payload.get("minutesPracticed", 0)),
        items_answered=int(payload.get("itemsAnswered", 0)),
        accuracy=decimal_from_payload(payload.get(SNAPSHOT_ACCURACY_KEY)),
        sessions_count=int(payload.get("sessionsCount", 0)),
    )


def load_latest_weakness_snapshot(session: Session, *, user_id: int) -> list[WeaknessItemV2]:
    snapshot_date = session.scalar(
        select(func.max(WeaknessSnapshotV2.snapshot_date)).where(WeaknessSnapshotV2.user_id == user_id)
    )
    if snapshot_date is None:
        return []
    rows = list(
        session.scalars(
            select(WeaknessSnapshotV2)
            .where(
                WeaknessSnapshotV2.user_id == user_id,
                WeaknessSnapshotV2.snapshot_date == snapshot_date,
            )
            .order_by(WeaknessSnapshotV2.subject_key.asc())
        )
    )
    return [
        WeaknessItemV2(
            subject_key=row.subject_key,
            subject_label=str(row.data_json.get("subjectLabel", normalize_subject_label(row.subject_key))),
            answered=int(row.data_json.get("answered", 0)),
            correct=int(row.data_json.get("correct", 0)),
            accuracy=decimal_from_payload(row.data_json.get(SNAPSHOT_ACCURACY_KEY)),
            severity=row.severity,
            trend=str(row.data_json.get("trend", "stable")),
        )
        for row in rows
    ]


def load_or_compute_progress_snapshot(
    session: Session,
    *,
    user_id: int,
    snapshot_date: date,
    sessions: list[Any],
    answers: list[Any],
) -> ProgressMetricBucketV2:
    if snapshot_date == today_cn():
        range_start, range_end = day_bounds_cn(snapshot_date)
        return build_metric_bucket(
            sessions=sessions,
            answers=answers,
            range_start=range_start,
            range_end=range_end,
        )
    stored = session.scalar(
        select(ProgressSnapshotV2).where(
            ProgressSnapshotV2.user_id == user_id,
            ProgressSnapshotV2.snapshot_date == snapshot_date,
        )
    )
    if stored is not None:
        return parse_metric_bucket(stored.data_json)
    range_start, range_end = day_bounds_cn(snapshot_date)
    return build_metric_bucket(
        sessions=sessions,
        answers=answers,
        range_start=range_start,
        range_end=range_end,
    )


def write_progress_snapshot(
    session: Session,
    *,
    user_id: int,
    snapshot_date: date,
) -> ProgressSnapshotV2:
    sessions = load_sessions(session, user_id=user_id)
    answers = load_answers(session, user_id=user_id)
    range_start, range_end = day_bounds_cn(snapshot_date)
    bucket = build_metric_bucket(
        sessions=sessions,
        answers=answers,
        range_start=range_start,
        range_end=range_end,
    )
    row = session.scalar(
        select(ProgressSnapshotV2).where(
            ProgressSnapshotV2.user_id == user_id,
            ProgressSnapshotV2.snapshot_date == snapshot_date,
        )
    )
    if row is None:
        row = ProgressSnapshotV2(user_id=user_id, snapshot_date=snapshot_date, data_json={})
    row.data_json = serialize_metric_bucket(bucket)
    session.add(row)
    session.flush()
    return row


def write_weekly_weakness_snapshot(
    session: Session,
    *,
    user_id: int,
    anchor_date: date,
) -> list[WeaknessSnapshotV2]:
    answers = load_answers(session, user_id=user_id)
    items = build_weakness_items(answers=answers, anchor_day=anchor_date)
    snapshot_monday = anchor_date - date.resolution * anchor_date.weekday()
    session.execute(
        delete(WeaknessSnapshotV2).where(
            WeaknessSnapshotV2.user_id == user_id,
            WeaknessSnapshotV2.snapshot_date == snapshot_monday,
        )
    )
    rows: list[WeaknessSnapshotV2] = []
    for item in items:
        row = WeaknessSnapshotV2(
            user_id=user_id,
            snapshot_date=snapshot_monday,
            subject_key=item.subject_key,
            severity=item.severity,
            data_json={
                "subjectLabel": item.subject_label,
                "answered": item.answered,
                "correct": item.correct,
                SNAPSHOT_ACCURACY_KEY: str(item.accuracy) if item.accuracy is not None else None,
                "trend": item.trend,
            },
        )
        session.add(row)
        rows.append(row)
    session.flush()
    return rows
