from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import EssayReportV2, EssaySubmissionV2, PracticeSessionAnswerV2, PracticeSessionV2, QuestionV2
from sikao_api.db.schemas_v2 import ProgressMetricBucketV2, SubjectAccuracyV2, WeaknessItemV2

CN_TIME_OFFSET = timedelta(hours=8)


@dataclass(frozen=True)
class AnswerFact:
    session_id: int
    answered_at: datetime
    is_correct: bool | None
    question_key: str
    response_json: dict[str, Any]
    subject_key: str | None


def now_utc() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def today_cn() -> date:
    return (datetime.now(UTC) + CN_TIME_OFFSET).date()


def to_cn_date(value: datetime) -> date:
    return (value.replace(tzinfo=UTC) + CN_TIME_OFFSET).date()


def day_bounds_cn(target_date: date) -> tuple[datetime, datetime]:
    start = datetime.combine(target_date, datetime.min.time()).replace(tzinfo=UTC) - CN_TIME_OFFSET
    end = start + timedelta(days=1)
    return start.replace(tzinfo=None), end.replace(tzinfo=None)


def week_bounds_cn(anchor_date: date) -> tuple[date, date]:
    week_start = anchor_date - timedelta(days=anchor_date.weekday())
    return week_start, week_start + timedelta(days=6)


def month_bounds_cn(anchor_date: date) -> tuple[date, date]:
    month_start = anchor_date.replace(day=1)
    if month_start.month == 12:
        next_month = month_start.replace(year=month_start.year + 1, month=1)
    else:
        next_month = month_start.replace(month=month_start.month + 1)
    return month_start, next_month - timedelta(days=1)


def normalize_subject_label(subject_key: str) -> str:
    labels = {
        "yanyu": "言语",
        "panduan": "判断",
        "shuliang": "数量",
        "ziliao": "资料",
        "changshi": "常识",
        "essay": "申论",
        "xingce": "行测",
        "language": "言语",
        "judgment": "判断",
    }
    return labels.get(subject_key, subject_key)


def quantize_ratio(numerator: int, denominator: int) -> Decimal | None:
    if denominator <= 0:
        return None
    return (Decimal(numerator) / Decimal(denominator)).quantize(Decimal("0.01"))


def _has_meaningful_answer(payload: Any) -> bool:
    if payload is None:
        return False
    if isinstance(payload, str):
        return payload.strip() != ""
    if isinstance(payload, dict):
        return any(_has_meaningful_answer(item) for item in payload.values())
    if isinstance(payload, list):
        return any(_has_meaningful_answer(item) for item in payload)
    return True


def _in_window(value: datetime, *, range_start: datetime | None, range_end: datetime | None) -> bool:
    if range_start is not None and value < range_start:
        return False
    if range_end is not None and value >= range_end:
        return False
    return True


