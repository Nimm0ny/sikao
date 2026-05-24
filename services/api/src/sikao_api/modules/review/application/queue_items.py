from __future__ import annotations

from collections.abc import Iterable
from datetime import UTC, datetime

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from sikao_api.db.enums_v2 import ReviewAttemptOutcome, ReviewItemStatus, ReviewSourceKind
from sikao_api.db.models_v2 import QuestionV2, ReviewAttemptV2, ReviewItemV2


ACTIVE_REVIEW_ITEM_STATUSES = (
    ReviewItemStatus.PENDING.value,
    ReviewItemStatus.IN_PROGRESS.value,
    ReviewItemStatus.PROBATIONARY.value,
)
FLAGGED_SOURCE_ALIASES = {
    ReviewSourceKind.FLAGGED_PERSISTENT.value,
    "question_flag",
}
TERMINAL_FLAGGED_LEGACY_STATUSES = {"resolved", "removed"}


def utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def reason_compat_for_source(source_kind: str) -> str | None:
    if source_kind in {
        ReviewSourceKind.WRONG_ANSWER.value,
        ReviewSourceKind.MANUAL_ADD.value,
        ReviewSourceKind.FLAGGED_PERSISTENT.value,
        "low_confidence",
    }:
        return source_kind
    return None


def record_review_attempt(
    session: Session,
    *,
    item_id: int,
    outcome: str,
    notes_json: dict[str, object] | None = None,
) -> ReviewAttemptV2:
    attempt = ReviewAttemptV2(
        review_item_id=item_id,
        outcome=outcome,
        notes_json=notes_json or {},
    )
    session.add(attempt)
    session.flush()
    return attempt


def create_review_item(
    session: Session,
    *,
    user_id: int,
    question_id: int | None,
    source_kind: str,
    title: str,
    source_id: int | None,
    metadata_json: dict[str, object],
    status: str = ReviewItemStatus.PENDING.value,
    reason: str | None = None,
) -> ReviewItemV2:
    item = ReviewItemV2(
        user_id=user_id,
        question_id=question_id,
        source_kind=source_kind,
        source_id=source_id,
        title=title,
        status=status,
        metadata_json=metadata_json,
        reason=reason if reason is not None else reason_compat_for_source(source_kind),
    )
    session.add(item)
    session.flush()
    record_review_attempt(
        session,
        item_id=item.id,
        outcome=ReviewAttemptOutcome.CREATED.value,
        notes_json={
            "sourceKind": source_kind,
            "sourceId": source_id,
            "status": status,
        },
    )
    return item


def find_active_review_item_for_question(
    session: Session,
    *,
    user_id: int,
    question_id: int,
    source_kind: str,
) -> ReviewItemV2 | None:
    if source_kind == ReviewSourceKind.FLAGGED_PERSISTENT.value:
        source_clause = or_(
            ReviewItemV2.source_kind.in_(tuple(FLAGGED_SOURCE_ALIASES)),
            ReviewItemV2.reason == "flagged_persistent",
        )
    else:
        source_clause = ReviewItemV2.source_kind == source_kind
    return session.scalar(
        select(ReviewItemV2)
        .where(
            ReviewItemV2.user_id == user_id,
            ReviewItemV2.question_id == question_id,
            source_clause,
            ReviewItemV2.status.in_(ACTIVE_REVIEW_ITEM_STATUSES),
        )
        .order_by(ReviewItemV2.updated_at.desc(), ReviewItemV2.id.desc())
    )


def find_review_item_by_source(
    session: Session,
    *,
    user_id: int,
    question_id: int,
    source_kind: str,
    source_id: int,
) -> ReviewItemV2 | None:
    return session.scalar(
        select(ReviewItemV2)
        .where(
            ReviewItemV2.user_id == user_id,
            ReviewItemV2.question_id == question_id,
            ReviewItemV2.source_kind == source_kind,
            ReviewItemV2.source_id == source_id,
        )
        .order_by(ReviewItemV2.updated_at.desc(), ReviewItemV2.id.desc())
    )


def normalize_flagged_review_row(
    item: ReviewItemV2,
    *,
    legacy_settled_status: str | None = None,
) -> ReviewItemV2:
    metadata_json = dict(item.metadata_json)
    if item.source_kind != ReviewSourceKind.FLAGGED_PERSISTENT.value:
        metadata_json.setdefault("legacySourceKind", item.source_kind)
        item.source_kind = ReviewSourceKind.FLAGGED_PERSISTENT.value
    if item.reason != "flagged_persistent":
        if item.reason is not None:
            metadata_json.setdefault("legacyReason", item.reason)
        item.reason = "flagged_persistent"
    if item.status in TERMINAL_FLAGGED_LEGACY_STATUSES:
        metadata_json.setdefault("legacyStatus", item.status)
        item.status = ReviewItemStatus.ARCHIVED.value
    if legacy_settled_status is not None:
        metadata_json["settledStatus"] = legacy_settled_status
        metadata_json["canonicalSettledStatus"] = ReviewItemStatus.ARCHIVED.value
        metadata_json["settledAt"] = utc_now().isoformat()
    item.metadata_json = metadata_json
    return item


def upsert_wrong_answer_review_item(
    session: Session,
    *,
    user_id: int,
    question: QuestionV2,
    source_session_id: int,
) -> ReviewItemV2:
    stable_existing = find_review_item_by_source(
        session,
        user_id=user_id,
        question_id=question.id,
        source_kind=ReviewSourceKind.WRONG_ANSWER.value,
        source_id=source_session_id,
    )
    if stable_existing is not None:
        stable_existing.title = question.prompt
        stable_existing.reason = ReviewSourceKind.WRONG_ANSWER.value
        stable_existing.metadata_json = {
            **stable_existing.metadata_json,
            "questionId": question.id,
            "sourceSessionId": source_session_id,
            "categoryL1": question.category_l1,
            "categoryL2": question.category_l2,
        }
        session.add(stable_existing)
        return stable_existing

    existing = find_active_review_item_for_question(
        session,
        user_id=user_id,
        question_id=question.id,
        source_kind=ReviewSourceKind.WRONG_ANSWER.value,
    )
    metadata_json = {
        "questionId": question.id,
        "sourceSessionId": source_session_id,
        "categoryL1": question.category_l1,
        "categoryL2": question.category_l2,
        "lastWrongAt": utc_now().isoformat(),
    }
    if existing is not None:
        existing.title = question.prompt
        existing.source_id = source_session_id
        existing.reason = ReviewSourceKind.WRONG_ANSWER.value
        existing.metadata_json = {**existing.metadata_json, **metadata_json}
        session.add(existing)
        return existing
    return create_review_item(
        session,
        user_id=user_id,
        question_id=question.id,
        source_kind=ReviewSourceKind.WRONG_ANSWER.value,
        title=question.prompt,
        source_id=source_session_id,
        metadata_json=metadata_json,
    )


def load_questions_by_id(
    session: Session,
    *,
    question_ids: Iterable[int],
) -> dict[int, QuestionV2]:
    resolved_ids = {int(question_id) for question_id in question_ids}
    if not resolved_ids:
        return {}
    return {
        question.id: question
        for question in session.scalars(
            select(QuestionV2).where(QuestionV2.id.in_(resolved_ids))
        )
    }
