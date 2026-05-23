from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import (
    EssayReportV2,
    EssaySubmissionV2,
    QuestionV2,
    UserV2,
)
from sikao_api.modules.essay_grading.application.report_persist import (
    EssayReportPersistPayload,
    build_failed_feedback_json,
    build_report_persist_payload,
)
from sikao_api.modules.essay_grading.application.reference_generator_runner import (
    generate_reference_answer_for_question,
)
from sikao_api.modules.llm.application.service import HomeLlmService
from sikao_api.modules.system.application.errors import (
    ConflictError,
    LLMParseError,
    LLMServiceError,
    ValidationError,
)

logger = logging.getLogger(__name__)


async def grade_submission_async(
    session_factory: Any,
    settings: Settings,
    submission_id: int,
) -> None:
    session = session_factory()
    try:
        auto_reference = await _grade_submission_inner(
            session=session,
            settings=settings,
            submission_id=submission_id,
        )
        session.commit()
        if auto_reference is not None:
            try:
                with session_factory() as reference_session:
                    await generate_reference_answer_for_question(
                        session=reference_session,
                        settings=settings,
                        user_id=auto_reference.user_id,
                        question_id=auto_reference.question_id,
                        actor_type="system",
                        actor_id="essay_grading.auto_reference",
                        action="reference.generate.auto",
                        request_id=None,
                    )
                    reference_session.commit()
            except Exception:
                logger.exception(
                    "essay reference auto generation failed user_id=%s question_id=%s",
                    auto_reference.user_id,
                    auto_reference.question_id,
                )
    except Exception as exc:  # noqa: BLE001
        session.rollback()
        with session_factory() as fallback_session:
            mark_submission_failed(
                session=fallback_session,
                submission_id=submission_id,
                error_message=f"{type(exc).__name__}: {exc}",
            )
            fallback_session.commit()
    finally:
        session.close()


async def _grade_submission_inner(
    *,
    session: Session,
    settings: Settings,
    submission_id: int,
) -> AutoReferenceRequest | None:
    submission = session.get(EssaySubmissionV2, submission_id)
    if submission is None or submission.status != "pending_grading":
        return None
    if submission.question_id is None:
        mark_submission_failed(
            session=session,
            submission_id=submission_id,
            error_message="question binding missing",
        )
        return None

    question = session.get(QuestionV2, submission.question_id)
    user = session.get(UserV2, submission.user_id)
    if question is None or user is None:
        mark_submission_failed(
            session=session,
            submission_id=submission_id,
            error_message="question or user not found",
        )
        return None

    report = _ensure_report_row(session=session, submission_id=submission.id)
    materials = _extract_materials(question.content_json)
    word_limit_min = _extract_optional_int(question.content_json, "wordLimitMin")
    word_limit_max = _extract_optional_int(question.content_json, "wordLimitMax")
    full_score = _extract_optional_int(question.content_json, "fullScore")

    llm_service = HomeLlmService(session, settings)
    try:
        trace = await llm_service.grade_essay(
            user=user,
            question_stem=question.prompt,
            materials=materials,
            user_answer=submission.content,
            word_limit_min=word_limit_min,
            word_limit_max=word_limit_max,
            full_score=full_score,
        )
        llm_call_id = trace.llm_call_id
        if llm_call_id is None:
            raise ConflictError(
                "essay grading llm call record missing",
                code="essay_grading_llm_call_missing",
            )
        graded_at = datetime.now(UTC).replace(tzinfo=None)
        payload = build_report_persist_payload(
            trace=trace,
            graded_at=graded_at,
            llm_call_id=llm_call_id,
        )
        _persist_completed_report(
            submission=submission,
            report=report,
            payload=payload,
        )
    except (LLMParseError, LLMServiceError, ValidationError) as exc:
        mark_submission_failed(
            session=session,
            submission_id=submission.id,
            error_message=f"{type(exc).__name__}: {exc.message if hasattr(exc, 'message') else exc}",
        )
        return None
    return AutoReferenceRequest(user_id=user.id, question_id=question.id)


@dataclass(frozen=True)
class AutoReferenceRequest:
    user_id: int
    question_id: int


def _persist_completed_report(
    *,
    submission: EssaySubmissionV2,
    report: EssayReportV2,
    payload: EssayReportPersistPayload,
) -> None:
    submission.status = "graded"
    report.status = "completed"
    report.score = payload.score
    report.feedback_json = payload.feedback_json


def mark_submission_failed(
    *,
    session: Session,
    submission_id: int,
    error_message: str,
) -> None:
    submission = session.get(EssaySubmissionV2, submission_id)
    if submission is None:
        return
    submission.status = "failed"
    report = _ensure_report_row(session=session, submission_id=submission.id)
    report.status = "failed"
    report.score = None
    report.feedback_json = build_failed_feedback_json(error_message=error_message)
    session.add(submission)
    session.add(report)


def _ensure_report_row(
    *,
    session: Session,
    submission_id: int,
) -> EssayReportV2:
    report = session.scalar(
        select(EssayReportV2).where(EssayReportV2.submission_id == submission_id)
    )
    if report is not None:
        return report
    report = EssayReportV2(
        submission_id=submission_id,
        status="pending",
        feedback_json={},
    )
    session.add(report)
    session.flush()
    return report


def _extract_materials(payload: dict[str, Any]) -> list[str]:
    raw = payload.get("materialTexts")
    if not isinstance(raw, list):
        return []
    return [item for item in raw if isinstance(item, str) and item.strip()]


def _extract_optional_int(payload: dict[str, Any], key: str) -> int | None:
    value = payload.get(key)
    return value if isinstance(value, int) else None
