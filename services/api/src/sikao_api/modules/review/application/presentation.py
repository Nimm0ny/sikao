from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import case

from sikao_api.db.enums_v2 import ReviewItemStatus
from sikao_api.db.models_v2 import ReviewItemV2
from sikao_api.db.schemas_v2 import ActionLinkV2, ReviewItemV2 as ReviewItemSchemaV2, SrsStateV2
from sikao_api.modules.review.application.queue_items import (
    ACTIVE_REVIEW_ITEM_STATUSES,
    canonical_review_source_kind,
    canonical_review_status,
    today_end_utc,
    utc_now,
)
from sikao_api.modules.review.application.validators import (
    ReviewListFilters,
    review_source_clause,
    review_status_clause,
    validate_review_item_source_contract,
)


_DEFAULT_TZ = ZoneInfo("Asia/Shanghai")


def serialize_review_item(
    item: ReviewItemV2,
    *,
    note_question_ids: set[int],
    cause_question_ids: set[int],
) -> ReviewItemSchemaV2:
    validate_review_item_source_contract(
        source_kind=item.source_kind,
        question_id=item.question_id,
        metadata_json=item.metadata_json,
    )
    question_id = int(item.question_id) if item.question_id is not None else None
    return ReviewItemSchemaV2(
        id=item.id,
        kind=canonical_review_source_kind(source_kind=item.source_kind, reason=item.reason),
        title=item.title,
        status=canonical_review_status(item.status),
        href=f"/review/items/{item.id}",
        created_at=item.created_at,
        updated_at=item.updated_at,
        correct_streak=item.correct_streak,
        next_review_at=item.next_review_at,
        question_id=question_id,
        has_user_notes=question_id in note_question_ids if question_id is not None else False,
        has_cause_analysis=question_id in cause_question_ids if question_id is not None else False,
    )


def build_placeholder_review_item(item_id: int) -> ReviewItemSchemaV2:
    return ReviewItemSchemaV2(
        id=item_id,
        kind="placeholder",
        title=f"review-item-{item_id}",
        status="empty",
        href=f"/review/items/{item_id}",
        created_at=datetime.now(UTC).replace(tzinfo=None),
        updated_at=None,
    )


def build_redo_action(item_id: int) -> ActionLinkV2:
    return ActionLinkV2(
        key="redo",
        label="错题重做",
        href=f"/review/items/{item_id}/redo",
        enabled=False,
    )


def build_review_actions(item_id: int, *, status: str) -> list[ActionLinkV2]:
    actions: list[ActionLinkV2] = [build_redo_action(item_id)]
    if status in {ReviewItemStatus.PENDING.value, ReviewItemStatus.IN_PROGRESS.value}:
        actions.append(
            ActionLinkV2(
                key="graduate",
                label="标记掌握",
                href=f"/api/v2/review/items/{item_id}/graduate",
            )
        )
        actions.append(
            ActionLinkV2(
                key="archive",
                label="归档",
                href=f"/api/v2/review/items/{item_id}/archive",
            )
        )
    elif status == ReviewItemStatus.PROBATIONARY.value:
        actions.append(
            ActionLinkV2(
                key="archive",
                label="归档",
                href=f"/api/v2/review/items/{item_id}/archive",
            )
        )
    elif status == ReviewItemStatus.ARCHIVED.value:
        actions.append(
            ActionLinkV2(
                key="restore",
                label="恢复",
                href=f"/api/v2/review/items/{item_id}/restore",
            )
        )
    return actions


def build_srs_state(item: ReviewItemV2) -> SrsStateV2:
    metadata = item.metadata_json if isinstance(item.metadata_json, dict) else {}
    now = utc_now()
    next_review_at = item.next_review_at
    days_overdue = 0
    if next_review_at is not None and next_review_at < now:
        days_overdue = max(int((now - next_review_at).total_seconds() // 86400), 0)
    interval_days = None
    if item.status == ReviewItemStatus.PROBATIONARY.value:
        interval_days = 30
    elif 0 <= item.correct_streak < 4:
        intervals = {0: 1, 1: 3, 2: 7, 3: 21}
        interval_days = intervals.get(item.correct_streak)
    today_end = today_end_utc()
    canonical_status = canonical_review_status(item.status)
    if next_review_at is None:
        is_due_today = canonical_status in {
            ReviewItemStatus.PENDING.value,
            ReviewItemStatus.IN_PROGRESS.value,
        }
    else:
        is_due_today = canonical_status in ACTIVE_REVIEW_ITEM_STATUSES and next_review_at <= today_end
    return SrsStateV2(
        algorithm_version=str(metadata.get("algorithm_version", "simple_v1")),
        correct_streak=item.correct_streak,
        next_review_at=next_review_at,
        interval_days=interval_days,
        is_due_today=is_due_today,
        days_overdue=days_overdue,
    )


def apply_review_filters(query: Any, *, filters: ReviewListFilters) -> Any:
    query = query.where(review_status_clause(filters.statuses))
    source_clause = review_source_clause(filters.source_kinds)
    if source_clause is not None:
        query = query.where(source_clause)
    if filters.question_id is not None:
        query = query.where(ReviewItemV2.question_id == filters.question_id)

    if filters.order_by == "next_review_at":
        next_review_column = ReviewItemV2.next_review_at
        null_rank = case((ReviewItemV2.next_review_at.is_(None), 0), else_=1)
        if filters.order_dir == "asc":
            query = query.order_by(null_rank.asc(), next_review_column.asc(), ReviewItemV2.id.asc())
        else:
            query = query.order_by(null_rank.asc(), next_review_column.desc(), ReviewItemV2.id.desc())
        return query

    order_column: Any
    if filters.order_by == "correct_streak":
        order_column = ReviewItemV2.correct_streak
    else:
        order_column = ReviewItemV2.created_at
    if filters.order_dir == "asc":
        return query.order_by(order_column.asc(), ReviewItemV2.id.asc())
    return query.order_by(order_column.desc(), ReviewItemV2.id.desc())


def compute_probation_check_at() -> datetime:
    now_local = datetime.now(_DEFAULT_TZ)
    return (now_local.replace(hour=23, minute=59, second=59, microsecond=0) + timedelta(days=30)).astimezone(UTC).replace(tzinfo=None)
