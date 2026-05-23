from __future__ import annotations

from datetime import UTC, datetime, time
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeSessionV2, QuestionReportV2, QuestionV2, UserV2
from sikao_api.db.schemas_v2 import (
    OperationAckV2,
    QuestionReportCreateRequestV2,
    QuestionReportEnvelopeV2,
    QuestionReportListResponseV2,
    QuestionReportUpdateRequestV2,
)
from sikao_api.modules.question_reports.domain.errors import (
    QUESTION_REPORT_DAILY_LIMITED,
    QUESTION_REPORT_DUPLICATE_PENDING,
)
from sikao_api.modules.question_reports.domain.types import (
    ACTIVE_QUESTION_REPORT_STATUSES,
    QUESTION_REPORT_DAILY_LIMIT,
    QuestionReportCategory,
    QuestionReportStatus,
)
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.modules.system.application.errors import (
    ConflictError,
    NotFoundError,
    QuotaExceededError,
)


class QuestionReportService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create_report(
        self,
        *,
        user: UserV2,
        question_id: int,
        payload: QuestionReportCreateRequestV2,
        request_id: str | None,
    ) -> QuestionReportEnvelopeV2:
        self._lock_user(user_id=user.id)
        question = self._load_question_or_raise(question_id=question_id)
        self._ensure_daily_limit(
            user_id=user.id,
            question_id=question.id,
            category=payload.category.value,
            request_id=request_id,
        )
        source_session_id = self._validate_source_session(
            user_id=user.id,
            source_session_id=payload.source_session_id,
        )
        existing = self.session.scalar(
            select(QuestionReportV2).where(
                QuestionReportV2.user_id == user.id,
                QuestionReportV2.question_id == question.id,
                QuestionReportV2.category == payload.category.value,
                QuestionReportV2.status.in_(ACTIVE_QUESTION_REPORT_STATUSES),
                QuestionReportV2.deleted_at.is_(None),
            )
        )
        if existing is not None:
            raise ConflictError(
                "active question report already exists",
                code=QUESTION_REPORT_DUPLICATE_PENDING,
            )

        report = QuestionReportV2(
            user_id=user.id,
            question_id=question.id,
            category=payload.category.value,
            description=payload.description,
            status=QuestionReportStatus.PENDING.value,
            source_session_id=source_session_id,
            selected_answer_at_report=payload.selected_answer_at_report,
        )
        self.session.add(report)
        self.session.flush()
        add_audit_log(
            self.session,
            user_id=user.id,
            actor_type="user",
            actor_id=str(user.id),
            action="question_report.created",
            target_type="question_report_v2",
            target_id=report.id,
            after=_report_audit_snapshot(report),
            request_id=request_id,
        )
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            if _looks_like_active_duplicate_violation(exc):
                raise ConflictError(
                    "active question report already exists",
                    code=QUESTION_REPORT_DUPLICATE_PENDING,
                ) from exc
            raise
        self.session.refresh(report)
        return _to_envelope(report)

    def list_user_reports(
        self,
        *,
        user: UserV2,
        question_id: int | None = None,
    ) -> QuestionReportListResponseV2:
        stmt = select(QuestionReportV2).where(
            QuestionReportV2.user_id == user.id,
            QuestionReportV2.deleted_at.is_(None),
        )
        if question_id is not None:
            self._load_question_or_raise(question_id=question_id)
            stmt = stmt.where(QuestionReportV2.question_id == question_id)
        rows = list(
            self.session.scalars(
                stmt.order_by(
                    QuestionReportV2.created_at.desc(),
                    QuestionReportV2.id.desc(),
                )
            )
        )
        items = [_to_envelope(row) for row in rows]
        return QuestionReportListResponseV2(
            items=items,
            total=len(items),
            page=1,
            page_size=max(len(items), 1),
        )

    def update_pending(
        self,
        *,
        user: UserV2,
        report_id: int,
        payload: QuestionReportUpdateRequestV2,
        request_id: str | None,
    ) -> QuestionReportEnvelopeV2:
        report = self._load_owned_report_or_raise(user_id=user.id, report_id=report_id)
        self._ensure_pending(report)
        before = _report_audit_snapshot(report)
        if report.description == payload.description:
            return _to_envelope(report)

        report.description = payload.description
        self.session.add(report)
        self.session.flush()
        add_audit_log(
            self.session,
            user_id=user.id,
            actor_type="user",
            actor_id=str(user.id),
            action="question_report.updated_by_user",
            target_type="question_report_v2",
            target_id=report.id,
            before=before,
            after=_report_audit_snapshot(report),
            diff={
                "description": {
                    "before": before["description"],
                    "after": report.description,
                }
            },
            request_id=request_id,
        )
        self.session.commit()
        self.session.refresh(report)
        return _to_envelope(report)

    def soft_delete_pending(
        self,
        *,
        user: UserV2,
        report_id: int,
        request_id: str | None,
    ) -> OperationAckV2:
        report = self._load_owned_report_or_raise(user_id=user.id, report_id=report_id)
        self._ensure_pending(report)
        before = _report_audit_snapshot(report)
        report.deleted_at = _utc_now()
        self.session.add(report)
        self.session.flush()
        add_audit_log(
            self.session,
            user_id=user.id,
            actor_type="user",
            actor_id=str(user.id),
            action="question_report.deleted_by_user",
            target_type="question_report_v2",
            target_id=report.id,
            before=before,
            after=_report_audit_snapshot(report),
            diff={
                "deletedAt": {
                    "before": before["deletedAt"],
                    "after": report.deleted_at.isoformat() if report.deleted_at is not None else None,
                }
            },
            metadata={"reason": "user_delete"},
            request_id=request_id,
        )
        self.session.commit()
        return OperationAckV2(ok=True, status="deleted")

    def _lock_user(self, *, user_id: int) -> None:
        self.session.execute(
            select(UserV2.id).where(UserV2.id == user_id).with_for_update()
        )

    def _load_question_or_raise(self, *, question_id: int) -> QuestionV2:
        question = self.session.get(QuestionV2, question_id)
        if question is None:
            raise NotFoundError("question not found", code="question_not_found")
        return question

    def _validate_source_session(
        self,
        *,
        user_id: int,
        source_session_id: int | None,
    ) -> int | None:
        if source_session_id is None:
            return None
        session_row = self.session.scalar(
            select(PracticeSessionV2).where(
                PracticeSessionV2.id == source_session_id,
                PracticeSessionV2.user_id == user_id,
            )
        )
        if session_row is None:
            raise NotFoundError(
                "practice session not found",
                code="practice_session_not_found",
            )
        return source_session_id

    def _ensure_daily_limit(
        self,
        *,
        user_id: int,
        question_id: int,
        category: str,
        request_id: str | None,
    ) -> None:
        today = datetime.now(UTC).date()
        start = datetime.combine(today, time.min)
        count = self.session.scalar(
            select(func.count(QuestionReportV2.id)).where(
                QuestionReportV2.user_id == user_id,
                QuestionReportV2.created_at >= start,
            )
        )
        if int(count or 0) >= QUESTION_REPORT_DAILY_LIMIT:
            add_audit_log(
                self.session,
                user_id=user_id,
                actor_type="user",
                actor_id=str(user_id),
                action="question_report.rate_limited",
                target_type="question_v2",
                target_id=question_id,
                metadata={
                    "category": category,
                    "limit": QUESTION_REPORT_DAILY_LIMIT,
                    "createdToday": int(count or 0),
                    "windowStart": start.isoformat(),
                },
                request_id=request_id,
            )
            self.session.commit()
            raise QuotaExceededError(
                "daily question report limit exceeded",
                code=QUESTION_REPORT_DAILY_LIMITED,
            )

    def _load_owned_report_or_raise(
        self,
        *,
        user_id: int,
        report_id: int,
    ) -> QuestionReportV2:
        report = self.session.scalar(
            select(QuestionReportV2).where(
                QuestionReportV2.id == report_id,
                QuestionReportV2.user_id == user_id,
                QuestionReportV2.deleted_at.is_(None),
            )
        )
        if report is None:
            raise NotFoundError(
                "question report not found",
                code="question_report_not_found",
            )
        return report

    def _ensure_pending(self, report: QuestionReportV2) -> None:
        if report.status != QuestionReportStatus.PENDING.value:
            raise ConflictError(
                "question report is no longer editable",
                code="question_report_not_pending",
            )


