from __future__ import annotations

from typing import cast

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeSessionV2
from sikao_api.modules.session_lifecycle.application.state_machine import evaluate_transition
from sikao_api.modules.session_lifecycle.domain.types import SessionActor, SessionStatus, SessionTrigger, TransitionAttempt
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.modules.system.application.errors import ConflictError


def apply_transition(
    session: Session,
    *,
    practice_session: PracticeSessionV2,
    trigger: SessionTrigger,
    actor: SessionActor,
    actor_id: str,
    request_id: str | None,
    reason: str | None = None,
    transition_ts: datetime | None = None,
) -> PracticeSessionV2:
    result = evaluate_transition(
        TransitionAttempt(
            from_status=cast(SessionStatus, practice_session.status),
            trigger=trigger,
            actor=actor,
        )
    )
    if not result.ok or result.new_status is None:
        raise ConflictError("invalid session transition", code=result.error_code or "INVALID_TRANSITION")
    now = transition_ts or datetime.now(UTC).replace(tzinfo=None)
    before = {"status": practice_session.status}
    original_status = practice_session.status
    practice_session.status = result.new_status
    if result.new_status == "in_progress":
        if original_status == "draft" and practice_session.first_question_at is None:
            practice_session.first_question_at = now
        if original_status == "paused" and practice_session.paused_at is not None:
            practice_session.paused_total_seconds += int((now - practice_session.paused_at).total_seconds())
            practice_session.paused_at = None
        practice_session.last_activity_at = now
    elif result.new_status == "paused":
        practice_session.paused_at = now
        practice_session.paused_count += 1
        practice_session.last_activity_at = now
    elif result.new_status == "abandoned":
        if original_status == "paused" and practice_session.paused_at is not None:
            practice_session.paused_total_seconds += int((now - practice_session.paused_at).total_seconds())
            practice_session.paused_at = None
        practice_session.abandoned_at = now
        practice_session.abandoned_reason = reason or trigger
        practice_session.last_activity_at = now
    elif result.new_status == "submitted":
        if original_status == "paused" and practice_session.paused_at is not None:
            practice_session.paused_total_seconds += int((now - practice_session.paused_at).total_seconds())
            practice_session.paused_at = None
        practice_session.last_activity_at = now
    elif result.new_status == "expired":
        if original_status == "paused" and practice_session.paused_at is not None:
            practice_session.paused_total_seconds += int((now - practice_session.paused_at).total_seconds())
            practice_session.paused_at = None
        practice_session.last_activity_at = now
    session.add(practice_session)
    add_audit_log(
        session,
        user_id=practice_session.user_id,
        actor_type=actor,
        actor_id=actor_id,
        action=f"session.{trigger}",
        target_type="practice_session_v2",
        target_id=practice_session.id,
        before=before,
        after={"status": practice_session.status},
        metadata={"trigger": trigger, "reason": reason} if reason is not None else {"trigger": trigger},
        request_id=request_id,
        ip=None,
    )
    return practice_session
