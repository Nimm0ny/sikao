from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import (
    AuthSessionV2,
    EmailContactV2,
    PasswordCredentialV2,
    PhoneContactV2,
    UserV2,
    VerificationTokenV2,
)
from sikao_api.modules.identity.application.security_v2 import (
    build_auth_session,
    find_user_by_identifier,
    generate_verification_code,
    hash_password,
    hash_token,
    load_password_credential,
    normalize_email,
    normalize_phone,
    verify_password,
)
from sikao_api.modules.system.application.errors import ConflictError, NotFoundError, UnauthorizedError, ValidationError


VerificationPurpose = Literal["register", "reset_password", "login", "bind"]
TargetKind = Literal["email", "phone"]
_RESERVED_ADMIN_EMAIL_PREFIX = "__admin__."
_RESERVED_ADMIN_EMAIL_DOMAIN = "@system.local"


class IdentityServiceV2:
    def __init__(self, session: Session) -> None:
        self.session = session

    def register_email(self, *, email: str, password: str, display_name: str) -> tuple[UserV2, AuthSessionV2, str]:
        normalized = normalize_email(email)
        if _is_reserved_admin_email(normalized):
            raise ValidationError(
                "email namespace is reserved",
                code="reserved_email_namespace",
            )
        if self.session.scalar(select(EmailContactV2).where(EmailContactV2.email == normalized)) is not None:
            raise ConflictError("email already registered", code="email_taken")
        user = UserV2(display_name=display_name)
        credential = PasswordCredentialV2(user=user, password_hash=hash_password(password))
        contact = EmailContactV2(user=user, email=normalized, is_primary=True, is_verified=False)
        auth_session, raw_token = build_auth_session(user=user)
        self.session.add_all([user, credential, contact, auth_session])
        self.session.flush()
        return user, auth_session, raw_token

    def register_phone(
        self,
        *,
        phone: str,
        sms_code: str,
        password: str,
        display_name: str,
    ) -> tuple[UserV2, AuthSessionV2, str]:
        normalized = normalize_phone(phone)
        if not normalized:
            raise ValidationError("invalid phone", code="invalid_phone")
        if self.session.scalar(select(PhoneContactV2).where(PhoneContactV2.phone == normalized)) is not None:
            raise ConflictError("phone already registered", code="phone_taken")
        self.verify_code(
            target_kind="phone",
            target_value=normalized,
            purpose="register",
            code=sms_code,
        )
        user = UserV2(display_name=display_name)
        credential = PasswordCredentialV2(user=user, password_hash=hash_password(password))
        contact = PhoneContactV2(user=user, phone=normalized, is_primary=True, is_verified=True)
        auth_session, raw_token = build_auth_session(user=user)
        self.session.add_all([user, credential, contact, auth_session])
        self.session.flush()
        return user, auth_session, raw_token

    def login(self, *, identifier: str, password: str) -> tuple[UserV2, AuthSessionV2, str]:
        user = find_user_by_identifier(self.session, identifier)
        if user is None or not user.is_active:
            raise UnauthorizedError("invalid credentials", code="invalid_credentials")
        credential = load_password_credential(self.session, user.id)
        if credential is None or not verify_password(password, credential.password_hash):
            raise UnauthorizedError("invalid credentials", code="invalid_credentials")
        auth_session, raw_token = build_auth_session(user=user)
        self.session.add(auth_session)
        self.session.flush()
        return user, auth_session, raw_token

    def logout(self, *, auth_session: AuthSessionV2) -> None:
        auth_session.revoked_at = datetime.now(UTC).replace(tzinfo=None)
        self.session.add(auth_session)

    def send_code(
        self, *, target_kind: TargetKind, target_value: str, purpose: VerificationPurpose
    ) -> tuple[VerificationTokenV2, str]:
        normalized = normalize_email(target_value) if target_kind == "email" else normalize_phone(target_value)
        if not normalized:
            raise ValidationError("invalid target value", code="invalid_target")
        if target_kind == "email" and _is_reserved_admin_email(normalized):
            raise ValidationError(
                "email namespace is reserved",
                code="reserved_email_namespace",
            )
        code = generate_verification_code()
        token = VerificationTokenV2(
            target_kind=target_kind,
            target_value=normalized,
            purpose=purpose,
            code_hash=hash_token(code),
            expires_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(minutes=15),
        )
        self.session.add(token)
        self.session.flush()
        return token, code

    def verify_code(
        self, *, target_kind: TargetKind, target_value: str, purpose: VerificationPurpose, code: str
    ) -> VerificationTokenV2:
        normalized = normalize_email(target_value) if target_kind == "email" else normalize_phone(target_value)
        token = self.session.scalar(
            select(VerificationTokenV2)
            .where(VerificationTokenV2.target_kind == target_kind)
            .where(VerificationTokenV2.target_value == normalized)
            .where(VerificationTokenV2.purpose == purpose)
            .where(VerificationTokenV2.used_at.is_(None))
            .order_by(VerificationTokenV2.created_at.desc())
        )
        if token is None:
            raise NotFoundError("verification token not found", code="verification_not_found")
        now = datetime.now(UTC).replace(tzinfo=None)
        if token.expires_at <= now:
            raise UnauthorizedError("verification token expired", code="verification_expired")
        if token.code_hash != hash_token(code):
            raise UnauthorizedError("verification code mismatch", code="verification_mismatch")
        token.verified_at = now
        token.used_at = now
        self.session.add(token)
        return token

    def reset_password(self, *, identifier: str, code: str, new_password: str) -> UserV2:
        user = find_user_by_identifier(self.session, identifier)
        if user is None:
            raise NotFoundError("user not found", code="user_not_found")
        target_kind: TargetKind
        target_value: str
        if "@" in identifier:
            target_kind = "email"
            target_value = normalize_email(identifier)
        else:
            target_kind = "phone"
            target_value = normalize_phone(identifier)
        self.verify_code(
            target_kind=target_kind,
            target_value=target_value,
            purpose="reset_password",
            code=code,
        )
        credential = load_password_credential(self.session, user.id)
        if credential is None:
            credential = PasswordCredentialV2(user_id=user.id, password_hash=hash_password(new_password))
            self.session.add(credential)
        else:
            credential.password_hash = hash_password(new_password)
            self.session.add(credential)
        revoked_at = datetime.now(UTC).replace(tzinfo=None)
        active_sessions = self.session.scalars(
            select(AuthSessionV2)
            .where(AuthSessionV2.user_id == user.id)
            .where(AuthSessionV2.revoked_at.is_(None))
        ).all()
        for auth_session in active_sessions:
            auth_session.revoked_at = revoked_at
            self.session.add(auth_session)
        return user


def _is_reserved_admin_email(value: str) -> bool:
    return value.startswith(_RESERVED_ADMIN_EMAIL_PREFIX) and value.endswith(
        _RESERVED_ADMIN_EMAIL_DOMAIN
    )
