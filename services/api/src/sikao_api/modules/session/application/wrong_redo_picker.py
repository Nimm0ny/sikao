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
