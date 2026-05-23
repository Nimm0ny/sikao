from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from hashlib import pbkdf2_hmac, sha256
import hmac
import secrets
from typing import Annotated

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import AuthSessionV2, EmailContactV2, PasswordCredentialV2, PhoneContactV2, UserV2
from sikao_api.db.session import get_db_session
from sikao_api.modules.system.application.errors import ForbiddenError, UnauthorizedError

bearer_security = HTTPBearer(auto_error=False)

AUTH_SESSION_COOKIE_NAME = "auth_session_v2"
CSRF_COOKIE_NAME = "csrf_token_v2"
CSRF_HEADER_NAME = "X-CSRF-Token"
SESSION_LIFETIME = timedelta(days=7)
_LEGACY_ARGON2 = PasswordHasher()


@dataclass(frozen=True)
class AuthContextV2:
    user: UserV2
    auth_session: AuthSessionV2


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 600_000)
    return f"pbkdf2_sha256${salt.hex()}${digest.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    if password_hash.startswith("pbkdf2_sha256$"):
        try:
            algorithm, salt_hex, digest_hex = password_hash.split("$", 2)
        except ValueError:
            return False
        if algorithm != "pbkdf2_sha256":
            return False
        digest = pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt_hex),
            600_000,
        )
        return hmac.compare_digest(digest.hex(), digest_hex)
    try:
        return _LEGACY_ARGON2.verify(password_hash, password)
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def normalize_email(value: str) -> str:
    return value.strip().lower()


def normalize_phone(value: str) -> str:
    digits = "".join(ch for ch in value if ch.isdigit())
    if digits.startswith("86") and len(digits) > 11:
        digits = digits[2:]
    return digits


def hash_token(raw_token: str) -> str:
    return sha256(raw_token.encode("utf-8")).hexdigest()


def generate_raw_token() -> str:
    return secrets.token_urlsafe(32)


def generate_verification_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def build_auth_session(*, user: UserV2) -> tuple[AuthSessionV2, str]:
    raw_token = generate_raw_token()
    issued_at = datetime.now(UTC).replace(tzinfo=None)
    auth_session = AuthSessionV2(
        user=user,
        token_hash=hash_token(raw_token),
        csrf_token=generate_csrf_token(),
        issued_at=issued_at,
        expires_at=issued_at + SESSION_LIFETIME,
    )
    return auth_session, raw_token


