from __future__ import annotations

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeSessionAnswerV2, PracticeSessionV2, QuestionV2
from sikao_api.modules.practice_stats.application.facts import (
    PracticeStatFact,
    difficulty_bucket_from_accuracy,
)


def load_xingce_facts(session: Session, *, user_id: int) -> list[PracticeStatFact]:
    rows = session.execute(
        select(PracticeSessionV2, PracticeSessionAnswerV2, QuestionV2)
        .join(PracticeSessionAnswerV2, PracticeSessionAnswerV2.session_id == PracticeSessionV2.id)
        .join(QuestionV2, QuestionV2.id == PracticeSessionAnswerV2.question_id)
        .where(
            PracticeSessionV2.user_id == user_id,
            PracticeSessionV2.track == "xingce",
            PracticeSessionV2.status == "submitted",
            PracticeSessionV2.submitted_at.is_not(None),
        )
    ).all()
    by_session: dict[int, list[tuple[PracticeSessionV2, PracticeSessionAnswerV2, QuestionV2]]] = defaultdict(list)
    for practice_session, answer, question in rows:
        by_session[practice_session.id].append((practice_session, answer, question))

    facts: list[PracticeStatFact] = []
    for session_rows in by_session.values():
        practice_session = session_rows[0][0]
        duration_minutes = max(
            0.0,
            ((practice_session.submitted_at or practice_session.started_at) - practice_session.started_at).total_seconds() / 60,
        )
        session_answer_count = len(session_rows)
        duration_share = duration_minutes / session_answer_count if session_answer_count > 0 else 0.0
        for _, answer, question in session_rows:
            facts.append(
                PracticeStatFact(
                    type="xingce",
                    attempt_id=practice_session.id,
                    practiced_at=answer.answered_at,
                    category_l1=question.category_l1,
                    category_l2=question.category_l2,
                    difficulty=difficulty_bucket_from_accuracy(question.historical_accuracy),
                    total_questions=1,
                    correct_count=1 if answer.is_correct is True else 0,
                    graded_count=1 if answer.is_correct is not None else 0,
                    score_value=None,
                    total_minutes=duration_share,
                )
            )
    return facts
