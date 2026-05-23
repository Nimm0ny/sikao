from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import EssayReportV2, EssaySubmissionV2, PaperRevisionV2, PaperV2, PracticeSessionAnswerV2, PracticeSessionV2, QuestionV2, UserV2
from sikao_api.db.schemas_v2 import MockExamAggregate, MockExamComparisonResponseV2, MockExamCreateRequestV2, MockExamCreateResponseV2, MockExamHistoryItem, MockExamHistoryResponseV2
from sikao_api.modules.mock_exam.domain.errors import PAPER_NOT_FOUND, PAPER_NOT_MOCK_ELIGIBLE
from sikao_api.modules.mock_exam.domain.types import DEFAULT_ESSAY_TIME_LIMIT_MINUTES, DEFAULT_XINGCE_TIME_LIMIT_MINUTES, MIN_MOCK_EXAM_QUESTION_COUNT
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.modules.system.application.errors import NotFoundError, ValidationError


def create_mock_exam(
    session: Session,
    *,
    user: UserV2,
    payload: MockExamCreateRequestV2,
    request_id: str | None,
    idempotency_key: str,
) -> MockExamCreateResponseV2:
    paper = session.scalar(select(PaperV2).where(PaperV2.paper_code == payload.paper_code))
    if paper is None:
        raise ValidationError("paper not found", code=PAPER_NOT_FOUND)

    revision = session.scalar(
        select(PaperRevisionV2)
        .where(
            PaperRevisionV2.paper_id == paper.id,
            PaperRevisionV2.status == "published",
        )
        .order_by(PaperRevisionV2.revision_number.desc(), PaperRevisionV2.id.desc())
    )
    if revision is None:
        raise ValidationError("paper not found", code=PAPER_NOT_FOUND)

    questions = list(
        session.scalars(
            select(QuestionV2)
            .where(QuestionV2.revision_id == revision.id)
            .order_by(QuestionV2.item_no.asc(), QuestionV2.id.asc())
        )
    )
    if len(questions) < MIN_MOCK_EXAM_QUESTION_COUNT:
        raise ValidationError(
            "paper is not eligible for mock exam",
            code=PAPER_NOT_MOCK_ELIGIBLE,
        )

    resolved_time_limit = payload.time_limit_minutes or _default_time_limit_minutes(paper.subject_kind)
    created_at = datetime.now(UTC).replace(tzinfo=None)
    practice_session = PracticeSessionV2(
        user_id=user.id,
        track=paper.subject_kind,
        entry_kind="mock_exam",
        status="draft",
        paper_id=paper.id,
        revision_id=revision.id,
        payload_json={},
        started_at=created_at,
        practice_mode="full_set",
        source_mode="paper",
        config_snapshot={
            "mock_exam": {
                "delayed_review_minutes": payload.delayed_review_minutes,
            }
        },
        exam_mode=True,
        time_limit_minutes=resolved_time_limit,
        allow_review_during=False,
        allow_pause=False,
        delayed_review_until=None,
    )
    session.add(practice_session)
    session.flush()

    for display_order, question in enumerate(questions, start=1):
        session.add(
            PracticeSessionAnswerV2(
                session_id=practice_session.id,
                question_id=question.id,
                question_key=str(question.id),
                display_order=display_order,
                response_json={},
            )
        )

    add_audit_log(
        session,
        user_id=user.id,
        actor_type="user",
        actor_id=str(user.id),
        action="mock_exam.created",
        target_type="practice_session_v2",
        target_id=practice_session.id,
        after={
            "paper_code": paper.paper_code,
            "time_limit_minutes": resolved_time_limit,
            "delayed_review_minutes": payload.delayed_review_minutes,
        },
        metadata={"idempotency_key": idempotency_key},
        request_id=request_id,
        ip=None,
    )
    session.flush()
    return MockExamCreateResponseV2(
        session_id=practice_session.id,
        paper_code=paper.paper_code,
        time_limit_minutes=resolved_time_limit,
        auto_submit_at=practice_session.auto_submit_at,
        expires_at=practice_session.expires_at,
        status=practice_session.status,
    )


