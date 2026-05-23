from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import EmailContactV2, UserV2
from sikao_api.modules.system.application.errors import ConflictError

_ADMIN_SHADOW_EMAIL_DOMAIN = "system.local"


def resolve_admin_actor(session: Session, *, admin_username: str) -> UserV2:
    shadow_email = admin_shadow_email(admin_username)
    contact = session.scalar(
        select(EmailContactV2).where(EmailContactV2.email == shadow_email)
    )
    if contact is not None:
        user = session.get(UserV2, contact.user_id)
        if user is None:
            raise ConflictError(
                "admin shadow actor is corrupted",
                code="question_report_admin_actor_invalid",
            )
        if (
            user.display_name != f"[admin] {admin_username}"
            or user.is_active is not False
        ):
            raise ConflictError(
                "admin shadow actor namespace is occupied",
                code="question_report_admin_actor_conflict",
            )
        return user

    user = UserV2(
        display_name=f"[admin] {admin_username}",
        is_active=False,
    )
    session.add(user)
    session.flush()
    session.add(
        EmailContactV2(
            user_id=user.id,
            email=shadow_email,
            is_primary=True,
            is_verified=True,
        )
    )
    session.flush()
    return user


def admin_shadow_email(admin_username: str) -> str:
    return f"__admin__.{admin_username}@{_ADMIN_SHADOW_EMAIL_DOMAIN}"