def _duration_minutes_within_window(
    *,
    started_at: datetime,
    ended_at: datetime,
    range_start: datetime | None,
    range_end: datetime | None,
) -> int:
    if range_start is None or range_end is None:
        return max(0, int((ended_at - started_at).total_seconds() // 60))
    overlap_start = max(started_at, range_start)
    overlap_end = min(ended_at, range_end)
    if overlap_end <= overlap_start:
        return 0
    return int((overlap_end - overlap_start).total_seconds() // 60)


def _build_answered_session_lookup(*, answers: list[AnswerFact]) -> set[int]:
    return {
        row.session_id
        for row in answers
        if _has_meaningful_answer(row.response_json)
    }


def load_sessions(session: Session, *, user_id: int) -> list[PracticeSessionV2]:
    return list(
        session.scalars(
            select(PracticeSessionV2)
            .where(PracticeSessionV2.user_id == user_id)
            .order_by(PracticeSessionV2.started_at.asc(), PracticeSessionV2.id.asc())
        )
    )


def load_answers(session: Session, *, user_id: int) -> list[AnswerFact]:
    rows = session.execute(
        select(PracticeSessionAnswerV2, QuestionV2.subject_kind)
        .join(PracticeSessionV2, PracticeSessionV2.id == PracticeSessionAnswerV2.session_id)
        .outerjoin(QuestionV2, QuestionV2.id == PracticeSessionAnswerV2.question_id)
        .where(PracticeSessionV2.user_id == user_id)
    ).all()
    return [
        AnswerFact(
            session_id=answer.session_id,
            answered_at=answer.answered_at,
            is_correct=answer.is_correct,
            question_key=answer.question_key,
            response_json=answer.response_json,
            subject_key=subject_key,
        )
        for answer, subject_key in rows
    ]


def load_essay_rows(
    session: Session,
    *,
    user_id: int,
) -> list[tuple[EssaySubmissionV2, EssayReportV2 | None]]:
    rows = session.execute(
        select(EssaySubmissionV2, EssayReportV2)
        .outerjoin(EssayReportV2, EssayReportV2.submission_id == EssaySubmissionV2.id)
        .where(EssaySubmissionV2.user_id == user_id)
        .order_by(EssaySubmissionV2.submitted_at.asc(), EssaySubmissionV2.id.asc())
    ).all()
    return [(submission, report) for submission, report in rows]


def build_metric_bucket(
    *,
    sessions: list[PracticeSessionV2],
    answers: list[AnswerFact],
    range_start: datetime | None,
    range_end: datetime | None,
    current_time: datetime | None = None,
) -> ProgressMetricBucketV2:
    runtime_now = current_time or now_utc()
    answered_lookup = _build_answered_session_lookup(answers=answers)
    minutes_practiced = 0
    session_count = 0
    for row in sessions:
        if row.submitted_at is None and row.id not in answered_lookup:
            continue
        block_end = row.submitted_at or runtime_now
        duration_minutes = _duration_minutes_within_window(
            started_at=row.started_at,
            ended_at=block_end,
            range_start=range_start,
            range_end=range_end,
        )
        if duration_minutes <= 0:
            continue
        minutes_practiced += duration_minutes
        session_count += 1

    answered_rows = [
        row
        for row in answers
        if _has_meaningful_answer(row.response_json)
        and _in_window(row.answered_at, range_start=range_start, range_end=range_end)
    ]
    graded_rows = [row for row in answered_rows if row.is_correct is not None]
    correct_answers = sum(1 for row in graded_rows if row.is_correct is True)
    return ProgressMetricBucketV2(
        minutes_practiced=minutes_practiced,
        items_answered=len(answered_rows),
        accuracy=quantize_ratio(correct_answers, len(graded_rows)),
        sessions_count=session_count,
    )


def build_subject_accuracies(
    *,
    answers: list[AnswerFact],
    range_start: datetime | None,
    range_end: datetime | None,
) -> list[SubjectAccuracyV2]:
    buckets: dict[str, dict[str, int]] = defaultdict(lambda: {"answered": 0, "correct": 0})
    for row in answers:
        if row.subject_key is None or row.is_correct is None:
            continue
        if not _in_window(row.answered_at, range_start=range_start, range_end=range_end):
            continue
        if not _has_meaningful_answer(row.response_json):
            continue
        bucket = buckets[row.subject_key]
        bucket["answered"] += 1
        if row.is_correct is True:
            bucket["correct"] += 1
    items = [
        SubjectAccuracyV2(
            subject_key=subject_key,
            subject_label=normalize_subject_label(subject_key),
            answered=payload["answered"],
            correct=payload["correct"],
            accuracy=quantize_ratio(payload["correct"], payload["answered"]),
        )
        for subject_key, payload in buckets.items()
    ]
    return sorted(items, key=lambda item: (-item.answered, item.subject_key))


def build_weakness_items(
    *,
    answers: list[AnswerFact],
    anchor_day: date,
) -> list[WeaknessItemV2]:
    current_start, _ = day_bounds_cn(anchor_day - timedelta(days=6))
    current_end = day_bounds_cn(anchor_day)[1]
    previous_start, previous_end = day_bounds_cn(anchor_day - timedelta(days=13))
    current_subjects = build_subject_accuracies(
        answers=answers,
        range_start=current_start,
        range_end=current_end,
    )
    previous_subjects = {
        item.subject_key: item
        for item in build_subject_accuracies(
            answers=answers,
            range_start=previous_start,
            range_end=current_start,
        )
    }
    weakness_items: list[WeaknessItemV2] = []
    for item in current_subjects:
        previous = previous_subjects.get(item.subject_key)
        delta = Decimal("0.00")
        if previous is not None and item.accuracy is not None and previous.accuracy is not None:
            delta = item.accuracy - previous.accuracy
        if item.answered >= 20 and (item.accuracy or Decimal("1.00")) < Decimal("0.55"):
            severity = "high"
        elif item.answered >= 8 and (item.accuracy or Decimal("1.00")) < Decimal("0.70"):
            severity = "medium"
        else:
            severity = "low"
        trend = "stable"
        if delta <= Decimal("-0.05"):
            trend = "declining"
        elif delta >= Decimal("0.05"):
            trend = "improving"
        weakness_items.append(
            WeaknessItemV2(
                subject_key=item.subject_key,
                subject_label=item.subject_label,
                answered=item.answered,
                correct=item.correct,
                accuracy=item.accuracy,
                severity=severity,
                trend=trend,
            )
        )
    return sorted(
        weakness_items,
        key=lambda item: (
            item.accuracy if item.accuracy is not None else Decimal("1.00"),
            -item.answered,
            item.subject_key,
        ),
    )