def _default_time_limit_minutes(track: str) -> int:
    if track == "essay":
        return DEFAULT_ESSAY_TIME_LIMIT_MINUTES
    return DEFAULT_XINGCE_TIME_LIMIT_MINUTES


def list_mock_exam_history(
    session: Session,
    *,
    user: UserV2,
    period: str,
    paper_code: str | None,
) -> MockExamHistoryResponseV2:
    rows = _load_mock_exam_sessions(session, user=user, period=period, paper_code=paper_code)
    items = [_serialize_mock_exam_item(session, row) for row in rows]
    accuracies = [item.accuracy for item in items]
    return MockExamHistoryResponseV2(
        sessions=items,
        aggregate=MockExamAggregate(
            total_count=len(items),
            best_accuracy=max(accuracies) if accuracies else 0.0,
            best_session_id=_best_session_id(items),
            avg_accuracy=(sum(accuracies) / len(accuracies)) if accuracies else 0.0,
            improvement_trend=_compute_improvement_trend(items),
        ),
    )


def build_mock_exam_comparison(
    session: Session,
    *,
    user: UserV2,
    session_id: int,
) -> MockExamComparisonResponseV2:
    current = session.scalar(
        select(PracticeSessionV2).where(
            PracticeSessionV2.id == session_id,
            PracticeSessionV2.user_id == user.id,
            PracticeSessionV2.exam_mode.is_(True),
        )
    )
    if current is None:
        raise NotFoundError("mock exam not found", code="NOT_MOCK_EXAM")
    current_item = _serialize_mock_exam_item(session, current)
    history_rows = list(
        session.scalars(
            select(PracticeSessionV2)
            .where(
                PracticeSessionV2.user_id == user.id,
                PracticeSessionV2.exam_mode.is_(True),
                PracticeSessionV2.paper_id == current.paper_id,
                PracticeSessionV2.id != current.id,
                PracticeSessionV2.status == "submitted",
                PracticeSessionV2.submitted_at.is_not(None),
                PracticeSessionV2.submitted_at < (current.submitted_at or current.started_at),
            )
            .order_by(PracticeSessionV2.submitted_at.desc(), PracticeSessionV2.id.desc())
            .limit(5)
        )
    )
    return MockExamComparisonResponseV2(
        self=current_item,
        self_history=[_serialize_mock_exam_item(session, row) for row in history_rows],
        paper_baseline={},
    )


def _load_mock_exam_sessions(
    session: Session,
    *,
    user: UserV2,
    period: str,
    paper_code: str | None,
) -> list[PracticeSessionV2]:
    query = select(PracticeSessionV2).where(
        PracticeSessionV2.user_id == user.id,
        PracticeSessionV2.exam_mode.is_(True),
        PracticeSessionV2.status == "submitted",
        PracticeSessionV2.submitted_at.is_not(None),
    )
    if paper_code is not None:
        paper = session.scalar(select(PaperV2).where(PaperV2.paper_code == paper_code))
        if paper is None:
            return []
        query = query.where(PracticeSessionV2.paper_id == paper.id)
    cutoff = _resolve_period_cutoff(period)
    if cutoff is not None:
        query = query.where(PracticeSessionV2.submitted_at >= cutoff)
    return list(
        session.scalars(
            query.order_by(PracticeSessionV2.submitted_at.desc(), PracticeSessionV2.id.desc())
        )
    )


def _resolve_period_cutoff(period: str) -> datetime | None:
    now = datetime.now(UTC).replace(tzinfo=None)
    if period == "30d":
        return now - timedelta(days=30)
    if period == "90d":
        return now - timedelta(days=90)
    if period == "all":
        return None
    raise ValidationError("unsupported history period", code="validation_error")


