from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import ReviewAttemptV2, ReviewItemV2, UserV2
from sikao_api.db.schemas_v2 import (
    ActionLinkV2,
    OperationAckV2,
    OverviewResponseV2,
    ReviewAttemptOutV2,
    ReviewDetailResponseV2,
    ReviewItemV2 as ReviewItemSchemaV2,
    ReviewListResponseV2,
    SectionCardV2,
    SummaryMetricV2,
)
from sikao_api.modules.system.application.errors import NotFoundError


def _serialize_item(item: ReviewItemV2) -> ReviewItemSchemaV2:
    return ReviewItemSchemaV2(
        id=item.id,
        kind=item.source_kind,
        title=item.title,
        status=item.status,
        href=f"/wrong-book/{item.id}",
        created_at=item.created_at,
    )


def _build_placeholder_item(item_id: int) -> ReviewItemSchemaV2:
    return ReviewItemSchemaV2(
        id=item_id,
        kind="placeholder",
        title=f"review-item-{item_id}",
        status="empty",
        href=f"/wrong-book/{item_id}",
        created_at=datetime.now(UTC).replace(tzinfo=None),
    )


def _has_review_items(session: Session, *, user: UserV2) -> bool:
    return bool(
        session.scalar(
            select(func.count()).select_from(ReviewItemV2).where(ReviewItemV2.user_id == user.id)
        )
    )


def _build_redo_action(item_id: int) -> ActionLinkV2:
    return ActionLinkV2(
        key="redo",
        label="错题重做",
        href=f"/wrong-book/{item_id}/redo",
        enabled=False,
    )


def build_review_list(session: Session, *, user: UserV2) -> ReviewListResponseV2:
    rows = list(
        session.scalars(
            select(ReviewItemV2)
            .where(ReviewItemV2.user_id == user.id)
            .order_by(ReviewItemV2.updated_at.desc(), ReviewItemV2.id.desc())
        )
    )
    return ReviewListResponseV2(
        items=[_serialize_item(item) for item in rows],
        total=len(rows),
        page=1,
        page_size=20,
    )


def build_smart_review(session: Session, *, user: UserV2) -> OverviewResponseV2:
    total = session.scalar(
        select(func.count()).select_from(ReviewItemV2).where(ReviewItemV2.user_id == user.id)
    ) or 0
    return OverviewResponseV2(
        summary=[SummaryMetricV2(key="smart", label="Smart review", value=str(total))],
        sections=[
            SectionCardV2(
                key="smart",
                title="智能复盘",
                description=f"{total} 条复盘项",
                status="ready" if total > 0 else "empty",
                href="/wrong-book/smart-review",
            )
        ],
        actions=[ActionLinkV2(key="wrong-book", label="错题本", href="/wrong-book")],
    )


def build_review_detail(
    session: Session,
    *,
    user: UserV2,
    item_id: int,
) -> ReviewDetailResponseV2:
    item = session.scalar(
        select(ReviewItemV2).where(
            ReviewItemV2.id == item_id,
            ReviewItemV2.user_id == user.id,
        )
    )
    if item is None:
        if _has_review_items(session, user=user):
            raise NotFoundError("review item not found", code="review_item_not_found")
        return ReviewDetailResponseV2(
            item=_build_placeholder_item(item_id),
            history=[],
            actions=[_build_redo_action(item_id)],
        )

    attempts = list(
        session.scalars(
            select(ReviewAttemptV2)
            .where(ReviewAttemptV2.review_item_id == item.id)
            .order_by(ReviewAttemptV2.attempted_at.desc(), ReviewAttemptV2.id.desc())
        )
    )
    return ReviewDetailResponseV2(
        item=_serialize_item(item),
        history=[
            ReviewAttemptOutV2(
                id=attempt.id,
                outcome=attempt.outcome,
                attempted_at=attempt.attempted_at,
            )
            for attempt in attempts
        ],
        actions=[_build_redo_action(item.id)],
    )


def build_redo_ack(
    session: Session,
    *,
    user: UserV2,
    item_id: int,
) -> OperationAckV2:
    item = session.scalar(
        select(ReviewItemV2).where(
            ReviewItemV2.id == item_id,
            ReviewItemV2.user_id == user.id,
        )
    )
    if item is None and _has_review_items(session, user=user):
        raise NotFoundError("review item not found", code="review_item_not_found")
    return OperationAckV2(ok=False, status="unavailable")
