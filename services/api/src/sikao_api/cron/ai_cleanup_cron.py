from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import AuditLogV2, QuestionReportV2, QuestionV2
from sikao_api.modules.ai_questions.application.feedback import recompute_quality_score
from sikao_api.modules.question_reports.domain.types import (
    ACTIVE_QUESTION_REPORT_STATUSES,
)
from sikao_api.modules.system.application.audit_v2 import add_audit_log

_AI_SOURCES = ("ai_generated", "ai_modified")
_AI_FEEDBACK_ACTION_PREFIX = "ai_question.feedback."


def cleanup_low_quality_ai_questions(
    session: Session,
    *,
    min_quality: float = 2.5,
    max_reports: int = 5,
) -> int:
    active_report_counts = _aggregate_active_report_counts(session)
    question_ids_to_refresh = set(active_report_counts)
    question_ids_to_refresh.update(
        session.scalars(select(QuestionV2.id).where(QuestionV2.source.in_(_AI_SOURCES)))
    )
    question_ids_to_refresh.update(
        session.scalars(select(QuestionV2.id).where(QuestionV2.report_count > 0))
    )
    if not question_ids_to_refresh:
        return 0

    questions = list(
        session.scalars(
            select(QuestionV2)
            .where(QuestionV2.id.in_(question_ids_to_refresh))
            .with_for_update()
        )
    )
    if not questions:
        return 0

    like_counts = _aggregate_feedback_counts(
        session,
        question_ids=[question.id for question in questions if question.source in _AI_SOURCES],
        action="like",
    )
    legacy_report_counts = _aggregate_feedback_counts(
        session,
        question_ids=[question.id for question in questions if question.source in _AI_SOURCES],
        action="report",
    )
    _refresh_question_quality_from_reports(
        questions=questions,
        active_report_counts=active_report_counts,
        like_counts=like_counts,
        legacy_report_counts=legacy_report_counts,
    )

    deactivated = 0
    for question in questions:
        session.add(question)
        if question.source not in _AI_SOURCES:
            continue
        if not _should_deactivate(
            question,
            min_quality=min_quality,
            max_reports=max_reports,
        ):
            continue
        if question.is_active is False:
            continue
        before = {
            "is_active": True,
            "quality_score": question.quality_score,
            "report_count": question.report_count,
            "ai_self_audit_passed": question.ai_self_audit_passed,
        }
        question.is_active = False
        session.add(question)
        add_audit_log(
            session,
            user_id=0,
            actor_type="system",
            actor_id="practice.ai_questions.cleanup",
            action="ai_question.auto_offline",
            target_type="question_v2",
            target_id=question.id,
            before=before,
            after={"is_active": False},
            metadata={
                "reason": _build_reason(
                    question,
                    min_quality=min_quality,
                    max_reports=max_reports,
                )
            },
            request_id=None,
            ip=None,
        )
        deactivated += 1

    session.flush()
    return deactivated


def _refresh_question_quality_from_reports(
    *,
    questions: list[QuestionV2],
    active_report_counts: dict[int, int],
    like_counts: dict[int, int],
    legacy_report_counts: dict[int, int],
) -> None:
    for question in questions:
        report_count_from_reports = active_report_counts.get(question.id, 0)
        if question.source not in _AI_SOURCES:
            question.report_count = report_count_from_reports
            continue
        aggregated_report_count = max(
            legacy_report_counts.get(question.id, 0),
            report_count_from_reports,
        )
        question.report_count = aggregated_report_count
        question.quality_score = recompute_quality_score(
            answer_count=question.answer_count,
            like_count=like_counts.get(question.id, 0),
            report_count=aggregated_report_count,
        )


def _aggregate_active_report_counts(session: Session) -> dict[int, int]:
    rows = session.execute(
        select(
            QuestionReportV2.question_id,
            func.count(QuestionReportV2.id),
        )
        .where(
            QuestionReportV2.deleted_at.is_(None),
            QuestionReportV2.status.in_(ACTIVE_QUESTION_REPORT_STATUSES),
        )
        .group_by(QuestionReportV2.question_id)
    ).all()
    return {int(question_id): int(count) for question_id, count in rows}


def _aggregate_feedback_counts(
    session: Session,
    *,
    question_ids: list[int],
    action: str,
) -> dict[int, int]:
    if not question_ids:
        return {}
    rows = session.execute(
        select(
            AuditLogV2.target_id,
            func.count(AuditLogV2.id),
        )
        .where(
            AuditLogV2.action == f"{_AI_FEEDBACK_ACTION_PREFIX}{action}",
            AuditLogV2.target_type == "question_v2",
            AuditLogV2.target_id.in_(question_ids),
        )
        .group_by(AuditLogV2.target_id)
    ).all()
    return {
        int(target_id): int(count)
        for target_id, count in rows
        if target_id is not None
    }


def _should_deactivate(
    question: QuestionV2,
    *,
    min_quality: float,
    max_reports: int,
) -> bool:
    if question.ai_self_audit_passed is False:
        return True
    if question.quality_score < min_quality:
        return True
    if question.report_count >= max_reports:
        return True
    return False


def _build_reason(
    question: QuestionV2,
    *,
    min_quality: float,
    max_reports: int,
) -> str:
    if question.ai_self_audit_passed is False:
        return "ai_self_audit_failed"
    if question.quality_score < min_quality:
        return f"quality_score<{min_quality}"
    return f"report_count>={max_reports}"
