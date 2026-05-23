from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeSessionV2, UserV2
from sikao_api.modules.session_lifecycle.application.transition_support import apply_transition
from sikao_api.modules.system.application.errors import NotFoundError


def receive_heartbeat(
    session: Session,
    *,
    user: UserV2,
    session_id: int,
    current_question_id: int | None,
    request_id: str | None,
) -> tuple[PracticeSessionV2, datetime]:
    practice_session = session.scalar(
        select(PracticeSessionV2).where(
            PracticeSessionV2.id == session_id,
            PracticeSessionV2.user_id == user.id,
        )
    )
    if practice_session is None:
        raise NotFoundError("practice session not found", code="practice_session_not_found")
    server_ts = datetime.now(UTC).replace(tzinfo=None)
    if practice_session.status in {"submitted", "abandoned", "expired"}:
        return practice_session, server_ts
    if practice_session.status == "paused":
        apply_transition(
            session,
            practice_session=practice_session,
            trigger="new_heartbeat",
            actor="user",
            actor_id=str(user.id),
            request_id=request_id,
            transition_ts=server_ts,
        )
    elif practice_session.status == "in_progress":
        practice_session.last_activity_at = server_ts
        session.add(practice_session)
    practice_session.last_heartbeat_at = server_ts
    if current_question_id is not None:
        practice_session.config_snapshot = {
            **practice_session.config_snapshot,
            "last_seen_question_id": current_question_id,
        }
    session.add(practice_session)
    session.flush()
    return practice_session, server_ts
