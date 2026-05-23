from __future__ import annotations

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeSessionAnswerV2, PracticeSessionV2, QuestionV2
from sikao_api.modules.ai_questions.application.feedback import refresh_ai_question_quality


def recompute_question_accuracy(session: Session) -> int:
    rows = session.execute(
        select(
            PracticeSessionAnswerV2.question_id.label("question_id"),
            func.count(PracticeSessionAnswerV2.id).label("answer_count"),
            func.sum(
                case((PracticeSessionAnswerV2.is_correct.is_(True), 1), else_=0)
            ).label("correct_count"),
            func.sum(
                case((PracticeSessionAnswerV2.is_correct.is_not(None), 1), else_=0)
            ).label("graded_count"),
        )
        .join(PracticeSessionV2, PracticeSessionV2.id == PracticeSessionAnswerV2.session_id)
        .where(
            PracticeSessionV2.status == "submitted",
            PracticeSessionAnswerV2.question_id.is_not(None),
        )
        .group_by(PracticeSessionAnswerV2.question_id)
    ).all()
    if not rows:
        return 0

    question_ids = [int(row.question_id) for row in rows if row.question_id is not None]
    questions = {
        question.id: question
        for question in session.scalars(
            select(QuestionV2)
            .where(QuestionV2.id.in_(question_ids))
            .with_for_update()
        )
    }

    updated = 0
    for row in rows:
        question_id = row.question_id
        if question_id is None:
            continue
        question = questions.get(int(question_id))
        if question is None:
            continue
        answer_count = int(row.answer_count or 0)
        graded_count = int(row.graded_count or 0)
        correct_count = int(row.correct_count or 0)
        question.answer_count = answer_count
        question.historical_accuracy = (
            float(correct_count / graded_count) if graded_count > 0 else 0.0
        )
        refresh_ai_question_quality(session, question=question)
        session.add(question)
        updated += 1
    session.flush()
    return updated

