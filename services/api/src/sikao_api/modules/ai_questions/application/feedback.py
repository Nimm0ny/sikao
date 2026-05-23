from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import AuditLogV2, PracticeSessionAnswerV2, PracticeSessionV2, QuestionV2, UserV2
from sikao_api.modules.ai_questions.interface.schemas import (
    AiQuestionFeedbackRequestV2,
    AiQuestionFeedbackResponseV2,
)
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.modules.system.application.errors import NotFoundError, ValidationError

_AI_FEEDBACK_ACTION_PREFIX = "ai_question.feedback."
_SUPPORTED_SOURCES = ("ai_generated", "ai_modified")


def submit_feedback(
    session: Session,
    *,
    user: UserV2,
    question_id: int,
    payload: AiQuestionFeedbackRequestV2,
    request_id: str | None,
) -> AiQuestionFeedbackResponseV2:
    question = session.scalar(
        select(QuestionV2).where(QuestionV2.id == question_id).with_for_update()
    )
    if question is None:
        raise NotFoundError("ai question not found", code="ai_question_not_found")
    if question.source not in _SUPPORTED_SOURCES:
        raise ValidationError(
            "only ai-generated questions accept ai feedback",
            code="ai_question_feedback_invalid_source",
        )
    answered = session.scalar(
        select(PracticeSessionAnswerV2.id)
        .join(PracticeSessionV2, PracticeSessionV2.id == PracticeSessionAnswerV2.session_id)
        .where(
            PracticeSessionV2.user_id == user.id,
            PracticeSessionV2.status == "submitted",
            PracticeSessionV2.source_mode == "ai_generated",
            PracticeSessionAnswerV2.question_id == question.id,
            PracticeSessionAnswerV2.answered_at.is_not(None),
        )
    )
    if answered is None:
        raise NotFoundError(
            "ai question feedback requires an answered ai question",
            code="ai_question_feedback_not_allowed",
        )

    action_name = f"{_AI_FEEDBACK_ACTION_PREFIX}{payload.action}"
    already_recorded = session.scalar(
        select(AuditLogV2.id).where(
            AuditLogV2.user_id == user.id,
            AuditLogV2.action == action_name,
            AuditLogV2.target_type == "question_v2",
            AuditLogV2.target_id == question.id,
        )
    )
    if already_recorded is None:
        add_audit_log(
            session,
            user_id=user.id,
            actor_type="user",
            actor_id=str(user.id),
            action=action_name,
            target_type="question_v2",
            target_id=question.id,
            before={
                "quality_score": question.quality_score,
                "report_count": question.report_count,
            },
            metadata={"note": payload.note} if payload.note else {},
            request_id=request_id,
            ip=None,
        )
        session.flush()

    refresh_ai_question_quality(session, question=question)
    session.add(question)
    session.flush()
    return AiQuestionFeedbackResponseV2(
        question_id=question.id,
        action=payload.action,
        quality_score=question.quality_score,
        report_count=question.report_count,
        is_active=question.is_active,
    )


def recompute_quality_score(
    *,
    answer_count: int,
    like_count: int,
    report_count: int,
) -> float:
    base = 5.0
    likes_bonus = min(like_count * 0.05, 1.0)
    reports_penalty = report_count * 0.5
    score = base + likes_bonus - reports_penalty
    upper_bounded = min(score, 5.0)
    if answer_count < 5:
        return max(upper_bounded, 4.0)
    return max(upper_bounded, 0.0)


def refresh_ai_question_quality(
    session: Session,
    *,
    question: QuestionV2,
) -> None:
    if question.source not in _SUPPORTED_SOURCES:
        return
    like_count = _count_feedback(session, question_id=question.id, action="like")
    report_count = _count_feedback(session, question_id=question.id, action="report")
    question.report_count = report_count
    question.quality_score = recompute_quality_score(
        answer_count=question.answer_count,
        like_count=like_count,
        report_count=report_count,
    )


def _count_feedback(session: Session, *, question_id: int, action: str) -> int:
    action_name = f"{_AI_FEEDBACK_ACTION_PREFIX}{action}"
    count = session.scalar(
        select(func.count(AuditLogV2.id)).where(
            AuditLogV2.action == action_name,
            AuditLogV2.target_type == "question_v2",
            AuditLogV2.target_id == question_id,
        )
    )
    return int(count or 0)
