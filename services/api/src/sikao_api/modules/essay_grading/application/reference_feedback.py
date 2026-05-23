from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import (
    EssayReferenceAnswerV2,
    EssayReferenceFeedbackV2,
    UserV2,
)
from sikao_api.db.schemas_v2 import EssayReferenceAnswerEnvelopeV2
from sikao_api.modules.essay_grading.application.reference_query import (
    serialize_reference_answer,
)
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.modules.system.application.errors import NotFoundError


def create_reference_feedback(
    session: Session,
    *,
    user: UserV2,
    reference_id: int,
    action: str,
    note: str | None,
    request_id: str | None,
) -> EssayReferenceAnswerEnvelopeV2:
    reference = _load_public_reference_or_raise(session, reference_id)
    row = session.scalar(
        select(EssayReferenceFeedbackV2).where(
            EssayReferenceFeedbackV2.reference_id == reference_id,
            EssayReferenceFeedbackV2.user_id == user.id,
            EssayReferenceFeedbackV2.action == action,
        )
    )
    if row is None:
        row = EssayReferenceFeedbackV2(
            reference_id=reference_id,
            user_id=user.id,
            action=action,
            note=note,
        )
        session.add(row)
        try:
            session.flush()
        except IntegrityError:
            session.rollback()
            row = session.scalar(
                select(EssayReferenceFeedbackV2).where(
                    EssayReferenceFeedbackV2.reference_id == reference_id,
                    EssayReferenceFeedbackV2.user_id == user.id,
                    EssayReferenceFeedbackV2.action == action,
                )
            )
            if row is None:
                raise
            reference = _load_public_reference_or_raise(session, reference_id)
            return serialize_reference_answer(reference)
    else:
        return serialize_reference_answer(reference)
    session.refresh(reference)
    add_audit_log(
        session,
        user_id=user.id,
        actor_type="user",
        actor_id=str(user.id),
        action=f"reference.feedback.{action}",
        target_type="essay_reference_answer_v2",
        target_id=reference.id,
        metadata=_build_feedback_metadata(operation="create", note=note),
        request_id=request_id,
        ip=None,
    )
    return serialize_reference_answer(reference)


def delete_reference_feedback(
    session: Session,
    *,
    user: UserV2,
    reference_id: int,
    action: str,
    request_id: str | None,
) -> EssayReferenceAnswerEnvelopeV2:
    reference = _load_public_reference_or_raise(session, reference_id)
    row = session.scalar(
        select(EssayReferenceFeedbackV2).where(
            EssayReferenceFeedbackV2.reference_id == reference_id,
            EssayReferenceFeedbackV2.user_id == user.id,
            EssayReferenceFeedbackV2.action == action,
        )
    )
    if row is None:
        raise NotFoundError(
            "reference feedback not found",
            code="reference_feedback_not_found",
        )
    session.delete(row)
    session.flush()
    session.refresh(reference)
    add_audit_log(
        session,
        user_id=user.id,
        actor_type="user",
        actor_id=str(user.id),
        action=f"reference.feedback.{action}",
        target_type="essay_reference_answer_v2",
        target_id=reference.id,
        metadata=_build_feedback_metadata(operation="delete", note=None),
        request_id=request_id,
        ip=None,
    )
    return serialize_reference_answer(reference)


def _build_feedback_metadata(*, operation: str, note: str | None) -> dict[str, str]:
    payload = {"operation": operation}
    if note:
        payload["note"] = note
    return payload


def _load_public_reference_or_raise(
    session: Session,
    reference_id: int,
) -> EssayReferenceAnswerV2:
    reference = session.get(EssayReferenceAnswerV2, reference_id)
    if reference is None or reference.status != "public":
        raise NotFoundError(
            "reference answer not found",
            code="reference_answer_not_found",
        )
    return reference
