from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import EssayReferenceAnswerV2, QuestionV2, UserV2
from sikao_api.db.schemas_v2 import OperationAckV2
from sikao_api.modules.essay_grading.application.reference_query import (
    serialize_reference_answer,
)
from sikao_api.modules.llm.application.service import HomeLlmService
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.modules.system.application.errors import NotFoundError

logger = logging.getLogger(__name__)


def queue_reference_generation(
    session: Session,
    *,
    user: UserV2,
    question_id: int,
    request_id: str | None,
) -> OperationAckV2:
    question = _load_question_or_raise(session, question_id)
    existing = _find_existing_ai_reference(session, question_id=question.id)
    if existing is not None:
        return OperationAckV2(ok=True, status="exists")
    add_audit_log(
        session,
        user_id=user.id,
        actor_type="user",
        actor_id=str(user.id),
        action="reference.generate.manual",
        target_type="question_v2",
        target_id=question.id,
        request_id=request_id,
        ip=None,
    )
    return OperationAckV2(ok=True, status="queued")


async def generate_reference_answer_async(
    session_factory: Any,
    settings: Settings,
    *,
    user_id: int,
    question_id: int,
    actor_type: str,
    actor_id: str,
    action: str | None,
    request_id: str | None,
) -> None:
    session = session_factory()
    try:
        await generate_reference_answer_for_question(
            session=session,
            settings=settings,
            user_id=user_id,
            question_id=question_id,
            actor_type=actor_type,
            actor_id=actor_id,
            action=action,
            request_id=request_id,
        )
        session.commit()
    except Exception:
        session.rollback()
        logger.exception(
            "essay reference generation failed user_id=%s question_id=%s",
            user_id,
            question_id,
        )
    finally:
        session.close()


async def generate_reference_answer_for_question(
    *,
    session: Session,
    settings: Settings,
    user_id: int,
    question_id: int,
    actor_type: str,
    actor_id: str,
    action: str | None,
    request_id: str | None,
) -> EssayReferenceAnswerV2 | None:
    question = _load_question_for_update_or_raise(session, question_id)
    if _find_existing_ai_reference(session, question_id=question.id) is not None:
        return None
    user = session.get(UserV2, user_id)
    if user is None:
        raise NotFoundError("user not found", code="user_not_found")

    llm_service = HomeLlmService(session, settings)
    trace = await llm_service.generate_reference_answer(
        user=user,
        question_stem=question.prompt,
        materials=_extract_materials(question.content_json),
        word_limit=_extract_word_limit(question.content_json),
    )
    now = datetime.now(UTC).replace(tzinfo=None)
    row = EssayReferenceAnswerV2(
        question_id=question.id,
        content=trace.result.content,
        source="ai_generated",
        created_by_user_id=None,
        created_by_admin=False,
        status="public" if trace.result.ai_self_audit_passed else "archived",
        published_at=now if trace.result.ai_self_audit_passed else None,
        ai_self_audit_passed=trace.result.ai_self_audit_passed,
        ai_generated_at=now,
    )
    session.add(row)
    session.flush()
    if action is not None:
        add_audit_log(
            session,
            user_id=user.id,
            actor_type=actor_type,
            actor_id=actor_id,
            action=action,
            target_type="essay_reference_answer_v2",
            target_id=row.id,
            after={
                "status": row.status,
                "questionId": row.question_id,
                "source": row.source,
            },
            metadata={
                "aiSelfAuditPassed": trace.result.ai_self_audit_passed,
                "qualityScore": row.quality_score,
            },
            request_id=request_id,
            ip=None,
        )
    return row


def serialize_generated_reference(
    row: EssayReferenceAnswerV2,
) -> dict[str, Any]:
    return serialize_reference_answer(row).model_dump(mode="json")


def _find_existing_ai_reference(
    session: Session,
    *,
    question_id: int,
) -> EssayReferenceAnswerV2 | None:
    return session.scalar(
        select(EssayReferenceAnswerV2).where(
            EssayReferenceAnswerV2.question_id == question_id,
            EssayReferenceAnswerV2.source == "ai_generated",
            EssayReferenceAnswerV2.status.in_(("public", "draft", "archived")),
        )
    )


def _load_question_or_raise(session: Session, question_id: int) -> QuestionV2:
    question = session.get(QuestionV2, question_id)
    if question is None:
        raise NotFoundError("question not found", code="question_not_found")
    return question


def _load_question_for_update_or_raise(session: Session, question_id: int) -> QuestionV2:
    question = session.scalar(
        select(QuestionV2)
        .where(QuestionV2.id == question_id)
        .with_for_update()
    )
    if question is None:
        raise NotFoundError("question not found", code="question_not_found")
    return question


def _extract_materials(payload: dict[str, Any]) -> list[str]:
    raw = payload.get("materialTexts")
    if not isinstance(raw, list):
        return []
    return [item for item in raw if isinstance(item, str) and item.strip()]


def _extract_word_limit(payload: dict[str, Any]) -> int:
    value = payload.get("wordLimitMax")
    if isinstance(value, int) and value >= 100:
        return value
    return 1000
