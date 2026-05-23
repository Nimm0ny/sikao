from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import QuestionV2
from sikao_api.modules.ai_questions.application.feedback import refresh_ai_question_quality
from sikao_api.modules.system.application.audit_v2 import add_audit_log

_AI_SOURCES = ("ai_generated", "ai_modified")


def cleanup_low_quality_ai_questions(
    session: Session,
    *,
    min_quality: float = 2.5,
    max_reports: int = 5,
) -> int:
    questions = list(
        session.scalars(
            select(QuestionV2)
            .where(
                QuestionV2.source.in_(_AI_SOURCES),
                QuestionV2.is_active.is_(True),
            )
            .with_for_update()
        )
    )
    if not questions:
        return 0

    _refresh_ai_question_quality(session, questions=questions)

    deactivated = 0
    for question in questions:
        if not _should_deactivate(
            question,
            min_quality=min_quality,
            max_reports=max_reports,
        ):
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


def _refresh_ai_question_quality(
    session: Session,
    *,
    questions: Sequence[QuestionV2],
) -> None:
    for question in questions:
        refresh_ai_question_quality(session, question=question)
        session.add(question)


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
