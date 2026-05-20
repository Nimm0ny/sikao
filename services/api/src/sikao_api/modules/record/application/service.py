from __future__ import annotations

from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import EssayReportV2, EssaySubmissionV2, PracticeSessionV2, UserV2
from sikao_api.db.schemas_v2 import ActionLinkV2, DashboardRecordsResponseV2, LearningRecordItemV2, LearningRecordSummaryV2, SectionCardV2


def build_learning_record_summary(session: Session, *, user: UserV2) -> LearningRecordSummaryV2:
    total_sessions = session.scalar(
        select(func.count()).select_from(PracticeSessionV2).where(PracticeSessionV2.user_id == user.id)
    ) or 0
    essay_attempts = session.scalar(
        select(func.count()).select_from(EssaySubmissionV2).where(EssaySubmissionV2.user_id == user.id)
    ) or 0
    completed_sessions = session.scalar(
        select(func.count()).select_from(PracticeSessionV2).where(
            PracticeSessionV2.user_id == user.id, PracticeSessionV2.status == "submitted"
        )
    ) or 0
    return LearningRecordSummaryV2(
        total_attempts=int(total_sessions + essay_attempts),
        xingce_attempts=int(total_sessions),
        essay_attempts=int(essay_attempts),
        completed_attempts=int(completed_sessions),
        avg_xingce_accuracy=Decimal("0.00"),
        avg_essay_score=Decimal("0.00"),
    )


def list_learning_records(session: Session, *, user: UserV2) -> list[LearningRecordItemV2]:
    practice_sessions = list(
        session.scalars(
            select(PracticeSessionV2)
            .where(PracticeSessionV2.user_id == user.id)
            .order_by(PracticeSessionV2.started_at.desc())
            .limit(20)
        )
    )
    records = [
        LearningRecordItemV2(
            id=f"practice-{item.id}",
            kind=f"{item.track}_{item.entry_kind}",
            title=f"{item.track} {item.entry_kind}",
            status=item.status,
            occurred_at=item.started_at,
        )
        for item in practice_sessions
    ]
    return records


def build_dashboard_records(session: Session, *, user: UserV2) -> DashboardRecordsResponseV2:
    items = list_learning_records(session, user=user)
    return DashboardRecordsResponseV2(
        summary=build_learning_record_summary(session, user=user),
        sections=[
            SectionCardV2(
                key="records",
                title="学习记录",
                description="Phase 1 learning records skeleton.",
                status="empty" if not items else "partial",
                href="/dashboard/records",
            )
        ],
        actions=[ActionLinkV2(key="records", label="学习记录", href="/dashboard/records")],
        items=items,
        total=len(items),
        page=1,
        page_size=20,
    )
