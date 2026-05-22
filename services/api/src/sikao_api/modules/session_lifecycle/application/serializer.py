from __future__ import annotations

from sikao_api.db.models_v2 import PracticeSessionV2
from sikao_api.db.schemas_v2 import SessionLifecycleResponseV2


def serialize_lifecycle(
    practice_session: PracticeSessionV2,
    *,
    transitions=None,
) -> SessionLifecycleResponseV2:
    return SessionLifecycleResponseV2(
        status=practice_session.status,
        first_question_at=practice_session.first_question_at,
        last_activity_at=practice_session.last_activity_at,
        paused_at=practice_session.paused_at,
        paused_count=practice_session.paused_count,
        paused_total_seconds=practice_session.paused_total_seconds,
        last_heartbeat_at=practice_session.last_heartbeat_at,
        expires_at=practice_session.expires_at,
        abandoned_at=practice_session.abandoned_at,
        abandoned_reason=practice_session.abandoned_reason,
        force_submitted=practice_session.force_submitted,
        force_submitted_reason=practice_session.force_submitted_reason,
        transitions=list(transitions or []),
    )
