from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from sikao_api.db.content_hash import compute_question_content_hash
from sikao_api.db.models_v2 import QuestionReportV2, QuestionV2
from sikao_api.db.schemas_v2 import (
    QuestionReportAdminListResponseV2,
    QuestionReportAdminItemV2,
    QuestionReportAdminUpdateRequestV2,
    QuestionReportApplyFixRequestV2,
)
from sikao_api.modules.question_reports.application.admin_actor import resolve_admin_actor
from sikao_api.modules.question_reports.application.admin_apply_fix import (
    apply_fix_to_question,
)
from sikao_api.modules.question_reports.application.admin_query import (
    list_reports,
    load_admin_item_or_raise,
)
from sikao_api.modules.question_reports.domain.types import (
    TERMINAL_QUESTION_REPORT_STATUSES,
    QuestionReportCategory,
    QuestionReportStatus,
)
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.modules.system.application.errors import (
    ConflictError,
    NotFoundError,
    ValidationError,
)


class QuestionReportAdminService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_reports(
        self,
        *,
        status: QuestionReportStatus | None,
        category: QuestionReportCategory | None,
        question_id: int | None,
        limit: int,
        offset: int,
    ) -> QuestionReportAdminListResponseV2:
        return list_reports(
            self.session,
            status=status,
            category=category,
            question_id=question_id,
            limit=limit,
            offset=offset,
        )

    def update_status(
        self,
        *,
        admin_username: str,
        report_id: int,
        payload: QuestionReportAdminUpdateRequestV2,
        request_id: str | None,
    ) -> QuestionReportAdminItemV2:
        report = self._load_report_or_raise(report_id=report_id)
        self._ensure_mutable(report)
        admin_user = resolve_admin_actor(self.session, admin_username=admin_username)
        before_status = report.status
        now = _utc_now()

        if payload.status == QuestionReportStatus.ACKNOWLEDGED:
            if report.status != QuestionReportStatus.PENDING.value:
                raise ValidationError(
                    "only pending reports can be acknowledged",
                    code="question_report_status_transition_invalid",
                )
            report.status = QuestionReportStatus.ACKNOWLEDGED.value
            self.session.add(report)
            self.session.flush()
            self._audit_status_change(
                admin_user_id=admin_user.id,
                admin_username=admin_username,
                report=report,
                before_status=before_status,
                request_id=request_id,
            )
            self.session.commit()
            return load_admin_item_or_raise(self.session, report_id=report.id)

        if payload.status == QuestionReportStatus.RESOLVED_INVALID:
            admin_response = require_admin_response(payload.admin_response)
            report.status = QuestionReportStatus.RESOLVED_INVALID.value
            report.handled_by_admin_id = admin_user.id
            report.handled_at = now
            report.admin_response = admin_response
            report.duplicate_of_report_id = None
            self.session.add(report)
            self.session.flush()
            self._audit_status_change(
                admin_user_id=admin_user.id,
                admin_username=admin_username,
                report=report,
                before_status=before_status,
                request_id=request_id,
            )
            self.session.commit()
            return load_admin_item_or_raise(self.session, report_id=report.id)

        if payload.status == QuestionReportStatus.RESOLVED_DUPLICATE:
            admin_response = require_admin_response(payload.admin_response)
            duplicate_of = self._load_duplicate_target_or_raise(
                report=report,
                duplicate_of_report_id=payload.duplicate_of_report_id,
            )
            report.status = QuestionReportStatus.RESOLVED_DUPLICATE.value
            report.handled_by_admin_id = admin_user.id
            report.handled_at = now
            report.admin_response = admin_response
            report.duplicate_of_report_id = duplicate_of.id
            self.session.add(report)
            self.session.flush()
            self._audit_status_change(
                admin_user_id=admin_user.id,
                admin_username=admin_username,
                report=report,
                before_status=before_status,
                request_id=request_id,
            )
            add_audit_log(
                self.session,
                user_id=admin_user.id,
                actor_type="admin",
                actor_id=admin_username,
                action="question_report.dup_marked",
                target_type="question_report_v2",
                target_id=report.id,
                metadata={
                    "duplicateOfReportId": duplicate_of.id,
                    "questionId": report.question_id,
                },
                request_id=request_id,
            )
            self.session.commit()
            return load_admin_item_or_raise(self.session, report_id=report.id)

    def apply_fix(
        self,
        *,
        admin_username: str,
        report_id: int,
        payload: QuestionReportApplyFixRequestV2,
        request_id: str | None,
    ) -> QuestionReportAdminItemV2:
        report = self._load_report_or_raise(report_id=report_id)
        self._ensure_mutable(report)
        admin_user = resolve_admin_actor(self.session, admin_username=admin_username)
        question = self._load_question_or_raise(question_id=report.question_id)
        before_status = report.status
        before_value, after_value = apply_fix_to_question(
            self.session,
            question=question,
            payload=payload,
        )
        question.content_hash = compute_question_content_hash(
            question.prompt,
            question.content_json,
        )
        report.status = QuestionReportStatus.RESOLVED_FIXED.value
        report.handled_by_admin_id = admin_user.id
        report.handled_at = _utc_now()
        report.admin_response = payload.admin_response
        report.duplicate_of_report_id = None
        report.applied_fix = {
            "field": payload.field.value,
            "before": before_value,
            "after": after_value,
        }
        self.session.add(question)
        self.session.add(report)
        try:
            self.session.flush()
        except IntegrityError as exc:
            self.session.rollback()
            if "uq_questions_v2_content_hash" in str(exc.orig):
                raise ConflictError(
                    "question content hash conflict",
                    code="question_content_hash_conflict",
                ) from exc
            raise

        self._audit_status_change(
            admin_user_id=admin_user.id,
            admin_username=admin_username,
            report=report,
            before_status=before_status,
            request_id=request_id,
        )
        add_audit_log(
            self.session,
            user_id=admin_user.id,
            actor_type="admin",
            actor_id=admin_username,
            action="question_report.fix_applied",
            target_type="question_report_v2",
            target_id=report.id,
            after={
                "status": report.status,
                "appliedFix": report.applied_fix,
            },
            metadata={
                "field": payload.field.value,
                "questionId": question.id,
            },
            request_id=request_id,
        )
        add_audit_log(
            self.session,
            user_id=admin_user.id,
            actor_type="admin",
            actor_id=admin_username,
            action="question.field_updated",
            target_type="question_v2",
            target_id=question.id,
            before={"field": payload.field.value, "value": before_value},
            after={"field": payload.field.value, "value": after_value},
            metadata={"reportId": report.id},
            request_id=request_id,
        )
        self.session.commit()
        return load_admin_item_or_raise(self.session, report_id=report.id)

    def _load_report_or_raise(self, *, report_id: int) -> QuestionReportV2:
        report = self.session.get(QuestionReportV2, report_id)
        if report is None or report.deleted_at is not None:
            raise NotFoundError(
                "question report not found",
                code="question_report_not_found",
            )
        return report

    def _load_question_or_raise(self, *, question_id: int) -> QuestionV2:
        question = self.session.get(QuestionV2, question_id)
        if question is None:
            raise NotFoundError("question not found", code="question_not_found")
        return question

    def _ensure_mutable(self, report: QuestionReportV2) -> None:
        if report.status in TERMINAL_QUESTION_REPORT_STATUSES:
            raise ConflictError(
                "question report is already resolved",
                code="question_report_already_resolved",
            )

    def _load_duplicate_target_or_raise(
        self,
        *,
        report: QuestionReportV2,
        duplicate_of_report_id: int | None,
    ) -> QuestionReportV2:
        if duplicate_of_report_id is None:
            raise ValidationError(
                "duplicate_of_report_id is required",
                code="question_report_duplicate_target_required",
            )
        if duplicate_of_report_id == report.id:
            raise ValidationError(
                "duplicate target cannot equal report",
                code="question_report_duplicate_target_invalid",
            )
        duplicate_of = self.session.get(QuestionReportV2, duplicate_of_report_id)
        if (
            duplicate_of is None
            or duplicate_of.deleted_at is not None
            or duplicate_of.question_id != report.question_id
        ):
            raise ValidationError(
                "duplicate target is invalid",
                code="question_report_duplicate_target_invalid",
            )
        return duplicate_of

    def _audit_status_change(
        self,
        *,
        admin_user_id: int,
        admin_username: str,
        report: QuestionReportV2,
        before_status: str,
        request_id: str | None,
    ) -> None:
        add_audit_log(
            self.session,
            user_id=admin_user_id,
            actor_type="admin",
            actor_id=admin_username,
            action="question_report.status_changed",
            target_type="question_report_v2",
            target_id=report.id,
            before={"status": before_status},
            after={"status": report.status},
            metadata={
                "from": before_status,
                "to": report.status,
            },
            request_id=request_id,
        )

def require_admin_response(value: str | None) -> str:
    if value is None or not value.strip():
        raise ValidationError(
            "admin_response is required",
            code="question_report_admin_response_required",
        )
    return value.strip()


def _utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)