def set_auth_cookies(
    response: Response,
    *,
    raw_token: str,
    csrf_token: str,
    expires_at: datetime,
    secure: bool,
) -> None:
    max_age = int((expires_at.replace(tzinfo=UTC) - datetime.now(UTC)).total_seconds())
    response.set_cookie(
        AUTH_SESSION_COOKIE_NAME,
        raw_token,
        max_age=max_age,
        httponly=True,
        samesite="strict",
        secure=secure,
        path="/",
    )
    response.set_cookie(
        CSRF_COOKIE_NAME,
        csrf_token,
        max_age=max_age,
        httponly=False,
        samesite="strict",
        secure=secure,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(AUTH_SESSION_COOKIE_NAME, path="/")
    response.delete_cookie(CSRF_COOKIE_NAME, path="/")


def verify_csrf_v2(request: Request) -> None:
    if not request.cookies.get(AUTH_SESSION_COOKIE_NAME):
        return
    cookie_token = request.cookies.get(CSRF_COOKIE_NAME)
    header_token = request.headers.get(CSRF_HEADER_NAME)
    if not cookie_token or not header_token:
        raise ForbiddenError("missing csrf token", code="csrf_missing")
    if cookie_token != header_token:
        raise ForbiddenError("csrf token mismatch", code="csrf_mismatch")


def _extract_session_token(
    request: Request, credentials: HTTPAuthorizationCredentials | None
) -> str | None:
    cookie_token = request.cookies.get(AUTH_SESSION_COOKIE_NAME)
    if cookie_token:
        return cookie_token
    if credentials is not None and credentials.credentials:
        return credentials.credentials
    return None


def _extract_optional_session_token(request: Request) -> str | None:
    cookie_token = request.cookies.get(AUTH_SESSION_COOKIE_NAME)
    if cookie_token:
        return cookie_token

    authorization = request.headers.get("Authorization")
    if authorization is None:
        return None
    scheme, _, credentials = authorization.partition(" ")
    if scheme.lower() != "bearer" or not credentials:
        return None
    return credentials


def get_current_auth_context(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_security)],
    session: Annotated[Session, Depends(get_db_session)],
) -> AuthContextV2:
    raw_token = _extract_session_token(request, credentials)
    if raw_token is None:
        raise UnauthorizedError("authentication required", code="auth_required")
    token_hash = hash_token(raw_token)
    auth_session = session.scalar(
        select(AuthSessionV2).where(AuthSessionV2.token_hash == token_hash)
    )
    if auth_session is None:
        raise UnauthorizedError("session not found", code="session_not_found")
    # Check user state BEFORE session state so deleted users get a clear 403
    # signal even when their sessions have been revoked (revocation always
    # accompanies soft-delete; without this order, the 403 branch is dead code).
    user = session.get(UserV2, auth_session.user_id)
    if user is None:
        raise UnauthorizedError("user not available", code="user_not_available")
    if user.deleted_at is not None:
        raise ForbiddenError("account has been deactivated", code="account_deleted")
    if not user.is_active:
        raise UnauthorizedError("user not available", code="user_not_available")
    if auth_session.revoked_at is not None:
        raise UnauthorizedError("session revoked", code="session_revoked")
    now = datetime.now(UTC).replace(tzinfo=None)
    if auth_session.expires_at <= now:
        raise UnauthorizedError("session expired", code="session_expired")
    request.state.current_user_v2_id = user.id
    return AuthContextV2(user=user, auth_session=auth_session)


def get_current_user_v2(
    context: Annotated[AuthContextV2, Depends(get_current_auth_context)]
) -> UserV2:
    return context.user


def get_optional_current_user_v2(
    request: Request,
    session: Annotated[Session, Depends(get_db_session)],
) -> UserV2 | None:
    raw_token = _extract_optional_session_token(request)
    if raw_token is None:
        return None
    token_hash = hash_token(raw_token)
    auth_session = session.scalar(
        select(AuthSessionV2).where(AuthSessionV2.token_hash == token_hash)
    )
    if auth_session is None:
        return None
    user = session.get(UserV2, auth_session.user_id)
    if user is None:
        return None
    if user.deleted_at is not None:
        return None
    if not user.is_active:
        return None
    if auth_session.revoked_at is not None:
        return None
    now = datetime.now(UTC).replace(tzinfo=None)
    if auth_session.expires_at <= now:
        return None
    return user


def get_current_session_v2(
    context: Annotated[AuthContextV2, Depends(get_current_auth_context)]
) -> AuthSessionV2:
    return context.auth_session


def find_user_by_identifier(session: Session, identifier: str) -> UserV2 | None:
    normalized_email = normalize_email(identifier)
    email_contact = session.scalar(
        select(EmailContactV2).where(EmailContactV2.email == normalized_email)
    )
    if email_contact is not None:
        return session.get(UserV2, email_contact.user_id)
    normalized_phone = normalize_phone(identifier)
    if normalized_phone:
        phone_contact = session.scalar(
            select(PhoneContactV2).where(PhoneContactV2.phone == normalized_phone)
        )
        if phone_contact is not None:
            return session.get(UserV2, phone_contact.user_id)
    return None


def load_password_credential(session: Session, user_id: int) -> PasswordCredentialV2 | None:
    return session.scalar(
        select(PasswordCredentialV2).where(PasswordCredentialV2.user_id == user_id)
    )
