from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import (
    EssayReportV2,
    EssaySubmissionV2,
    PracticeSessionAnswerV2,
    PracticeSessionV2,
    UserV2,
)
from sikao_api.db.schemas_v2 import (
    EssayGradingResponseV2,
    EssayReportEnvelopeV2,
    GradingDimensionV2,
)
from sikao_api.modules.essay_grading.application.reference_query import (
    list_public_reference_answers,
)
from sikao_api.modules.llm.application.service import HomeLlmService
from sikao_api.modules.system.application.errors import (
    ConflictError,
    NotFoundError,
    ValidationError,
)

_GRADING_ENDPOINT = "practice.essay_submissions.grade"


@dataclass(frozen=True)
class TriggerGradingResult:
    response: EssayGradingResponseV2
    schedule_needed: bool


class PracticeEssayGradingService:
    def __init__(self, session: Session, settings: Settings | None = None) -> None:
        self.session = session
        self.settings = settings

    def ensure_submission_for_session(
        self,
        *,
        practice_session: PracticeSessionV2,
    ) -> EssaySubmissionV2 | None:
        if practice_session.track != "essay":
            return None

        existing = self.session.scalar(
            select(EssaySubmissionV2).where(
                EssaySubmissionV2.practice_session_id == practice_session.id
            )
        )
        if existing is not None:
            return existing

        answer_row = self.session.scalar(
            select(PracticeSessionAnswerV2)
            .where(PracticeSessionAnswerV2.session_id == practice_session.id)
            .order_by(PracticeSessionAnswerV2.display_order.asc())
        )
        if answer_row is None or answer_row.question_id is None:
            raise ValidationError(
                "essay session is missing its answer binding",
                code="essay_submission_source_missing",
            )

        submission = EssaySubmissionV2(
            user_id=practice_session.user_id,
            question_id=answer_row.question_id,
            practice_session_id=practice_session.id,
            content=_extract_essay_answer_text(answer_row.response_json),
            status="submitted",
            submitted_at=practice_session.submitted_at
            or datetime.now(UTC).replace(tzinfo=None),
        )
        self.session.add(submission)
        self.session.flush()
        return submission

    def get_submission(
        self,
        *,
        user: UserV2,
        submission_id: int,
    ) -> EssaySubmissionV2:
        submission = self.session.scalar(
            select(EssaySubmissionV2).where(
                EssaySubmissionV2.id == submission_id,
                EssaySubmissionV2.user_id == user.id,
            )
        )
        if submission is None:
            raise NotFoundError(
                "essay submission not found",
                code="essay_submission_not_found",
            )
        return submission

    def trigger_grading(
        self,
        *,
        user: UserV2,
        submission_id: int,
    ) -> TriggerGradingResult:
        submission = self.get_submission(user=user, submission_id=submission_id)
        if not submission.content.strip():
            raise ValidationError(
                "essay submission content cannot be blank",
                code="essay_submission_empty",
            )

        updated = self.session.execute(
            update(EssaySubmissionV2)
            .where(
                EssaySubmissionV2.id == submission.id,
                EssaySubmissionV2.user_id == user.id,
                EssaySubmissionV2.status.in_(("submitted", "failed")),
            )
            .values(status="pending_grading")
            .execution_options(synchronize_session=False)
        )
        if getattr(updated, "rowcount", None) != 1:
            self.session.refresh(submission)
            report = self._get_report(submission_id=submission.id)
            return TriggerGradingResult(
                response=self.build_grading_response(submission=submission, report=report),
                schedule_needed=False,
            )

        submission.status = "pending_grading"
        report = self._get_report(submission_id=submission.id)
        if report is None:
            report = EssayReportV2(
                submission_id=submission.id,
                status="pending",
                feedback_json={},
            )
            self.session.add(report)
        else:
            report.status = "pending"
            report.score = None
            report.feedback_json = {}
            self.session.add(report)

        self.session.add(submission)
        self.session.flush()
        return TriggerGradingResult(
            response=self.build_grading_response(submission=submission, report=report),
            schedule_needed=True,
        )

    def build_grading_response(
        self,
        *,
        submission: EssaySubmissionV2,
        report: EssayReportV2 | None = None,
    ) -> EssayGradingResponseV2:
        current_report = report or self._get_report(submission_id=submission.id)
        references = (
            list_public_reference_answers(self.session, question_id=submission.question_id)
            if submission.question_id is not None
            else []
        )
        report_envelope: EssayReportEnvelopeV2 | None = None
        error_message: str | None = None
        if current_report is not None:
            if current_report.status == "completed":
                report_envelope = _serialize_report(current_report)
            elif current_report.status == "failed":
                error_message = _extract_error_message(current_report.feedback_json)

        return EssayGradingResponseV2(
            submission_id=submission.id,
            status=submission.status,
            report=report_envelope,
            reference_answers=references,
            error_message=error_message,
        )

    def build_idempotent_request_hash(
        self,
        *,
        submission_id: int,
    ) -> str:
        if self.settings is None:
            raise ConflictError(
                "essay grading settings are not available",
                code="essay_grading_settings_missing",
            )
        llm_service = HomeLlmService(self.session, self.settings)
        return llm_service.build_idempotent_request_hash(
            payload={"submissionId": submission_id}
        )

    def _get_report(self, *, submission_id: int) -> EssayReportV2 | None:
        return self.session.scalar(
            select(EssayReportV2).where(EssayReportV2.submission_id == submission_id)
        )

def _extract_essay_answer_text(response_json: dict[str, Any]) -> str:
    for key in ("text", "content", "answerText"):
        value = response_json.get(key)
        if isinstance(value, str):
            return value.strip()
    return ""


def _serialize_report(report: EssayReportV2) -> EssayReportEnvelopeV2:
    payload = report.feedback_json
    dimensions = [
        GradingDimensionV2(
            name=item["name"],
            score=item.get("score"),
            full_score=item.get("full_score"),
            comment=item.get("comment"),
        )
        for item in payload.get("dimensions", [])
        if isinstance(item, dict)
    ]
    graded_at = payload.get("graded_at") or report.updated_at
    llm_call_id = payload.get("llm_call_id")
    if not isinstance(llm_call_id, int):
        raise ConflictError(
            "essay grading llm call record missing",
            code="essay_grading_llm_call_missing",
        )
    return EssayReportEnvelopeV2(
        total_score=float(report.score) if report.score is not None else 0.0,
        dimensions=dimensions,
        highlights=[str(item) for item in payload.get("highlights", [])],
        issues=[str(item) for item in payload.get("issues", [])],
        overall_comment=str(payload.get("overall_comment") or ""),
        improvement_suggestions=[
            str(item) for item in payload.get("improvement_suggestions", [])
        ],
        graded_at=graded_at,
        llm_call_id=llm_call_id,
    )


def _extract_error_message(payload: dict[str, Any]) -> str | None:
    message = payload.get("error_message")
    if not isinstance(message, str) or not message.strip():
        return None
    return message
