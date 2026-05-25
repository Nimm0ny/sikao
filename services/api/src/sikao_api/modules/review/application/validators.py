from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from sikao_api.db.enums_v2 import ReviewItemStatus, ReviewSourceKind
from sikao_api.db.models_v2 import QuestionV2, ReviewItemV2
from sikao_api.modules.system.application.errors import ConflictError, NotFoundError, ValidationError


_ALLOWED_ORDER_BY = {"created_at", "next_review_at", "correct_streak"}
_ALLOWED_ORDER_DIR = {"asc", "desc"}
_ALLOWED_STATUSES = {
    ReviewItemStatus.PENDING.value,
    ReviewItemStatus.IN_PROGRESS.value,
    ReviewItemStatus.PROBATIONARY.value,
    ReviewItemStatus.GRADUATED.value,
    ReviewItemStatus.ARCHIVED.value,
}
_ALLOWED_SOURCE_KINDS = {
    ReviewSourceKind.WRONG_ANSWER.value,
    ReviewSourceKind.FLAGGED_PERSISTENT.value,
    ReviewSourceKind.RE_FAILED.value,
    ReviewSourceKind.MANUAL_ADD.value,
    ReviewSourceKind.NOTE_CARD.value,
}


@dataclass(frozen=True)
class ReviewListFilters:
    statuses: tuple[str, ...]
    source_kinds: tuple[str, ...]
    question_id: int | None
    page: int
    page_size: int
    order_by: str
    order_dir: str


def parse_review_list_filters(
    *,
    status: str | None,
    source_kind: str | None,
    question_id: int | None,
    page: int,
    page_size: int,
    order_by: str,
    order_dir: str,
) -> ReviewListFilters:
    if page < 1:
        raise ValidationError("page must be >= 1", code="review_page_invalid")
    if not 1 <= page_size <= 100:
        raise ValidationError("page_size must be between 1 and 100", code="review_page_size_invalid")
    if order_by not in _ALLOWED_ORDER_BY:
        raise ValidationError("invalid review order_by", code="review_order_by_invalid")
    if order_dir not in _ALLOWED_ORDER_DIR:
        raise ValidationError("invalid review order_dir", code="review_order_dir_invalid")
    statuses = _parse_csv_values(status, allowed=_ALLOWED_STATUSES, field_name="status")
    source_kinds = _parse_csv_values(
        source_kind,
        allowed=_ALLOWED_SOURCE_KINDS,
        field_name="source_kind",
    )
    return ReviewListFilters(
        statuses=statuses,
        source_kinds=source_kinds,
        question_id=question_id,
        page=page,
        page_size=page_size,
        order_by=order_by,
        order_dir=order_dir,
    )


def validate_manual_add_target(
    session: Session,
    *,
    user_id: int,
    question_id: int,
) -> QuestionV2:
    question = session.get(QuestionV2, question_id)
    if question is None:
        raise NotFoundError("question not found", code="question_not_found")
    duplicate = session.scalar(
        select(ReviewItemV2.id).where(
            ReviewItemV2.user_id == user_id,
            ReviewItemV2.question_id == question_id,
            ReviewItemV2.status.in_(
                (
                    ReviewItemStatus.PENDING.value,
                    ReviewItemStatus.IN_PROGRESS.value,
                    ReviewItemStatus.PROBATIONARY.value,
                )
            ),
        )
    )
    if duplicate is not None:
        raise ConflictError(
            "review item already active for this question",
            code="review_item_already_active",
    )
    return question


def validate_review_item_source_contract(
    *,
    source_kind: str,
    question_id: int | None,
    metadata_json: dict[str, object],
) -> None:
    source_note_id = metadata_json.get("source_note_id") or metadata_json.get("sourceNoteId")
    if source_kind == ReviewSourceKind.NOTE_CARD.value:
        if source_note_id is None:
            raise ValidationError(
                "note_card review items require metadata_json.source_note_id",
                code="review_source_contract_invalid",
            )
        return
    if question_id is None:
        raise ValidationError(
            "non-note review items require question_id",
            code="review_source_contract_invalid",
        )
    if source_note_id is not None:
        raise ValidationError(
            "non-note review items cannot carry metadata_json.source_note_id",
            code="review_source_contract_invalid",
        )


def review_status_clause(statuses: tuple[str, ...]) -> Any:
    if not statuses:
        return ReviewItemV2.status.in_(
            (
                ReviewItemStatus.PENDING.value,
                ReviewItemStatus.IN_PROGRESS.value,
                ReviewItemStatus.PROBATIONARY.value,
            )
        )
    resolved: list[Any] = []
    canonical_statuses = [status for status in statuses if status != ReviewItemStatus.ARCHIVED.value]
    if canonical_statuses:
        resolved.append(ReviewItemV2.status.in_(tuple(canonical_statuses)))
    if ReviewItemStatus.ARCHIVED.value in statuses:
        resolved.append(ReviewItemV2.status.in_(("archived", "resolved", "removed")))
    if len(resolved) == 1:
        return resolved[0]
    return or_(*resolved)


def review_source_clause(source_kinds: tuple[str, ...]) -> Any:
    if not source_kinds:
        return None
    resolved: list[Any] = []
    remaining = [kind for kind in source_kinds if kind != ReviewSourceKind.FLAGGED_PERSISTENT.value]
    if remaining:
        resolved.append(ReviewItemV2.source_kind.in_(tuple(remaining)))
    if ReviewSourceKind.FLAGGED_PERSISTENT.value in source_kinds:
        resolved.append(
            or_(
                ReviewItemV2.source_kind.in_(("flagged_persistent", "question_flag")),
                ReviewItemV2.reason == "flagged_persistent",
            )
        )
    if len(resolved) == 1:
        return resolved[0]
    return or_(*resolved)


def _parse_csv_values(
    raw_value: str | None,
    *,
    allowed: set[str],
    field_name: str,
) -> tuple[str, ...]:
    if raw_value is None or raw_value.strip() == "":
        return ()
    values = tuple(part.strip() for part in raw_value.split(",") if part.strip())
    invalid = sorted({value for value in values if value not in allowed})
    if invalid:
        raise ValidationError(
            f"invalid {field_name}: " + ", ".join(invalid),
            code=f"review_{field_name}_invalid",
        )
    return values
