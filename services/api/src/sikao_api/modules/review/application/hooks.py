from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.enums_v2 import ReviewSourceKind
from sikao_api.db.models_v2 import PracticeSessionAnswerV2, PracticeSessionV2, ReviewItemV2
from sikao_api.modules.review.application.queue_items import (
    create_review_item,
    load_questions_by_id,
    upsert_wrong_answer_review_item,
    utc_now,
)
from sikao_api.modules.system.application.errors import NotFoundError


def run_review_submit_hooks(
    session: Session,
    *,
    user_id: int,
    session_id: int,
) -> None:
    practice_session = session.scalar(
        select(PracticeSessionV2).where(
            PracticeSessionV2.id == session_id,
            PracticeSessionV2.user_id == user_id,
        )
    )
    if practice_session is None:
        raise NotFoundError("practice session not found", code="practice_session_not_found")
    wrong_answers = list(
        session.scalars(
            select(PracticeSessionAnswerV2).where(
                PracticeSessionAnswerV2.session_id == practice_session.id,
                PracticeSessionAnswerV2.question_id.is_not(None),
                PracticeSessionAnswerV2.is_correct.is_(False),
            )
        )
    )
    question_ids = {
        int(answer.question_id)
        for answer in wrong_answers
        if answer.question_id is not None
    }
    questions_by_id = load_questions_by_id(session, question_ids=question_ids)

    if practice_session.source_mode != "wrong_redo":
        for question_id in sorted(question_ids):
            question = questions_by_id.get(question_id)
            if question is None:
                continue
            upsert_wrong_answer_review_item(
                session,
                user_id=user_id,
                question=question,
                source_session_id=practice_session.id,
            )

    for question_id in sorted(question_ids):
        question = questions_by_id.get(question_id)
        if question is None:
            continue
        anchor = session.scalar(
            select(ReviewItemV2)
            .where(
                ReviewItemV2.user_id == user_id,
                ReviewItemV2.question_id == question_id,
                ReviewItemV2.status.in_(("graduated", "probationary")),
            )
            .order_by(ReviewItemV2.updated_at.desc(), ReviewItemV2.id.desc())
        )
        if anchor is None:
            continue
        existing = session.scalar(
            select(ReviewItemV2)
            .where(
                ReviewItemV2.user_id == user_id,
                ReviewItemV2.question_id == question_id,
                ReviewItemV2.source_kind == ReviewSourceKind.RE_FAILED.value,
                ReviewItemV2.source_id == practice_session.id,
            )
            .order_by(ReviewItemV2.id.desc())
        )
        if existing is not None:
            continue
        create_review_item(
            session,
            user_id=user_id,
            question_id=question_id,
            source_kind=ReviewSourceKind.RE_FAILED.value,
            source_id=practice_session.id,
            title=question.prompt,
            metadata_json={
                "originalReviewItemId": anchor.id,
                "sourceSessionId": practice_session.id,
                "firstSeenAt": utc_now().isoformat(),
                "triggeredFromStatus": anchor.status,
            },
            reason=None,
        )
