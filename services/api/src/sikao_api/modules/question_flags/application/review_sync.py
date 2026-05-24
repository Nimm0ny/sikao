from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import QuestionFlagV2, QuestionV2, ReviewItemV2
from sikao_api.modules.review.application.queue_items import (
    ACTIVE_REVIEW_ITEM_STATUSES,
    create_review_item,
    find_active_review_item_for_question,
    normalize_flagged_review_row,
)


def sync_flagged_persistent_review_item(
    session: Session,
    *,
    user_id: int,
    question: QuestionV2,
    flag: QuestionFlagV2,
) -> ReviewItemV2:
    item = find_active_review_item_for_question(
        session,
        user_id=user_id,
        question_id=question.id,
        source_kind="flagged_persistent",
    )
    metadata = {
        "flagId": flag.id,
        "questionId": question.id,
        "categoryL1": question.category_l1,
        "categoryL2": question.category_l2,
    }
    if item is None:
        item = create_review_item(
            session,
            user_id=user_id,
            question_id=question.id,
            source_kind="flagged_persistent",
            source_id=flag.id,
            title=question.prompt,
            status="pending",
            metadata_json=metadata,
            reason="flagged_persistent",
        )
        return item

    normalize_flagged_review_row(item)
    item.source_kind = "flagged_persistent"
    item.source_id = flag.id
    item.title = question.prompt
    item.metadata_json = {**item.metadata_json, **metadata}
    item.reason = "flagged_persistent"
    item.status = "pending"
    return item


def settle_flagged_persistent_review_item(
    session: Session,
    *,
    user_id: int,
    question_id: int,
    target_status: str,
) -> ReviewItemV2 | None:
    item = session.scalar(
        select(ReviewItemV2)
        .where(
            ReviewItemV2.user_id == user_id,
            ReviewItemV2.question_id == question_id,
            ReviewItemV2.status.in_(ACTIVE_REVIEW_ITEM_STATUSES),
            (ReviewItemV2.source_kind.in_(("flagged_persistent", "question_flag")) | (ReviewItemV2.reason == "flagged_persistent")),
        )
        .order_by(ReviewItemV2.updated_at.desc(), ReviewItemV2.id.desc())
    )
    if item is None:
        return None
    normalize_flagged_review_row(item, legacy_settled_status=target_status)
    item.status = "archived"
    item.metadata_json = {
        **item.metadata_json,
        "settledAt": datetime.now(UTC).replace(tzinfo=None).isoformat(),
        "settledStatus": target_status,
        "canonicalSettledStatus": "archived",
    }
    return item
