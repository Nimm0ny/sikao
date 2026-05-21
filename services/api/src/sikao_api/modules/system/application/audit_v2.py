from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import AuditLogV2


def add_audit_log(
    session: Session,
    *,
    user_id: int,
    actor_type: str,
    actor_id: str,
    action: str,
    target_type: str,
    target_id: int | None,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    diff: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
    request_id: str | None = None,
    ip: str | None = None,
) -> None:
    session.add(
        AuditLogV2(
            user_id=user_id,
            actor_type=actor_type,
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            before=before,
            after=after,
            diff=diff,
            metadata_json=metadata or {},
            request_id=request_id,
            ip=ip,
        )
    )
