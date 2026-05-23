from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import QuestionFlagV2, QuestionV2, ReviewItemV2


def sync_flagged_persistent_review_item(
    session: Session,
    *,
    user_id: int,
    question: QuestionV2,
    flag: QuestionFlagV2,
) -> ReviewItemV2:
    item = session.scalar(
        select(ReviewItemV2).where(
            ReviewItemV2.user_id == user_id,
            ReviewItemV2.question_id == question.id,
            ReviewItemV2.reason == "flagged_persistent",
            ReviewItemV2.status == "pending",
        )
    )
    metadata = {
        "flagId": flag.id,
        "questionId": question.id,
        "categoryL1": question.category_l1,
        "categoryL2": question.category_l2,
    }
    if item is None:
        item = ReviewItemV2(
            user_id=user_id,
            source_kind="question_flag",
            source_id=flag.id,
            title=question.prompt,
            status="pending",
            question_id=question.id,
            metadata_json=metadata,
            reason="flagged_persistent",
        )
        session.add(item)
        session.flush()
        return item

    item.source_kind = "question_flag"
    item.source_id = flag.id
    item.title = question.prompt
    item.metadata_json = metadata
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
            ReviewItemV2.reason == "flagged_persistent",
            ReviewItemV2.status == "pending",
        )
        .order_by(ReviewItemV2.updated_at.desc(), ReviewItemV2.id.desc())
    )
    if item is None:
        return None
    item.status = target_status
    item.metadata_json = {
        **item.metadata_json,
        "settledAt": datetime.now(UTC).replace(tzinfo=None).isoformat(),
        "settledStatus": target_status,
    }
    return item
