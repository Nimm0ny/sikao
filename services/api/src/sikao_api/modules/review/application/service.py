from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from sikao_api.db.enums_v2 import ReviewAttemptOutcome, ReviewItemStatus, ReviewSourceKind
from sikao_api.db.models_v2 import ReviewAttemptV2, ReviewItemV2, UserV2
from sikao_api.db.schemas_v2 import (
    ActionLinkV2,
    OperationAckV2,
    OverviewResponseV2,
    ReviewAttemptOutV2,
    ReviewBatchActionResultV2,
    ReviewDetailResponseV2,
    ReviewItemBatchActionV2,
    ReviewItemCreateV2,
    ReviewItemV2 as ReviewItemSchemaV2,
    ReviewListResponseV2,
    SectionCardV2,
    SrsStateV2,
    SummaryMetricV2,
)
from sikao_api.modules.review.application.presentation import (
    apply_review_filters,
    build_placeholder_review_item,
    build_redo_action,
    build_review_actions,
    build_srs_state,
    compute_probation_check_at,
    serialize_review_item,
)
from sikao_api.modules.review.application.queue_items import (
    canonical_review_status,
    create_review_item,
    load_review_presence_sets,
    normalize_flagged_review_row,
    record_review_attempt,
    utc_now,
)
from sikao_api.modules.review.application.validators import (
    parse_review_list_filters,
    review_status_clause,
    validate_manual_add_target,
)
from sikao_api.modules.system.application.errors import ConflictError, NotFoundError


def build_review_list(
    session: Session,
    *,
    user: UserV2,
    status: str | None = None,
    source_kind: str | None = None,
    question_id: int | None = None,
    page: int = 1,
    page_size: int = 20,
    order_by: str = "created_at",
    order_dir: str = "desc",
) -> ReviewListResponseV2:
    filters = parse_review_list_filters(
        status=status,
        source_kind=source_kind,
        question_id=question_id,
        page=page,
        page_size=page_size,
        order_by=order_by,
        order_dir=order_dir,
    )
    query = apply_review_filters(
        select(ReviewItemV2).where(ReviewItemV2.user_id == user.id),
        filters=filters,
    )
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = list(
        session.scalars(
            query.offset((filters.page - 1) * filters.page_size).limit(filters.page_size)
        )
    )
    note_question_ids, cause_question_ids = load_review_presence_sets(
        session,
        user_id=user.id,
        items=rows,
    )
    return ReviewListResponseV2(
        items=[
            serialize_review_item(
                item,
                note_question_ids=note_question_ids,
                cause_question_ids=cause_question_ids,
            )
            for item in rows
        ],
        total=total,
        page=filters.page,
        page_size=filters.page_size,
    )


