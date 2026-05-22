from __future__ import annotations

from typing import Literal, cast

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import AuditLogV2, PracticeSessionV2, UserV2
from sikao_api.db.schemas_v2 import LifecycleTransition, SessionLifecycleResponseV2
from sikao_api.modules.system.application.errors import NotFoundError


def build_session_lifecycle(
    session: Session,
    *,
    user: UserV2,
    session_id: int,
) -> SessionLifecycleResponseV2:
    practice_session = session.scalar(
        select(PracticeSessionV2).where(
            PracticeSessionV2.id == session_id,
            PracticeSessionV2.user_id == user.id,
        )
    )
    if practice_session is None:
        raise NotFoundError("practice session not found", code="practice_session_not_found")
    audits = list(
        session.scalars(
            select(AuditLogV2).where(
                AuditLogV2.target_type == "practice_session_v2",
                AuditLogV2.target_id == practice_session.id,
            )
            .order_by(AuditLogV2.created_at.asc(), AuditLogV2.id.asc())
        )
    )
    transitions = []
    for audit in audits:
        before_status = (audit.before or {}).get("status")
        after_status = (audit.after or {}).get("status")
        metadata = audit.metadata_json if isinstance(audit.metadata_json, dict) else {}
        if not isinstance(before_status, str) or not isinstance(after_status, str) or before_status == after_status:
            continue
        transitions.append(
            LifecycleTransition(
                from_status=before_status,
                to_status=after_status,
                trigger=str(metadata.get("trigger", audit.action)),
                actor=cast(Literal["user", "system", "cron", "admin"], audit.actor_type),
                ts=audit.created_at,
                reason=metadata.get("reason") if isinstance(metadata.get("reason"), str) else None,
            )
        )
    return SessionLifecycleResponseV2(
        status=practice_session.status,
        paused_at=practice_session.paused_at,
        paused_count=practice_session.paused_count,
        last_heartbeat_at=practice_session.last_heartbeat_at,
        expires_at=practice_session.expires_at,
        abandoned_at=practice_session.abandoned_at,
        abandoned_reason=practice_session.abandoned_reason,
        force_submitted=practice_session.force_submitted,
        force_submitted_reason=practice_session.force_submitted_reason,
        transitions=transitions,
    )
