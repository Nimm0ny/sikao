from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeSessionV2, UserV2
from sikao_api.db.schemas_v2 import SessionLifecycleResponseV2
from sikao_api.modules.session_lifecycle.application.serializer import serialize_lifecycle
from sikao_api.modules.session_lifecycle.application.transition_support import apply_transition
from sikao_api.modules.system.application.errors import NotFoundError


def pause_session(
    session: Session,
    *,
    user: UserV2,
    session_id: int,
    request_id: str | None,
) -> SessionLifecycleResponseV2:
    practice_session = _load_session(session, user=user, session_id=session_id)
    apply_transition(
        session,
        practice_session=practice_session,
        trigger="user_pause",
        actor="user",
        actor_id=str(user.id),
        request_id=request_id,
    )
    session.flush()
    return serialize_lifecycle(practice_session)


def resume_session(
    session: Session,
    *,
    user: UserV2,
    session_id: int,
    request_id: str | None,
) -> SessionLifecycleResponseV2:
    practice_session = _load_session(session, user=user, session_id=session_id)
    apply_transition(
        session,
        practice_session=practice_session,
        trigger="user_resume",
        actor="user",
        actor_id=str(user.id),
        request_id=request_id,
    )
    session.flush()
    return serialize_lifecycle(practice_session)


def _load_session(session: Session, *, user: UserV2, session_id: int) -> PracticeSessionV2:
    practice_session = session.scalar(
        select(PracticeSessionV2).where(
            PracticeSessionV2.id == session_id,
            PracticeSessionV2.user_id == user.id,
        )
    )
    if practice_session is None:
        raise NotFoundError("practice session not found", code="practice_session_not_found")
    return practice_session