def _serialize_mock_exam_item(session: Session, practice_session: PracticeSessionV2) -> MockExamHistoryItem:
    score_value = _score_for_session(session, practice_session)
    if practice_session.track == "essay":
        accuracy = round((score_value or 0.0) / 100, 4)
    else:
        accuracy = _accuracy_for_session(session, practice_session)
    paper_code = session.scalar(select(PaperV2.paper_code).where(PaperV2.id == practice_session.paper_id))
    rank_in_self = _rank_in_self(session, practice_session=practice_session)
    return MockExamHistoryItem(
        session_id=practice_session.id,
        paper_code=paper_code or "",
        completed_at=practice_session.submitted_at or practice_session.started_at,
        time_limit_minutes=practice_session.time_limit_minutes or 0,
        actual_active_seconds=practice_session.total_active_seconds,
        accuracy=accuracy,
        total_score=score_value,
        is_force_submitted=practice_session.force_submitted,
        rank_in_self=rank_in_self,
    )


def _rank_in_self(session: Session, *, practice_session: PracticeSessionV2) -> int | None:
    if practice_session.paper_id is None:
        return None
    rows = list(
        session.scalars(
            select(PracticeSessionV2).where(
                PracticeSessionV2.user_id == practice_session.user_id,
                PracticeSessionV2.paper_id == practice_session.paper_id,
                PracticeSessionV2.exam_mode.is_(True),
                PracticeSessionV2.status == "submitted",
                PracticeSessionV2.submitted_at.is_not(None),
            )
        )
    )
    if not rows:
        return None
    ranking = sorted(
        (
            (
                row.id,
                _metric_for_session(session, row),
                row.submitted_at or row.started_at,
            )
            for row in rows
        ),
        key=lambda item: (-item[1], item[2], item[0]),
    )
    for index, (session_id, _, _) in enumerate(ranking, start=1):
        if session_id == practice_session.id:
            return index
    return None


def _accuracy_for_session(session: Session, practice_session: PracticeSessionV2) -> float:
    answers = list(
        session.scalars(
            select(PracticeSessionAnswerV2).where(
                PracticeSessionAnswerV2.session_id == practice_session.id
            )
        )
    )
    if not answers:
        return 0.0
    correct_answers = sum(1 for answer in answers if answer.is_correct is True)
    return correct_answers / len(answers)


def _metric_for_session(session: Session, practice_session: PracticeSessionV2) -> float:
    score = _score_for_session(session, practice_session)
    if practice_session.track == "essay":
        return round((score or 0.0) / 100, 4)
    return _accuracy_for_session(session, practice_session)


def _score_for_session(session: Session, practice_session: PracticeSessionV2) -> float | None:
    if practice_session.track != "essay":
        return None
    scores = [
        float(score)
        for score in session.scalars(
            select(EssayReportV2.score)
            .join(EssaySubmissionV2, EssaySubmissionV2.id == EssayReportV2.submission_id)
            .where(
                EssaySubmissionV2.practice_session_id == practice_session.id,
                EssayReportV2.status == "completed",
                EssayReportV2.score.is_not(None),
            )
        )
        if isinstance(score, Decimal | float | int)
    ]
    if not scores:
        return None
    return round(sum(scores) / len(scores), 2)


def _best_session_id(items: list[MockExamHistoryItem]) -> int | None:
    if not items:
        return None
    return max(items, key=lambda item: (item.accuracy, -item.session_id)).session_id


def _compute_improvement_trend(items: list[MockExamHistoryItem]) -> float:
    if len(items) < 2:
        return 0.0
    recent = items[:5]
    older = items[5:10]
    if not older:
        return 0.0
    recent_avg = sum(item.accuracy for item in recent) / len(recent)
    older_avg = sum(item.accuracy for item in older) / len(older)
    return recent_avg - older_avg
