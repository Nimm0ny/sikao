from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import EssayReportV2, EssaySubmissionV2, PracticeSessionV2, UserV2
from sikao_api.db.schemas_v2 import (
    ActionLinkV2,
    DashboardRecordsResponseV2,
    LearningRecordItemV2,
    LearningRecordSummaryV2,
    SectionCardV2,
)

XINGCE_RECORD_KIND = "xingce_practice"
XINGCE_RECORD_TITLE = "Xingce practice"
ESSAY_RECORD_KIND = "essay_submission"
ESSAY_RECORD_TITLE = "Essay submission"
RECORD_STATUS_PENDING = "pending"
RECORD_STATUS_COMPLETED = "completed"
RECORD_STATUS_FAILED = "failed"


@dataclass(frozen=True)
class LearningRecordAggregateItem:
    id: str
    kind: str
    title: str
    status: str
    occurred_at: datetime
    score: Decimal | None = None
    is_completed: bool = False


@dataclass(frozen=True)
class LearningRecordAggregate:
    items: list[LearningRecordAggregateItem]
    total_attempts: int
    xingce_attempts: int
    essay_attempts: int
    completed_attempts: int
    avg_essay_score: Decimal | None


def build_learning_record_summary(session: Session, *, user: UserV2) -> LearningRecordSummaryV2:
    aggregate = collect_learning_record_aggregate(session, user=user)
    return LearningRecordSummaryV2(
        total_attempts=aggregate.total_attempts,
        xingce_attempts=aggregate.xingce_attempts,
        essay_attempts=aggregate.essay_attempts,
        completed_attempts=aggregate.completed_attempts,
        avg_xingce_accuracy=Decimal("0.00"),
        avg_essay_score=aggregate.avg_essay_score,
    )


def list_learning_records(session: Session, *, user: UserV2) -> list[LearningRecordItemV2]:
    aggregate = collect_learning_record_aggregate(session, user=user)
    return to_learning_record_items(aggregate.items)


def build_dashboard_records(session: Session, *, user: UserV2) -> DashboardRecordsResponseV2:
    aggregate = collect_learning_record_aggregate(session, user=user)
    items = to_learning_record_items(aggregate.items)
    return DashboardRecordsResponseV2(
        summary=LearningRecordSummaryV2(
            total_attempts=aggregate.total_attempts,
            xingce_attempts=aggregate.xingce_attempts,
            essay_attempts=aggregate.essay_attempts,
            completed_attempts=aggregate.completed_attempts,
            avg_xingce_accuracy=Decimal("0.00"),
            avg_essay_score=aggregate.avg_essay_score,
        ),
        sections=[
            SectionCardV2(
                key="records",
                title="学习记录",
                description="Phase 1 learning records skeleton.",
                status="empty" if aggregate.total_attempts == 0 else "partial",
                href="/dashboard/records",
            )
        ],
        actions=[ActionLinkV2(key="records", label="学习记录", href="/dashboard/records")],
        items=items,
        total=aggregate.total_attempts,
        page=1,
        page_size=20,
    )


def collect_learning_record_aggregate(session: Session, *, user: UserV2) -> LearningRecordAggregate:
    xingce_records = load_xingce_records(session, user_id=user.id)
    essay_records, scored_essay_values = load_essay_records(session, user_id=user.id)
    combined_records = sorted(
        [*xingce_records, *essay_records],
        key=lambda item: item.occurred_at,
        reverse=True,
    )
    total_attempts = len(combined_records)
    completed_attempts = sum(1 for item in combined_records if item.is_completed)
    return LearningRecordAggregate(
        items=combined_records[:20],
        total_attempts=total_attempts,
        xingce_attempts=len(xingce_records),
        essay_attempts=len(essay_records),
        completed_attempts=completed_attempts,
        avg_essay_score=calculate_average_score(scored_essay_values),
    )


def load_xingce_records(session: Session, *, user_id: int) -> list[LearningRecordAggregateItem]:
    practice_sessions = list(
        session.scalars(
            select(PracticeSessionV2)
            .where(
                PracticeSessionV2.user_id == user_id,
                PracticeSessionV2.track == "xingce",
            )
            .order_by(PracticeSessionV2.started_at.desc())
        )
    )
    return [
        build_xingce_record(item)
        for item in practice_sessions
    ]


def load_essay_records(
    session: Session,
    *,
    user_id: int,
) -> tuple[list[LearningRecordAggregateItem], list[Decimal]]:
    rows = session.execute(
        select(EssaySubmissionV2, EssayReportV2)
        .outerjoin(EssayReportV2, EssayReportV2.submission_id == EssaySubmissionV2.id)
        .where(EssaySubmissionV2.user_id == user_id)
        .order_by(EssaySubmissionV2.submitted_at.desc())
    ).all()
    scores = [report.score for _, report in rows if report is not None and report.score is not None]
    items = [
        build_essay_record(submission=submission, report=report)
        for submission, report in rows
    ]
    return items, scores


def build_xingce_record(practice_session: PracticeSessionV2) -> LearningRecordAggregateItem:
    normalized_status = normalize_xingce_record_status(practice_session.status)
    return LearningRecordAggregateItem(
        id=f"practice-{practice_session.id}",
        kind=XINGCE_RECORD_KIND,
        title=XINGCE_RECORD_TITLE,
        status=normalized_status,
        occurred_at=practice_session.started_at,
        is_completed=normalized_status == RECORD_STATUS_COMPLETED,
    )


def normalize_xingce_record_status(status: str) -> str:
    if status == "submitted":
        return RECORD_STATUS_COMPLETED
    if status in {"draft", "in_progress"}:
        return RECORD_STATUS_PENDING
    raise ValueError(f"unsupported practice session status for learning records: {status!r}")


def build_essay_record(
    *,
    submission: EssaySubmissionV2,
    report: EssayReportV2 | None,
) -> LearningRecordAggregateItem:
    normalized_status = resolve_essay_record_status(submission=submission, report=report)
    return LearningRecordAggregateItem(
        id=f"essay-submission-{submission.id}",
        kind=ESSAY_RECORD_KIND,
        title=ESSAY_RECORD_TITLE,
        status=normalized_status,
        occurred_at=submission.submitted_at,
        score=report.score if report is not None else None,
        is_completed=normalized_status == RECORD_STATUS_COMPLETED,
    )


def resolve_essay_record_status(
    *,
    submission: EssaySubmissionV2,
    report: EssayReportV2 | None,
) -> str:
    if report is None:
        if submission.status == "submitted":
            return RECORD_STATUS_PENDING
        raise ValueError(f"unsupported essay submission status without report: {submission.status!r}")
    if report.status == "pending":
        return RECORD_STATUS_PENDING
    if report.status == "completed":
        return RECORD_STATUS_COMPLETED
    if report.status == "failed":
        return RECORD_STATUS_FAILED
    raise ValueError(f"unsupported essay report status for learning records: {report.status!r}")


def calculate_average_score(scores: list[Decimal]) -> Decimal | None:
    if not scores:
        return None
    return (sum(scores) / Decimal(len(scores))).quantize(Decimal("0.01"))


def to_learning_record_items(items: list[LearningRecordAggregateItem]) -> list[LearningRecordItemV2]:
    return [
        LearningRecordItemV2(
            id=item.id,
            kind=item.kind,
            title=item.title,
            status=item.status,
            score=item.score,
            occurred_at=item.occurred_at,
        )
        for item in items
    ]
