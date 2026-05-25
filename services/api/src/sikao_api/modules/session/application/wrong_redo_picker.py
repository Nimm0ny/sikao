from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import QuestionV2, ReviewItemV2
from sikao_api.modules.system.application.errors import NotFoundError, ValidationError


def pick_wrong_redo_questions(
    session: Session,
    *,
    user_id: int,
    track: str,
    config: dict[str, Any],
) -> tuple[list[QuestionV2], dict[str, Any]]:
    configured_review_item_ids = _parse_review_item_ids(config.get("review_item_ids"))
    if configured_review_item_ids:
        return _pick_configured_review_items(
            session,
            user_id=user_id,
            track=track,
            review_item_ids=configured_review_item_ids,
        )
    count = int(config.get("count", 10))
    if count <= 0:
        raise ValidationError("count must be > 0", code="practice_session_bad_count")
    rows = list(
        session.scalars(
            select(ReviewItemV2)
            .join(QuestionV2, QuestionV2.id == ReviewItemV2.question_id)
            .where(
                ReviewItemV2.user_id == user_id,
                ReviewItemV2.status == "pending",
                ReviewItemV2.question_id.is_not(None),
                QuestionV2.subject_kind == track,
            )
            .order_by(ReviewItemV2.updated_at.asc(), ReviewItemV2.created_at.asc(), ReviewItemV2.id.asc())
        )
    )
    selected_review_items: list[ReviewItemV2] = []
    seen_question_ids: set[int] = set()
    for row in rows:
        assert row.question_id is not None
        question_id = int(row.question_id)
        if question_id in seen_question_ids:
            continue
        selected_review_items.append(row)
        seen_question_ids.add(question_id)
        if len(selected_review_items) == count:
            break
    if len(selected_review_items) != count:
        raise NotFoundError("not enough review items", code="review_item_not_enough")
    question_ids = [int(row.question_id) for row in selected_review_items if row.question_id is not None]
    questions_by_id = {
        question.id: question
        for question in session.scalars(select(QuestionV2).where(QuestionV2.id.in_(question_ids)))
    }
    questions = [questions_by_id[question_id] for question_id in question_ids if question_id in questions_by_id]
    if len(questions) != len(question_ids):
        raise NotFoundError("review question missing", code="review_item_question_missing")
    return questions, {"review_item_ids": [row.id for row in selected_review_items], "question_ids": question_ids, "count": count}


def _parse_review_item_ids(raw: Any) -> list[int]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ValidationError("review_item_ids must be a list", code="practice_session_bad_review_items")
    review_item_ids: list[int] = []
    seen: set[int] = set()
    for value in raw:
        try:
            item_id = int(value)
        except (TypeError, ValueError) as exc:
            raise ValidationError("review_item_ids must contain integers", code="practice_session_bad_review_items") from exc
        if item_id in seen:
            continue
        seen.add(item_id)
        review_item_ids.append(item_id)
    if not review_item_ids:
        raise ValidationError("review_item_ids must not be empty", code="practice_session_bad_review_items")
    return review_item_ids


def _pick_configured_review_items(
    session: Session,
    *,
    user_id: int,
    track: str,
    review_item_ids: list[int],
) -> tuple[list[QuestionV2], dict[str, Any]]:
    rows = list(
        session.scalars(
            select(ReviewItemV2)
            .join(QuestionV2, QuestionV2.id == ReviewItemV2.question_id)
            .where(
                ReviewItemV2.user_id == user_id,
                ReviewItemV2.id.in_(review_item_ids),
                ReviewItemV2.status.in_(("pending", "in_progress", "probationary")),
                ReviewItemV2.question_id.is_not(None),
                QuestionV2.subject_kind == track,
            )
        )
    )
    rows_by_id = {row.id: row for row in rows}
    if len(rows_by_id) != len(review_item_ids):
        raise NotFoundError("review item missing", code="review_item_not_found")

    selected_review_items: list[ReviewItemV2] = []
    selected_question_ids: list[int] = []
    seen_question_ids: set[int] = set()
    for item_id in review_item_ids:
        row = rows_by_id[item_id]
        assert row.question_id is not None
        question_id = int(row.question_id)
        selected_review_items.append(row)
        if question_id in seen_question_ids:
            continue
        seen_question_ids.add(question_id)
        selected_question_ids.append(question_id)

    questions_by_id = {
        question.id: question
        for question in session.scalars(select(QuestionV2).where(QuestionV2.id.in_(selected_question_ids)))
    }
    questions = [questions_by_id[question_id] for question_id in selected_question_ids if question_id in questions_by_id]
    if len(questions) != len(selected_question_ids):
        raise NotFoundError("review question missing", code="review_item_question_missing")
    return (
        questions,
        {
            "review_item_ids": [row.id for row in selected_review_items],
            "question_ids": selected_question_ids,
            "count": len(selected_question_ids),
            "shuffle_options": True,
        },
    )