def _to_envelope(report: QuestionReportV2) -> QuestionReportEnvelopeV2:
    return QuestionReportEnvelopeV2(
        id=report.id,
        question_id=report.question_id,
        category=QuestionReportCategory(report.category),
        description=report.description,
        status=QuestionReportStatus(report.status),
        admin_response=report.admin_response,
        duplicate_of_report_id=report.duplicate_of_report_id,
        applied_fix=report.applied_fix,
        source_session_id=report.source_session_id,
        selected_answer_at_report=report.selected_answer_at_report,
        created_at=report.created_at,
        updated_at=report.updated_at,
        handled_at=report.handled_at,
    )


def _report_audit_snapshot(report: QuestionReportV2) -> dict[str, Any]:
    return {
        "questionId": report.question_id,
        "category": report.category,
        "description": report.description,
        "status": report.status,
        "adminResponse": report.admin_response,
        "duplicateOfReportId": report.duplicate_of_report_id,
        "appliedFix": report.applied_fix,
        "sourceSessionId": report.source_session_id,
        "selectedAnswerAtReport": report.selected_answer_at_report,
        "handledAt": report.handled_at.isoformat() if report.handled_at is not None else None,
        "deletedAt": report.deleted_at.isoformat() if report.deleted_at is not None else None,
    }


def _looks_like_active_duplicate_violation(exc: IntegrityError) -> bool:
    return "uq_qreport_v2_active_user_q_cat" in str(exc.orig)


def _utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)
