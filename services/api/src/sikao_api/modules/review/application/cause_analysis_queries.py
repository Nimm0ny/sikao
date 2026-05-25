from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.enums_v2 import CauseAnalysisScope, ReviewItemStatus
from sikao_api.db.models_v2 import AiCauseAnalysisV2, CauseTagV2, QuestionV2, ReviewItemV2, UserV2
from sikao_api.db.schemas_v2 import CauseTagItemV2, CauseTagListResponseV2
from sikao_api.modules.system.application.errors import ConflictError, NotFoundError

_ACTIVE_REVIEW_STATUSES = {
    ReviewItemStatus.PENDING.value,
    ReviewItemStatus.IN_PROGRESS.value,
    ReviewItemStatus.PROBATIONARY.value,
}


def load_item_or_raise(session: Session, *, user: UserV2, item_id: int) -> ReviewItemV2:
    item = session.scalar(
        select(ReviewItemV2).where(
            ReviewItemV2.id == item_id,
            ReviewItemV2.user_id == user.id,
        )
    )
    if item is None:
        raise NotFoundError("review item not found", code="review_item_not_found")
    if item.question_id is None:
        raise ConflictError("review item has no question target", code="review_item_question_missing")
    return item


def load_group_items_or_raise(session: Session, *, user: UserV2, item_ids: list[int]) -> list[ReviewItemV2]:
    if len(item_ids) != len(set(item_ids)):
        raise ConflictError("group cause analysis requires distinct review items", code="review_item_duplicate")
    items = list(
        session.scalars(
            select(ReviewItemV2).where(
                ReviewItemV2.user_id == user.id,
                ReviewItemV2.id.in_(item_ids),
            )
        )
    )
    if len(items) != len(set(item_ids)):
        raise NotFoundError("one or more review items were not found", code="review_item_not_found")
    ordered = sorted(
        items,
        key=lambda item: (
            int(item.question_id) if item.question_id is not None else 0,
            item.id,
        ),
    )
    for item in ordered:
        if item.question_id is None:
            raise ConflictError("group cause analysis requires question-backed items", code="review_item_question_missing")
        if item.status not in _ACTIVE_REVIEW_STATUSES:
            raise ConflictError("group cause analysis requires active review items", code="review_item_status_invalid")
    return ordered


def load_question_or_raise(session: Session, item: ReviewItemV2) -> QuestionV2:
    question = session.get(QuestionV2, item.question_id)
    if question is None:
        raise NotFoundError("question not found", code="question_not_found")
    return question


def load_previous_single_analysis(
    session: Session,
    *,
    user_id: int,
    question_id: int,
) -> AiCauseAnalysisV2 | None:
    rows = list(
        session.scalars(
            select(AiCauseAnalysisV2)
            .where(
                AiCauseAnalysisV2.user_id == user_id,
                AiCauseAnalysisV2.scope == CauseAnalysisScope.SINGLE.value,
                AiCauseAnalysisV2.question_id == question_id,
            )
            .order_by(AiCauseAnalysisV2.created_at.desc(), AiCauseAnalysisV2.id.desc())
        )
    )
    for row in rows:
        result_json = row.result_json if isinstance(row.result_json, dict) else {}
        if result_json.get("mode") == "single":
            return row
    return None


def load_cached_single_row(
    session: Session,
    *,
    user_id: int,
    question_id: int,
    input_hash: str,
) -> AiCauseAnalysisV2 | None:
    now = datetime.now(UTC).replace(tzinfo=None)
    return session.scalar(
        select(AiCauseAnalysisV2)
        .where(
            AiCauseAnalysisV2.user_id == user_id,
            AiCauseAnalysisV2.scope == CauseAnalysisScope.SINGLE.value,
            AiCauseAnalysisV2.question_id == question_id,
            AiCauseAnalysisV2.input_hash == input_hash,
            AiCauseAnalysisV2.expires_at > now,
        )
        .order_by(AiCauseAnalysisV2.created_at.desc(), AiCauseAnalysisV2.id.desc())
    )


def load_cached_group_row(
    session: Session,
    *,
    user_id: int,
    question_ids_signature: str,
    input_hash: str,
) -> AiCauseAnalysisV2 | None:
    now = datetime.now(UTC).replace(tzinfo=None)
    return session.scalar(
        select(AiCauseAnalysisV2)
        .where(
            AiCauseAnalysisV2.user_id == user_id,
            AiCauseAnalysisV2.scope == CauseAnalysisScope.GROUP.value,
            AiCauseAnalysisV2.question_ids_signature == question_ids_signature,
            AiCauseAnalysisV2.input_hash == input_hash,
            AiCauseAnalysisV2.expires_at > now,
        )
        .order_by(AiCauseAnalysisV2.created_at.desc(), AiCauseAnalysisV2.id.desc())
    )


def list_cause_tags_response(session: Session) -> CauseTagListResponseV2:
    rows = list(
        session.scalars(
            select(CauseTagV2)
            .where(CauseTagV2.is_active.is_(True))
            .order_by(CauseTagV2.display_order.asc(), CauseTagV2.id.asc())
        )
    )
    items = [
        CauseTagItemV2(
            id=row.id,
            slug=row.slug,
            name=row.name,
            category=row.category,
            severity_default=row.severity_default,
            description=row.description,
            display_order=row.display_order,
            is_active=row.is_active,
            taxonomy_version=row.taxonomy_version,
        )
        for row in rows
    ]
    return CauseTagListResponseV2(items=items, total=len(items))
