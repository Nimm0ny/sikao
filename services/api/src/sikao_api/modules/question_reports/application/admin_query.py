from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import QuestionReportV2, QuestionV2, UserV2
from sikao_api.db.schemas_v2 import (
    QuestionReportAdminItemV2,
    QuestionReportAdminListResponseV2,
)
from sikao_api.modules.question_reports.domain.types import (
    ACTIVE_QUESTION_REPORT_STATUSES,
    QuestionReportCategory,
    QuestionReportStatus,
)
from sikao_api.modules.system.application.errors import NotFoundError


def list_reports(
    session: Session,
    *,
    status: QuestionReportStatus | None,
    category: QuestionReportCategory | None,
    question_id: int | None,
    limit: int,
    offset: int,
) -> QuestionReportAdminListResponseV2:
    filters = list_filters(
        status=status.value if status is not None else None,
        category=category.value if category is not None else None,
        question_id=question_id,
    )
    active_counts = active_report_counts_subquery().subquery()
    active_count_expr = func.coalesce(active_counts.c.active_report_count, 0)
    stmt = (
        select(
            QuestionReportV2,
            UserV2.display_name,
            QuestionV2.prompt,
            QuestionV2.source,
            QuestionV2.is_active,
            active_count_expr.label("active_report_count"),
        )
        .join(UserV2, UserV2.id == QuestionReportV2.user_id)
        .join(QuestionV2, QuestionV2.id == QuestionReportV2.question_id)
        .outerjoin(active_counts, active_counts.c.question_id == QuestionReportV2.question_id)
        .where(*filters)
        .order_by(
            active_count_expr.desc(),
            QuestionReportV2.created_at.asc(),
            QuestionReportV2.id.asc(),
        )
        .offset(offset)
        .limit(limit)
    )
    rows = session.execute(stmt).all()
    total = int(
        session.scalar(
            select(func.count(QuestionReportV2.id)).where(*filters)
        )
        or 0
    )
    pending_count = int(
        session.scalar(
            select(func.count(QuestionReportV2.id)).where(
                QuestionReportV2.deleted_at.is_(None),
                QuestionReportV2.status == QuestionReportStatus.PENDING.value,
            )
        )
        or 0
    )
    items = [
        _to_admin_item(report, display_name, prompt, source, is_active, active_report_count)
        for report, display_name, prompt, source, is_active, active_report_count in rows
    ]
    return QuestionReportAdminListResponseV2(
        items=items,
        total=total,
        pending_count=pending_count,
        page=(offset // limit) + 1,
        page_size=limit,
    )


def load_admin_item_or_raise(
    session: Session,
    *,
    report_id: int,
) -> QuestionReportAdminItemV2:
    active_counts = active_report_counts_subquery().subquery()
    active_count_expr = func.coalesce(active_counts.c.active_report_count, 0)
    row = session.execute(
        select(
            QuestionReportV2,
            UserV2.display_name,
            QuestionV2.prompt,
            QuestionV2.source,
            QuestionV2.is_active,
            active_count_expr.label("active_report_count"),
        )
        .join(UserV2, UserV2.id == QuestionReportV2.user_id)
        .join(QuestionV2, QuestionV2.id == QuestionReportV2.question_id)
        .outerjoin(active_counts, active_counts.c.question_id == QuestionReportV2.question_id)
        .where(
            QuestionReportV2.id == report_id,
            QuestionReportV2.deleted_at.is_(None),
        )
    ).one_or_none()
    if row is None:
        raise NotFoundError(
            "question report not found",
            code="question_report_not_found",
        )
    return _to_admin_item(*row)


def active_report_counts_subquery() -> Any:
    return (
        select(
            QuestionReportV2.question_id.label("question_id"),
            func.count(QuestionReportV2.id).label("active_report_count"),
        )
        .where(
            QuestionReportV2.deleted_at.is_(None),
            QuestionReportV2.status.in_(ACTIVE_QUESTION_REPORT_STATUSES),
        )
        .group_by(QuestionReportV2.question_id)
    )


def list_filters(
    *,
    status: str | None,
    category: str | None,
    question_id: int | None,
) -> list[Any]:
    filters: list[Any] = [QuestionReportV2.deleted_at.is_(None)]
    if status is not None:
        filters.append(QuestionReportV2.status == status)
    if category is not None:
        filters.append(QuestionReportV2.category == category)
    if question_id is not None:
        filters.append(QuestionReportV2.question_id == question_id)
    return filters


def _to_admin_item(
    report: QuestionReportV2,
    display_name: str | None,
    prompt: str,
    source: str,
    is_active: bool,
    active_report_count: int,
) -> QuestionReportAdminItemV2:
    return QuestionReportAdminItemV2(
        id=report.id,
        question_id=report.question_id,
        category=QuestionReportCategory(report.category),
        description=report.description,
        status=QuestionReportStatus(report.status),
        reporter_user_id=report.user_id,
        reporter_display_name=display_name,
        question_prompt=prompt,
        question_source=source,
        question_is_active=is_active,
        active_report_count=int(active_report_count or 0),
        admin_response=report.admin_response,
        duplicate_of_report_id=report.duplicate_of_report_id,
        applied_fix=report.applied_fix,
        source_session_id=report.source_session_id,
        selected_answer_at_report=report.selected_answer_at_report,
        created_at=report.created_at,
        updated_at=report.updated_at,
        handled_at=report.handled_at,
    )
