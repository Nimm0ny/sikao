from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import case, delete, func, select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeSessionAnswerV2, PracticeSessionV2, PracticeStatsSnapshotV2, QuestionV2, UserV2
from sikao_api.modules.ai_questions.application.feedback import refresh_ai_question_quality
from sikao_api.modules.practice_stats.application.cells import build_stats_response
from sikao_api.modules.practice_stats.application.loaders import load_practice_facts
from sikao_api.modules.practice_stats.interface.schemas import PracticeStatsResponseV2


def recompute_user_stats(session: Session, *, user_id: int) -> list[PracticeStatsSnapshotV2]:
    rows: list[PracticeStatsSnapshotV2] = []
    existing_bucket_keys = {
        (row.type, row.scope, row.category_key)
        for row in session.scalars(
            select(PracticeStatsSnapshotV2).where(PracticeStatsSnapshotV2.user_id == user_id)
        )
    }
    session.execute(delete(PracticeStatsSnapshotV2).where(PracticeStatsSnapshotV2.user_id == user_id))
    for type_name in ("xingce", "essay"):
        response = build_stats_response(type_name=type_name, facts=load_practice_facts(session, user_id=user_id, type_name=type_name))
        rows.extend(_snapshot_rows(user_id=user_id, response=response))
    for row in rows:
        session.add(row)
    session.flush()
    _refresh_snapshot_percentiles(session, rows=rows, existing_bucket_keys=existing_bucket_keys)
    return rows


def incremental_update(session: Session, *, user_id: int, session_id: int) -> list[PracticeStatsSnapshotV2]:
    _refresh_question_quality_metrics(session, session_id=session_id)
    return recompute_user_stats(session, user_id=user_id)


def recompute_all_user_stats(session: Session) -> int:
    user_ids = list(session.scalars(select(UserV2.id).where(UserV2.is_active.is_(True))))
    for user_id in user_ids:
        recompute_user_stats(session, user_id=user_id)
    return len(user_ids)


def _snapshot_rows(*, user_id: int, response: PracticeStatsResponseV2) -> list[PracticeStatsSnapshotV2]:
    return [
        PracticeStatsSnapshotV2(
            user_id=user_id,
            scope=scope,
            category_key=cell.category_key,
            type=response.type,
            total_questions=cell.total_questions,
            correct_count=cell.correct_count,
            accuracy=cell.accuracy,
            total_sessions=cell.total_sessions,
            total_minutes=cell.total_minutes,
            average_score=cell.average_score,
            recent_trend=[point.model_dump(mode="json") for point in cell.recent_trend],
            last_practiced_at=cell.last_practiced_at,
            percentile_rank=cell.percentile_rank,
        )
        for scope, cells in {
            "overall": [response.overall],
            "category_l1": response.by_category_l1,
            "category_l2": response.by_category_l2,
        }.items()
        for cell in cells
    ]


def _refresh_snapshot_percentiles(
    session: Session,
    *,
    rows: list[PracticeStatsSnapshotV2],
    existing_bucket_keys: set[tuple[str, str, str | None]],
) -> None:
    bucket_keys = existing_bucket_keys | {
        (row.type, row.scope, row.category_key)
        for row in rows
    }
    refresh_percentile_buckets(session, bucket_keys=bucket_keys)


def refresh_percentile_buckets(
    session: Session,
    *,
    bucket_keys: set[tuple[str, str, str | None]],
) -> None:
    updated_at = datetime.now(UTC).replace(tzinfo=None)
    for type_name, scope, category_key in bucket_keys:
        peers = list(
            session.scalars(
                select(PracticeStatsSnapshotV2).where(
                    PracticeStatsSnapshotV2.type == type_name,
                    PracticeStatsSnapshotV2.scope == scope,
                    PracticeStatsSnapshotV2.category_key == category_key,
                )
            )
        )
        ranked_peers = [row for row in peers if row.total_questions > 0]
        if not ranked_peers:
            for row in peers:
                row.percentile_rank = None
                row.percentile_updated_at = None
                session.add(row)
            continue
        accuracies = [row.accuracy for row in ranked_peers]
        for row in peers:
            if row.total_questions <= 0:
                row.percentile_rank = None
                row.percentile_updated_at = None
            else:
                rank = sum(1 for value in accuracies if value <= row.accuracy) / len(accuracies)
                row.percentile_rank = round(rank, 4)
                row.percentile_updated_at = updated_at
            session.add(row)


def _refresh_question_quality_metrics(session: Session, *, session_id: int) -> None:
    question_ids = list(
        session.scalars(
            select(PracticeSessionAnswerV2.question_id).where(
                PracticeSessionAnswerV2.session_id == session_id,
                PracticeSessionAnswerV2.question_id.is_not(None),
            )
        )
    )
    for question_id in set(question_ids):
        if question_id is None:
            continue
        total, correct, graded = session.execute(
            select(
                func.count(PracticeSessionAnswerV2.id),
                func.sum(case((PracticeSessionAnswerV2.is_correct.is_(True), 1), else_=0)),
                func.sum(case((PracticeSessionAnswerV2.is_correct.is_not(None), 1), else_=0)),
            )
            .join(PracticeSessionV2, PracticeSessionV2.id == PracticeSessionAnswerV2.session_id)
            .where(PracticeSessionAnswerV2.question_id == question_id, PracticeSessionV2.status == "submitted")
        ).one()
        question = session.get(QuestionV2, question_id)
        if question is None:
            continue
        question.answer_count = int(total or 0)
        question.historical_accuracy = float((correct or 0) / (graded or 1)) if graded else 0.0
        refresh_ai_question_quality(session, question=question)
        session.add(question)
