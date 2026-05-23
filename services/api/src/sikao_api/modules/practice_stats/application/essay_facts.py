from __future__ import annotations

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import EssayReportV2, EssaySubmissionV2, PracticeSessionV2, QuestionV2
from sikao_api.modules.practice_stats.application.facts import (
    PracticeStatFact,
    difficulty_bucket_from_accuracy,
)


def load_essay_facts(session: Session, *, user_id: int) -> list[PracticeStatFact]:
    session_minutes = {
        row.id: max(
            0.0,
            ((row.submitted_at or row.started_at) - row.started_at).total_seconds() / 60,
        )
        for row in session.scalars(
            select(PracticeSessionV2).where(PracticeSessionV2.user_id == user_id)
        )
    }
    rows = session.execute(
        select(EssaySubmissionV2, EssayReportV2, QuestionV2)
        .outerjoin(EssayReportV2, EssayReportV2.submission_id == EssaySubmissionV2.id)
        .join(QuestionV2, QuestionV2.id == EssaySubmissionV2.question_id)
        .where(
            EssaySubmissionV2.user_id == user_id,
            EssayReportV2.status == "completed",
            EssayReportV2.score.is_not(None),
        )
    ).all()
    per_attempt_counts: dict[int, int] = defaultdict(int)
    for submission, _, _ in rows:
        per_attempt_counts[submission.practice_session_id or submission.id] += 1
    return [
        PracticeStatFact(
            type="essay",
            attempt_id=submission.practice_session_id or submission.id,
            practiced_at=submission.submitted_at,
            category_l1=question.category_l1,
            category_l2=question.category_l2,
            difficulty=difficulty_bucket_from_accuracy(question.historical_accuracy),
            total_questions=1,
            correct_count=0,
            graded_count=1,
            score_value=float(report.score),
            total_minutes=session_minutes.get(submission.practice_session_id or -1, 0.0)
            / per_attempt_counts[submission.practice_session_id or submission.id],
        )
        for submission, report, question in rows
        if report is not None and report.score is not None
    ]
