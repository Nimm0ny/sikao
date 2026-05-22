from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeSessionAnswerV2, PracticeSessionV2


@dataclass(frozen=True)
class PaperCompletionMetrics:
    paper_id: int
    last_attempt_at: datetime | None
    best_score: float | None


def load_paper_completion_metrics(
    session: Session,
    *,
    user_id: int,
) -> dict[int, PaperCompletionMetrics]:
    """Return per-paper completion metrics for submitted sessions.

    `best_score` uses the currently available `is_correct` signal. When a paper
    has submitted sessions but none of its answers have been scored yet, the
    value stays `None` instead of fabricating a number.
    """

    answer_score = case(
        (PracticeSessionAnswerV2.is_correct.is_(True), 100.0),
        (PracticeSessionAnswerV2.is_correct.is_(False), 0.0),
        else_=None,
    )

    session_scores = (
        select(
            PracticeSessionV2.paper_id.label("paper_id"),
            PracticeSessionV2.id.label("session_id"),
            PracticeSessionV2.submitted_at.label("submitted_at"),
            func.avg(answer_score).label("session_score"),
        )
        .outerjoin(
            PracticeSessionAnswerV2,
            PracticeSessionAnswerV2.session_id == PracticeSessionV2.id,
        )
        .where(
            PracticeSessionV2.user_id == user_id,
            PracticeSessionV2.paper_id.is_not(None),
            PracticeSessionV2.status == "submitted",
            PracticeSessionV2.submitted_at.is_not(None),
        )
        .group_by(
            PracticeSessionV2.paper_id,
            PracticeSessionV2.id,
            PracticeSessionV2.submitted_at,
        )
        .subquery()
    )

    latest_attempts = (
        select(
            session_scores.c.paper_id,
            func.max(session_scores.c.submitted_at).label("last_attempt_at"),
            func.max(session_scores.c.session_score).label("best_score"),
        )
        .group_by(session_scores.c.paper_id)
    )

    metrics: dict[int, PaperCompletionMetrics] = {}
    for row in session.execute(latest_attempts).all():
        if row.paper_id is None:
            continue
        metrics[int(row.paper_id)] = PaperCompletionMetrics(
            paper_id=int(row.paper_id),
            last_attempt_at=row.last_attempt_at,
            best_score=float(row.best_score) if row.best_score is not None else None,
        )
    return metrics


def build_submitted_session_exists_clause(*, user_id: int):
    return (
        select(PracticeSessionV2.id)
        .where(
            PracticeSessionV2.user_id == user_id,
            PracticeSessionV2.paper_id.is_not(None),
            PracticeSessionV2.status == "submitted",
        )
        .exists()
    )
