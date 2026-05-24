from __future__ import annotations

from hashlib import sha256

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from sikao_api.db.enums_v2 import ReviewAttemptOutcome, ReviewItemStatus, ReviewSourceKind
from sikao_api.db.models_v2 import ReviewAttemptV2, ReviewItemV2, UserV2
from sikao_api.db.schemas_v2 import (
    ActionLinkV2,
    OperationAckV2,
    OverviewResponseV2,
    ReviewAttemptOutV2,
    ReviewAttemptSubmitV2,
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
    serialize_review_item,
)
from sikao_api.modules.review.application.audit import (
    log_review_item_archived,
    log_review_item_mark_resolved,
    log_review_item_restored,
)
from sikao_api.modules.review.application.metrics import (
    increment_archived,
    increment_mastery_transition,
    increment_restored,
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
from sikao_api.modules.review.application.srs_engine import (
    AttemptEvent,
    SRSAdvanceResult,
    SRSRegressResult,
    advance_on_correct,
    execute_probation_check,
    is_due_today,
    mark_resolved,
    regress_on_incorrect,
)
from sikao_api.modules.review.application.srs_types import coerce_int, ensure_metadata
from sikao_api.modules.system.application.errors import ConflictError, NotFoundError


_REVIEW_USER_TIMEZONE = "Asia/Shanghai"


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


def submit_review_attempt(
    session: Session,
    *,
    user: UserV2,
    item_id: int,
    payload: ReviewAttemptSubmitV2,
) -> ReviewDetailResponseV2:
    item = _load_owned_item(session, user=user, item_id=item_id)
    expected_version = item.version
    normalize_flagged_review_row(item)
    status = canonical_review_status(item.status)
    if status in {ReviewItemStatus.GRADUATED.value, ReviewItemStatus.ARCHIVED.value}:
        raise ConflictError("review item cannot accept attempts in current status", code="review_item_status_invalid")

    confidence_prompted_forced = _is_confidence_required(item)
    if payload.confidence is None and confidence_prompted_forced:
        raise ConflictError("review attempt requires confidence", code="review_attempt_confidence_required")

    effective_confidence = payload.confidence or "likely"
    used_recall = payload.recall_text is not None
    attempt_context = _build_review_attempt_context(
        user_answer=payload.user_answer,
        is_correct=payload.is_correct,
        submitted_confidence=payload.confidence,
        effective_confidence=effective_confidence,
        used_recall=used_recall,
        recall_text=payload.recall_text,
        confidence_prompted_forced=confidence_prompted_forced,
    )

    if status == ReviewItemStatus.PROBATIONARY.value:
        if not is_due_today(item, user_tz=_REVIEW_USER_TIMEZONE, respect_debt=False):
            raise ConflictError("probationary review item is not due", code="review_item_not_due")
        probation_result = execute_probation_check(
            item,
            is_correct=payload.is_correct,
            user_id=user.id,
            user_tz=_REVIEW_USER_TIMEZONE,
        )
        _apply_review_attempt_metadata(
            item,
            user_answer=payload.user_answer,
            effective_confidence=effective_confidence,
            used_recall=used_recall,
        )
        if payload.confidence is None:
            metadata = ensure_metadata(item)
            metadata["confidence_skipped_count"] = coerce_int(
                metadata.get("confidence_skipped_count"),
                default=0,
            ) + 1
        _persist_review_state_with_cas(session, item=item, user_id=user.id, expected_version=expected_version)
        re_failed_new_item_id = None
        if probation_result.re_failed_payload is not None:
            re_failed_item = create_review_item(
                session,
                user_id=user.id,
                question_id=probation_result.re_failed_payload.question_id,
                source_kind=probation_result.re_failed_payload.source_kind,
                source_id=item.id,
                title=probation_result.re_failed_payload.title,
                metadata_json=dict(probation_result.re_failed_payload.metadata_json),
                status=probation_result.re_failed_payload.status,
                reason=None,
            )
            re_failed_new_item_id = re_failed_item.id
        _record_review_attempt_events(
            session,
            item_id=item.id,
            events=probation_result.attempts,
            context=attempt_context,
            re_failed_new_item_id=re_failed_new_item_id,
        )
        _record_mastery_transition_metrics(probation_result.attempts)
        return build_review_detail(session, user=user, item_id=item.id)

    attempt_result: SRSAdvanceResult | SRSRegressResult
    if payload.is_correct:
        attempt_result = advance_on_correct(
            item,
            confidence=payload.confidence,
            used_recall=used_recall,
            user_tz=_REVIEW_USER_TIMEZONE,
        )
    else:
        attempt_result = regress_on_incorrect(
            item,
            confidence=payload.confidence,
            user_tz=_REVIEW_USER_TIMEZONE,
        )
    _apply_review_attempt_metadata(
        item,
        user_answer=payload.user_answer,
        effective_confidence=effective_confidence,
        used_recall=used_recall,
    )
    _persist_review_state_with_cas(session, item=item, user_id=user.id, expected_version=expected_version)
    _record_review_attempt_events(
        session,
        item_id=item.id,
        events=attempt_result.attempts,
        context=attempt_context,
    )
    _record_mastery_transition_metrics(attempt_result.attempts)
    return build_review_detail(session, user=user, item_id=item.id)


def graduate_review_item(
    session: Session,
    *,
    user: UserV2,
    item_id: int,
    request_id: str | None = None,
) -> ReviewItemSchemaV2:
    item = _load_owned_item(session, user=user, item_id=item_id)
    expected_version = item.version
    status = canonical_review_status(item.status)
    if status not in {ReviewItemStatus.PENDING.value, ReviewItemStatus.IN_PROGRESS.value}:
        raise ConflictError("review item cannot graduate from current status", code="review_item_status_invalid")
    normalize_flagged_review_row(item)
    result = mark_resolved(item, user_tz="Asia/Shanghai")
    _persist_review_state_with_cas(session, item=item, user_id=user.id, expected_version=expected_version)
    for event in result.attempts:
        record_review_attempt(
            session,
            item_id=item.id,
            outcome=event.outcome,
            notes_json=event.notes_json,
        )
    log_review_item_mark_resolved(
        session,
        user_id=user.id,
        item_id=item.id,
        before_status=status,
        request_id=request_id,
    )
    increment_mastery_transition(outcome="mark_resolved")
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
    request_id: str | None = None,
) -> ReviewItemSchemaV2:
    item = _load_owned_item(session, user=user, item_id=item_id)
    expected_version = item.version
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
    item.version = max(int(item.version), 1) + 1
    _persist_review_state_with_cas(session, item=item, user_id=user.id, expected_version=expected_version)
    record_review_attempt(
        session,
        item_id=item.id,
        outcome=ReviewAttemptOutcome.ARCHIVED.value,
        notes_json={"beforeStatus": before_status, "afterStatus": ReviewItemStatus.ARCHIVED.value},
    )
    log_review_item_archived(
        session,
        user_id=user.id,
        item_id=item.id,
        before_status=before_status,
        request_id=request_id,
    )
    increment_archived()
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
    request_id: str | None = None,
) -> ReviewItemSchemaV2:
    item = _load_owned_item(session, user=user, item_id=item_id)
    expected_version = item.version
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
    item.version = max(int(item.version), 1) + 1
    _persist_review_state_with_cas(session, item=item, user_id=user.id, expected_version=expected_version)
    record_review_attempt(
        session,
        item_id=item.id,
        outcome=ReviewAttemptOutcome.RESTORED.value,
        notes_json={"afterStatus": ReviewItemStatus.PENDING.value, "afterStreak": 0},
    )
    log_review_item_restored(
        session,
        user_id=user.id,
        item_id=item.id,
        request_id=request_id,
    )
    increment_restored()
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


