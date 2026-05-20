from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import EmailContactV2, PhoneContactV2, UserV2
from sikao_api.db.schemas_v2 import (
    AuthAckV2,
    AuthSessionResponseV2,
    AuthSessionStateResponseV2,
    AuthSessionV2 as AuthSessionOutV2,
    AuthUserV2,
    LoginRequestV2,
    RegisterEmailRequestV2,
    RegisterPhoneRequestV2,
    ResetPasswordRequestV2,
    SendCodeRequestV2,
    SendCodeResponseV2,
    VerifyCodeRequestV2,
    VerifyCodeResponseV2,
)
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import (
    clear_auth_cookies,
    get_current_auth_context,
    set_auth_cookies,
    verify_csrf_v2,
)
from sikao_api.modules.identity.application.service import IdentityServiceV2

router = APIRouter(prefix="/api/v2/auth", tags=["identity-v2"])


def _serialize_user(session: Session, user: UserV2) -> AuthUserV2:
    email_contact = session.scalar(
        select(EmailContactV2).where(EmailContactV2.user_id == user.id, EmailContactV2.is_primary.is_(True))
    )
    phone_contact = session.scalar(
        select(PhoneContactV2).where(PhoneContactV2.user_id == user.id, PhoneContactV2.is_primary.is_(True))
    )
    return AuthUserV2(
        id=user.id,
        public_id=user.public_id,
        display_name=user.display_name,
        email=email_contact.email if email_contact is not None else None,
        phone=phone_contact.phone if phone_contact is not None else None,
        is_active=user.is_active,
        created_at=user.created_at,
    )


def _serialize_session(raw_token: str, issued_at, expires_at, session_id: int) -> AuthSessionOutV2:
    return AuthSessionOutV2(
        id=session_id,
        token=raw_token,
        issued_at=issued_at,
        expires_at=expires_at,
    )


@router.post("/register/email", response_model=AuthSessionResponseV2)
def register_email(
    payload: RegisterEmailRequestV2,
    response: Response,
    session: Annotated[Session, Depends(get_db_session)],
) -> AuthSessionResponseV2:
    service = IdentityServiceV2(session)
    user, auth_session, raw_token = service.register_email(
        email=payload.email,
        password=payload.password,
        display_name=payload.display_name,
    )
    session.commit()
    session.refresh(user)
    session.refresh(auth_session)
    set_auth_cookies(
        response,
        raw_token=raw_token,
        csrf_token=auth_session.csrf_token,
        expires_at=auth_session.expires_at,
    )
    return AuthSessionResponseV2(
        user=_serialize_user(session, user),
        session=_serialize_session(raw_token, auth_session.issued_at, auth_session.expires_at, auth_session.id),
        csrf_token=auth_session.csrf_token,
    )


@router.post("/register/phone", response_model=AuthSessionResponseV2)
def register_phone(
    payload: RegisterPhoneRequestV2,
    response: Response,
    session: Annotated[Session, Depends(get_db_session)],
) -> AuthSessionResponseV2:
    service = IdentityServiceV2(session)
    user, auth_session, raw_token = service.register_phone(
        phone=payload.phone,
        password=payload.password,
        display_name=payload.display_name,
    )
    session.commit()
    session.refresh(user)
    session.refresh(auth_session)
    set_auth_cookies(
        response,
        raw_token=raw_token,
        csrf_token=auth_session.csrf_token,
        expires_at=auth_session.expires_at,
    )
    return AuthSessionResponseV2(
        user=_serialize_user(session, user),
        session=_serialize_session(raw_token, auth_session.issued_at, auth_session.expires_at, auth_session.id),
        csrf_token=auth_session.csrf_token,
    )


@router.post("/login", response_model=AuthSessionResponseV2)
def login(
    payload: LoginRequestV2,
    response: Response,
    session: Annotated[Session, Depends(get_db_session)],
) -> AuthSessionResponseV2:
    service = IdentityServiceV2(session)
    user, auth_session, raw_token = service.login(
        identifier=payload.identifier,
        password=payload.password,
    )
    session.commit()
    session.refresh(auth_session)
    set_auth_cookies(
        response,
        raw_token=raw_token,
        csrf_token=auth_session.csrf_token,
        expires_at=auth_session.expires_at,
    )
    return AuthSessionResponseV2(
        user=_serialize_user(session, user),
        session=_serialize_session(raw_token, auth_session.issued_at, auth_session.expires_at, auth_session.id),
        csrf_token=auth_session.csrf_token,
    )


@router.post("/logout", response_model=AuthAckV2, dependencies=[Depends(verify_csrf_v2)])
def logout(
    response: Response,
    auth_context: Annotated[object, Depends(get_current_auth_context)],
    session: Annotated[Session, Depends(get_db_session)],
) -> AuthAckV2:
    service = IdentityServiceV2(session)
    service.logout(auth_session=auth_context.auth_session)  # type: ignore[attr-defined]
    session.commit()
    clear_auth_cookies(response)
    return AuthAckV2(ok=True, message="logged out")


@router.get("/session", response_model=AuthSessionStateResponseV2)
def get_session(
    auth_context: Annotated[object, Depends(get_current_auth_context)],
    session: Annotated[Session, Depends(get_db_session)],
    request: Request,
) -> AuthSessionStateResponseV2:
    raw_token = request.cookies.get("auth_session_v2") or request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    return AuthSessionStateResponseV2(
        authenticated=True,
        user=_serialize_user(session, auth_context.user),  # type: ignore[attr-defined]
        session=_serialize_session(
            raw_token,
            auth_context.auth_session.issued_at,  # type: ignore[attr-defined]
            auth_context.auth_session.expires_at,  # type: ignore[attr-defined]
            auth_context.auth_session.id,  # type: ignore[attr-defined]
        ),
    )


@router.post("/send-code", response_model=SendCodeResponseV2)
def send_code(
    payload: SendCodeRequestV2,
    session: Annotated[Session, Depends(get_db_session)],
) -> SendCodeResponseV2:
    token, code = IdentityServiceV2(session).send_code(
        target_kind=payload.target_kind,
        target_value=payload.target_value,
        purpose=payload.purpose,
    )
    session.commit()
    return SendCodeResponseV2(ok=True, purpose=token.purpose, delivery="dev", dev_code=code)


@router.post("/verify-code", response_model=VerifyCodeResponseV2)
def verify_code(
    payload: VerifyCodeRequestV2,
    session: Annotated[Session, Depends(get_db_session)],
) -> VerifyCodeResponseV2:
    IdentityServiceV2(session).verify_code(
        target_kind=payload.target_kind,
        target_value=payload.target_value,
        purpose=payload.purpose,
        code=payload.code,
    )
    session.commit()
    return VerifyCodeResponseV2(verified=True, message="verification accepted")


@router.post("/reset-password", response_model=AuthAckV2)
def reset_password(
    payload: ResetPasswordRequestV2,
    session: Annotated[Session, Depends(get_db_session)],
) -> AuthAckV2:
    IdentityServiceV2(session).reset_password(
        identifier=payload.identifier,
        code=payload.code,
        new_password=payload.new_password,
    )
    session.commit()
    return AuthAckV2(ok=True, message="password updated")
