from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import EssayReportV2, EssaySubmissionV2, PracticeSessionAnswerV2, PracticeSessionV2, UserV2
from sikao_api.db.schemas_v2 import (
    ActionLinkV2,
    DashboardRecordsResponseV2,
    LearningRecordItemV2,
    LearningRecordListResponseV2,
    LearningRecordSummaryV2,
    SectionCardV2,
)
from sikao_api.modules.system.application.errors import ValidationError

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
    href: str
    occurred_at: datetime
    score: Decimal | None = None
    is_completed: bool = False
    session_id: int | None = None


@dataclass(frozen=True)
class LearningRecordAggregate:
    items: list[LearningRecordAggregateItem]
    total_attempts: int
    xingce_attempts: int
    essay_attempts: int
    completed_attempts: int
    avg_xingce_accuracy: Decimal | None
    avg_essay_score: Decimal | None


def build_learning_record_summary(session: Session, *, user: UserV2) -> LearningRecordSummaryV2:
    aggregate = collect_learning_record_aggregate(session, user=user)
    return LearningRecordSummaryV2(
        total_attempts=aggregate.total_attempts,
        xingce_attempts=aggregate.xingce_attempts,
        essay_attempts=aggregate.essay_attempts,
        completed_attempts=aggregate.completed_attempts,
        avg_xingce_accuracy=aggregate.avg_xingce_accuracy,
        avg_essay_score=aggregate.avg_essay_score,
    )


def build_learning_record_list(
    session: Session,
    *,
    user: UserV2,
    page: int,
    size: int,
    kind: str | None,
    status: str | None,
    from_date: date | None,
    to_date: date | None,
    session_id: int | None,
) -> LearningRecordListResponseV2:
    if page < 1:
        raise ValidationError("page must be >= 1", code="invalid_page")
    if size < 1 or size > 100:
        raise ValidationError("size must be between 1 and 100", code="invalid_page_size")
    items = filter_learning_record_items(
        collect_learning_record_aggregate(session, user=user).items,
        kind=kind,
        status=status,
        from_date=from_date,
        to_date=to_date,
        session_id=session_id,
    )
    total = len(items)
    offset = (page - 1) * size
    paged = items[offset : offset + size]
    return LearningRecordListResponseV2(
        items=to_learning_record_items(paged),
        total=total,
        page=page,
        page_size=size,
    )


def build_dashboard_records(session: Session, *, user: UserV2) -> DashboardRecordsResponseV2:
    aggregate = collect_learning_record_aggregate(session, user=user)
    list_payload = build_learning_record_list(
        session,
        user=user,
        page=1,
        size=20,
        kind=None,
        status=None,
        from_date=None,
        to_date=None,
        session_id=None,
    )
    return DashboardRecordsResponseV2(
        summary=LearningRecordSummaryV2(
            total_attempts=aggregate.total_attempts,
            xingce_attempts=aggregate.xingce_attempts,
            essay_attempts=aggregate.essay_attempts,
            completed_attempts=aggregate.completed_attempts,
            avg_xingce_accuracy=aggregate.avg_xingce_accuracy,
            avg_essay_score=aggregate.avg_essay_score,
        ),
        sections=[
            SectionCardV2(
                key="records",
                title="学习记录",
                description="Learning history summary.",
                status="empty" if aggregate.total_attempts == 0 else "partial",
                href="/profile/records",
            )
        ],
        actions=[ActionLinkV2(key="records", label="学习记录", href="/profile/records")],
        items=list_payload.items,
        total=list_payload.total,
        page=list_payload.page,
        page_size=list_payload.page_size,
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
        items=combined_records,
        total_attempts=total_attempts,
        xingce_attempts=len(xingce_records),
        essay_attempts=len(essay_records),
        completed_attempts=completed_attempts,
        avg_xingce_accuracy=calculate_xingce_accuracy(session, user_id=user.id),
        avg_essay_score=calculate_average_score(scored_essay_values),
    )


def filter_learning_record_items(
    items: list[LearningRecordAggregateItem],
    *,
    kind: str | None,
    status: str | None,
    from_date: date | None,
    to_date: date | None,
    session_id: int | None,
) -> list[LearningRecordAggregateItem]:
    filtered = items
    if kind is not None:
        filtered = [item for item in filtered if item.kind == kind]
    if status is not None:
        filtered = [item for item in filtered if item.status == status]
    if from_date is not None:
        filtered = [item for item in filtered if to_cn_date(item.occurred_at) >= from_date]
    if to_date is not None:
        filtered = [item for item in filtered if to_cn_date(item.occurred_at) <= to_date]
    if session_id is not None:
        filtered = [item for item in filtered if item.session_id == session_id]
    return filtered


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
    return [build_xingce_record(item) for item in practice_sessions]


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
        href=build_xingce_record_href(
            session_id=practice_session.id,
            status=normalized_status,
        ),
        occurred_at=practice_session.started_at,
        is_completed=normalized_status == RECORD_STATUS_COMPLETED,
        session_id=practice_session.id,
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
        href=build_essay_record_href(report=report),
        occurred_at=submission.submitted_at,
        score=report.score if report is not None else None,
        is_completed=normalized_status == RECORD_STATUS_COMPLETED,
        session_id=None,
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


def calculate_xingce_accuracy(session: Session, *, user_id: int) -> Decimal | None:
    rows = session.execute(
        select(
            func.count(PracticeSessionAnswerV2.id),
            func.sum(case((PracticeSessionAnswerV2.is_correct.is_(True), 1), else_=0)),
        )
        .join(PracticeSessionV2, PracticeSessionV2.id == PracticeSessionAnswerV2.session_id)
        .where(
            PracticeSessionV2.user_id == user_id,
            PracticeSessionV2.track == "xingce",
            PracticeSessionV2.status == "submitted",
            PracticeSessionAnswerV2.is_correct.is_not(None),
        )
    ).one()
    total = int(rows[0] or 0)
    correct = int(rows[1] or 0)
    if total == 0:
        return None
    return (Decimal(correct) / Decimal(total)).quantize(Decimal("0.01"))


def to_learning_record_items(items: list[LearningRecordAggregateItem]) -> list[LearningRecordItemV2]:
    return [
        LearningRecordItemV2(
            id=item.id,
            kind=item.kind,
            title=item.title,
            status=item.status,
            href=item.href,
            score=item.score,
            occurred_at=item.occurred_at,
        )
        for item in items
    ]


def to_cn_date(value: datetime) -> date:
    return (value.replace(tzinfo=UTC) + timedelta(hours=8)).date()


def build_xingce_record_href(*, session_id: int, status: str) -> str:
    if status == RECORD_STATUS_COMPLETED:
        return f"/practice/result/{session_id}"
    return f"/practice/sessions/{session_id}"


def build_essay_record_href(*, report: EssayReportV2 | None) -> str:
    if report is not None and report.status == "completed":
        return f"/essay/grades/{report.id}"
    return "/essay/history"
