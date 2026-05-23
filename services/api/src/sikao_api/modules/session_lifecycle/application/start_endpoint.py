from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeSessionV2, UserV2
from sikao_api.db.schemas_v2 import SessionLifecycleResponseV2
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.modules.session_lifecycle.application.serializer import serialize_lifecycle
from sikao_api.modules.session_lifecycle.application.transition_support import apply_transition
from sikao_api.modules.system.application.errors import ConflictError, NotFoundError


def start_session(
    session: Session,
    *,
    user: UserV2,
    session_id: int,
    request_id: str | None,
) -> SessionLifecycleResponseV2:
    now = datetime.now(UTC).replace(tzinfo=None)
    practice_session = session.scalar(
        select(PracticeSessionV2).where(
            PracticeSessionV2.id == session_id,
            PracticeSessionV2.user_id == user.id,
        )
    )
    if practice_session is None:
        raise NotFoundError("practice session not found", code="practice_session_not_found")
    if practice_session.exam_mode:
        if practice_session.time_limit_minutes is None:
            raise ConflictError(
                "mock exam time limit is missing",
                code="INVALID_TIME_LIMIT",
            )
        practice_session.auto_submit_at = now + timedelta(minutes=practice_session.time_limit_minutes)
        session.add(practice_session)
    apply_transition(
        session,
        practice_session=practice_session,
        trigger="user_start",
        actor="user",
        actor_id=str(user.id),
        request_id=request_id,
        transition_ts=now,
    )
    if practice_session.exam_mode:
        auto_submit_at = practice_session.auto_submit_at
        assert auto_submit_at is not None
        add_audit_log(
            session,
            user_id=practice_session.user_id,
            actor_type="user",
            actor_id=str(user.id),
            action="mock_exam.started",
            target_type="practice_session_v2",
            target_id=practice_session.id,
            after={"auto_submit_at": auto_submit_at.isoformat()},
            metadata={"time_limit_minutes": practice_session.time_limit_minutes},
            request_id=request_id,
            ip=None,
        )
    session.flush()
    return serialize_lifecycle(practice_session)