def build_smart_review(session: Session, *, user: UserV2) -> OverviewResponseV2:
    total = session.scalar(
        select(func.count()).select_from(ReviewItemV2).where(
            ReviewItemV2.user_id == user.id,
            review_status_clause(()),
        )
    ) or 0
    return OverviewResponseV2(
        summary=[SummaryMetricV2(key="smart", label="Smart review", value=str(total))],
        sections=[
            SectionCardV2(
                key="smart",
                title="智能复盘",
                description=f"{total} 条活跃复盘项",
                status="ready" if total > 0 else "empty",
                href="/review",
            )
        ],
        actions=[ActionLinkV2(key="review", label="复盘", href="/review")],
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
        if _has_active_review_items(session, user=user):
            raise NotFoundError("review item not found", code="review_item_not_found")
        return ReviewDetailResponseV2(
            item=build_placeholder_review_item(item_id),
            history=[],
            actions=[build_redo_action(item_id)],
            srs_state=SrsStateV2(),
            metadata={},
        )

    attempts = list(
        session.scalars(
            select(ReviewAttemptV2)
            .where(ReviewAttemptV2.review_item_id == item.id)
            .order_by(ReviewAttemptV2.attempted_at.desc(), ReviewAttemptV2.id.desc())
        )
    )
    note_question_ids, cause_question_ids = load_review_presence_sets(
        session,
        user_id=user.id,
        items=[item],
    )
    return ReviewDetailResponseV2(
        item=serialize_review_item(
            item,
            note_question_ids=note_question_ids,
            cause_question_ids=cause_question_ids,
        ),
        history=[
            ReviewAttemptOutV2(
                id=attempt.id,
                outcome=attempt.outcome,
                attempted_at=attempt.attempted_at,
                notes_json=attempt.notes_json,
            )
            for attempt in attempts
        ],
        actions=build_review_actions(item.id, status=canonical_review_status(item.status)),
        srs_state=build_srs_state(item),
        metadata=item.metadata_json,
    )


def create_review_item_manual(
    session: Session,
    *,
    user: UserV2,
    payload: ReviewItemCreateV2,
) -> ReviewItemSchemaV2:
    question = validate_manual_add_target(session, user_id=user.id, question_id=payload.question_id)
    item = create_review_item(
        session,
        user_id=user.id,
        question_id=question.id,
        source_kind=ReviewSourceKind.MANUAL_ADD.value,
        source_id=question.id,
        title=payload.title or question.prompt,
        metadata_json={
            "questionId": question.id,
            "categoryL1": question.category_l1,
            "categoryL2": question.category_l2,
            "manualAddedAt": utc_now().isoformat(),
        },
        reason=ReviewSourceKind.MANUAL_ADD.value,
    )
    note_question_ids, cause_question_ids = load_review_presence_sets(
        session,
        user_id=user.id,
        items=[item],
    )
    return serialize_review_item(item, note_question_ids=note_question_ids, cause_question_ids=cause_question_ids)


def graduate_review_item(
    session: Session,
    *,
    user: UserV2,
    item_id: int,
) -> ReviewItemSchemaV2:
    item = _load_owned_item(session, user=user, item_id=item_id)
    status = canonical_review_status(item.status)
    if status not in {ReviewItemStatus.PENDING.value, ReviewItemStatus.IN_PROGRESS.value}:
        raise ConflictError("review item cannot graduate from current status", code="review_item_status_invalid")
    normalize_flagged_review_row(item)
    before_status = canonical_review_status(item.status)
    before_streak = item.correct_streak
    probation_check_at = compute_probation_check_at()
    item.status = ReviewItemStatus.PROBATIONARY.value
    item.correct_streak = max(item.correct_streak, 4)
    item.next_review_at = probation_check_at
    item.metadata_json = {
        **item.metadata_json,
        "algorithm_version": item.metadata_json.get("algorithm_version", "simple_v1"),
        "probation_started_at": utc_now().isoformat(),
        "probation_check_at": probation_check_at.isoformat(),
        "probation_attempts": item.metadata_json.get("probation_attempts", 0),
    }
    session.add(item)
    record_review_attempt(
        session,
        item_id=item.id,
        outcome=ReviewAttemptOutcome.PROBATION_ENTERED.value,
        notes_json={
            "beforeStatus": before_status,
            "afterStatus": ReviewItemStatus.PROBATIONARY.value,
            "beforeStreak": before_streak,
            "afterStreak": item.correct_streak,
        },
    )
    note_question_ids, cause_question_ids = load_review_presence_sets(
        session,
        user_id=user.id,
        items=[item],
    )
    return serialize_review_item(item, note_question_ids=note_question_ids, cause_question_ids=cause_question_ids)


def archive_review_item(
    session: Session,
    *,
    user: UserV2,
    item_id: int,
) -> ReviewItemSchemaV2:
    item = _load_owned_item(session, user=user, item_id=item_id)
    status = canonical_review_status(item.status)
    if status == ReviewItemStatus.ARCHIVED.value:
        raise ConflictError("review item already archived", code="review_item_status_invalid")
    normalize_flagged_review_row(item)
    before_status = canonical_review_status(item.status)
    item.status = ReviewItemStatus.ARCHIVED.value
    item.metadata_json = {
        **item.metadata_json,
        "archived_at": utc_now().isoformat(),
    }
    session.add(item)
    record_review_attempt(
        session,
        item_id=item.id,
        outcome=ReviewAttemptOutcome.ARCHIVED.value,
        notes_json={"beforeStatus": before_status, "afterStatus": ReviewItemStatus.ARCHIVED.value},
    )
    note_question_ids, cause_question_ids = load_review_presence_sets(
        session,
        user_id=user.id,
        items=[item],
    )
    return serialize_review_item(item, note_question_ids=note_question_ids, cause_question_ids=cause_question_ids)


def restore_review_item(
    session: Session,
    *,
    user: UserV2,
    item_id: int,
) -> ReviewItemSchemaV2:
    item = _load_owned_item(session, user=user, item_id=item_id)
    status = canonical_review_status(item.status)
    if status != ReviewItemStatus.ARCHIVED.value:
        raise ConflictError("review item is not archived", code="review_item_status_invalid")
    normalize_flagged_review_row(item)
    item.status = ReviewItemStatus.PENDING.value
    item.correct_streak = 0
    item.next_review_at = None
    item.metadata_json = {
        **item.metadata_json,
        "restored_at": utc_now().isoformat(),
    }
    session.add(item)
    record_review_attempt(
        session,
        item_id=item.id,
        outcome=ReviewAttemptOutcome.RESTORED.value,
        notes_json={"afterStatus": ReviewItemStatus.PENDING.value, "afterStreak": 0},
    )
    note_question_ids, cause_question_ids = load_review_presence_sets(
        session,
        user_id=user.id,
        items=[item],
    )
    return serialize_review_item(item, note_question_ids=note_question_ids, cause_question_ids=cause_question_ids)


def apply_review_batch_action(
    session: Session,
    *,
    user: UserV2,
    payload: ReviewItemBatchActionV2,
) -> ReviewBatchActionResultV2:
    if not payload.item_ids:
        raise ConflictError("batch action requires item ids", code="review_batch_empty")
    affected = 0
    for item_id in payload.item_ids:
        if payload.action == "archive":
            archive_review_item(session, user=user, item_id=item_id)
        elif payload.action == "restore":
            restore_review_item(session, user=user, item_id=item_id)
        else:
            graduate_review_item(session, user=user, item_id=item_id)
        affected += 1
    return ReviewBatchActionResultV2(ok=True, status=payload.action, affected_count=affected)


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
    if item is None and _has_active_review_items(session, user=user):
        raise NotFoundError("review item not found", code="review_item_not_found")
    return OperationAckV2(ok=False, status="unavailable")


def _has_active_review_items(session: Session, *, user: UserV2) -> bool:
    return bool(
        session.scalar(
            select(func.count()).select_from(ReviewItemV2).where(
                ReviewItemV2.user_id == user.id,
                review_status_clause(()),
            )
        )
    )


def _load_owned_item(session: Session, *, user: UserV2, item_id: int) -> ReviewItemV2:
    item = session.scalar(
        select(ReviewItemV2).where(
            ReviewItemV2.id == item_id,
            ReviewItemV2.user_id == user.id,
        )
    )
    if item is None:
        raise NotFoundError("review item not found", code="review_item_not_found")
    return item