def _build_review_attempt_context(
    *,
    user_answer: str,
    is_correct: bool,
    submitted_confidence: str | None,
    effective_confidence: str,
    used_recall: bool,
    recall_text: str | None,
    confidence_prompted_forced: bool,
) -> dict[str, object]:
    context: dict[str, object] = {
        "userAnswer": user_answer,
        "isCorrect": is_correct,
        "confidence": submitted_confidence,
        "submittedConfidence": submitted_confidence,
        "effectiveConfidence": effective_confidence,
        "usedRecall": used_recall,
        "confidenceSkipped": submitted_confidence is None,
        "confidencePromptedForced": confidence_prompted_forced,
    }
    if recall_text is not None:
        context["recallText"] = recall_text
    return context


def _apply_review_attempt_metadata(
    item: ReviewItemV2,
    *,
    user_answer: str,
    effective_confidence: str,
    used_recall: bool,
) -> None:
    metadata = ensure_metadata(item)
    metadata["last_answer_hash"] = sha256(user_answer.encode("utf-8")).hexdigest()
    metadata["used_recall"] = used_recall
    metadata["last_reviewed_at"] = utc_now().isoformat()
    metadata["last_confidence"] = effective_confidence


def _record_review_attempt_events(
    session: Session,
    *,
    item_id: int,
    events: list[AttemptEvent],
    context: dict[str, object],
    re_failed_new_item_id: int | None = None,
) -> None:
    for event in events:
        notes_json = {**event.notes_json, **context}
        if (
            re_failed_new_item_id is not None
            and event.outcome == ReviewAttemptOutcome.PROBATION_FAILED.value
        ):
            notes_json["reFailedNewItemId"] = re_failed_new_item_id
        record_review_attempt(
            session,
            item_id=item_id,
            outcome=event.outcome,
            notes_json=notes_json,
        )


def _record_mastery_transition_metrics(events: list[AttemptEvent]) -> None:
    for event in events:
        if event.outcome in {
            ReviewAttemptOutcome.PROBATION_ENTERED.value,
            ReviewAttemptOutcome.GRADUATED.value,
        }:
            increment_mastery_transition(outcome=event.outcome)


def _is_confidence_required(item: ReviewItemV2) -> bool:
    metadata = ensure_metadata(item)
    return (
        coerce_int(metadata.get("confidence_mismatch_count"), default=0) >= 1
        or bool(metadata.get("is_hard", False))
    )


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


def _persist_review_state_with_cas(
    session: Session,
    *,
    item: ReviewItemV2,
    user_id: int,
    expected_version: int,
) -> None:
    item.updated_at = utc_now()
    result = session.execute(
        update(ReviewItemV2)
        .where(
            ReviewItemV2.id == item.id,
            ReviewItemV2.user_id == user_id,
            ReviewItemV2.version == expected_version,
        )
        .values(
            source_kind=item.source_kind,
            source_id=item.source_id,
            title=item.title,
            status=item.status,
            question_id=item.question_id,
            metadata_json=item.metadata_json,
            reason=item.reason,
            correct_streak=item.correct_streak,
            next_review_at=item.next_review_at,
            version=item.version,
            updated_at=item.updated_at,
        )
        .execution_options(synchronize_session=False)
    )
    if getattr(result, "rowcount", None) != 1:
        raise ConflictError("review item version conflict", code="review_item_optimistic_lock")
