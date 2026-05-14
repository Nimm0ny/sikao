from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBasic, HTTPBasicCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.core.deps import get_app_settings
from sikao_api.db.session import get_db_session
from sikao_api.db.models import User
from sikao_api.modules.system.application.errors import ForbiddenError, UnauthorizedError

password_hasher = PasswordHasher()
basic_security = HTTPBasic(auto_error=False)
bearer_security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return password_hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def create_access_token(*, settings: Settings, user: User) -> tuple[str, int]:
    """Create JWT access token.

    Post-Phase D N4: iat (issued-at) + jti (unique id) payload 字段保证
    同秒 refresh 也产生不同 token (HS256 deterministic + exp 到秒精度否则
    payload 一致 → token bytes 一致). jti 也给将来 token revoke / blacklist
    留口 (现 PoC 暂不 verify, decode 接受 ignore).

    Identity v2 (review fix #5): 删 `username` payload 字段 — username 已
    nullable 且不再作为登录 identifier; decode 端只读 `sub`, 不消费 username.
    保留 `displayName` 给 frontend 显示用 (cookie 解码后可不查 DB 拿名字).
    """
    import secrets

    issued_at = datetime.now(UTC)
    expires_in = settings.jwt_access_token_exp_minutes * 60
    expires_at = issued_at + timedelta(seconds=expires_in)
    payload = {
        "sub": str(user.id),
        "displayName": user.display_name,
        "iat": issued_at,
        "exp": expires_at,
        "jti": secrets.token_hex(16),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm), expires_in


def decode_access_token(token: str, settings: Settings) -> dict[str, str]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise UnauthorizedError("invalid access token", code="invalid_token") from exc
    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject.isdigit():
        raise UnauthorizedError("invalid token subject", code="invalid_token")
    return {"user_id": subject}


def authenticate_admin(
    credentials: HTTPBasicCredentials | None,
    settings: Settings,
) -> str:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="admin authentication required",
            headers={"WWW-Authenticate": "Basic"},
        )
    if credentials.username != settings.admin_username or not verify_password(credentials.password, settings.admin_password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid admin credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


def get_admin_principal(
    credentials: Annotated[HTTPBasicCredentials | None, Depends(basic_security)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> str:
    return authenticate_admin(credentials, settings)


AUTH_COOKIE_NAME = "auth_token"
CSRF_COOKIE_NAME = "csrf_token"
CSRF_HEADER_NAME = "X-CSRF-Token"


def generate_csrf_token() -> str:
    """32-byte urlsafe random token (Phase B.3 double-submit cookie pattern)."""
    import secrets
    return secrets.token_urlsafe(32)


def verify_csrf_token(request: Request) -> None:
    """Double-submit cookie verification.

    Reads `csrf_token` cookie + `X-CSRF-Token` header; both must be present and
    equal. Mismatch / missing → 403. Used as a FastAPI dependency on
    state-mutating routes (POST/PATCH/DELETE) per CSRF coverage table in
    docs/plan/backend-srp-and-jwt-cookie.md Phase B.3.

    login/register exclude this dependency since they set the initial cookie.
    """
    cookie_token = request.cookies.get(CSRF_COOKIE_NAME)
    header_token = request.headers.get(CSRF_HEADER_NAME)
    if not cookie_token or not header_token:
        raise ForbiddenError("missing csrf token", code="csrf_missing")
    if cookie_token != header_token:
        raise ForbiddenError("csrf token mismatch", code="csrf_mismatch")


def verify_csrf_token_if_cookie_auth(request: Request) -> None:
    """CSRF check ONLY when the caller is using cookie auth.

    Post-Phase D P0-1: anonymous-allowed practice paths (start / submit /
    complete) accept BOTH anonymous (no cookie) and logged-in users (cookie
    present). When cookie auth is used, a cross-origin attacker can fetch
    with credentials:'include' to act on the victim's behalf — the classic
    CSRF surface. Solution: require CSRF only when the auth_token cookie
    is present; pure-anonymous traffic skips the check (no cookie to
    forge).

    Behavior:
      - auth_token cookie absent → no-op (anonymous PoC demo path).
      - auth_token cookie present → delegate to verify_csrf_token (strict
        double-submit). Bearer-only callers also skip since they don't
        set a cookie; they're CSRF-immune by transport.
    """
    if request.cookies.get(AUTH_COOKIE_NAME):
        verify_csrf_token(request)


def _get_token_from_request(
    request: Request,
    bearer: HTTPAuthorizationCredentials | None,
) -> str | None:
    """Extract JWT from cookie (preferred) OR Authorization Bearer header (fallback).

    P1 review fix Phase B.1b (impl). Cookie precedence per Phase B.1a contract.
    """
    cookie_value = request.cookies.get(AUTH_COOKIE_NAME)
    if cookie_value:
        return cookie_value
    if bearer is not None and bearer.credentials:
        return bearer.credentials
    return None


def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_security)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> User:
    token = _get_token_from_request(request, credentials)
    if token is None:
        raise UnauthorizedError("authentication required")
    payload = decode_access_token(token, settings)
    user = session.get(User, int(payload["user_id"]))
    if user is None or not user.is_active:
        raise UnauthorizedError("user not found", code="user_not_found")
    return user


def get_optional_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_security)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> User | None:
    token = _get_token_from_request(request, credentials)
    if token is None:
        return None
    payload = decode_access_token(token, settings)
    user = session.get(User, int(payload["user_id"]))
    if user is None or not user.is_active:
        raise UnauthorizedError("user not found", code="user_not_found")
    return user


def require_session_owner(session_user_id: int, user: User) -> None:
    if session_user_id != user.id:
        raise ForbiddenError("session does not belong to the current user", code="session_forbidden")


def get_request_ids(request: Request) -> tuple[str | None, str | None]:
    return getattr(request.state, "request_id", None), getattr(request.state, "trace_id", None)


def get_user_by_username(session: Session, username: str) -> User | None:
    return session.scalar(select(User).where(User.username == username))
