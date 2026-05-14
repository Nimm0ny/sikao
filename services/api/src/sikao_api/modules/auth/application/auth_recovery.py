"""Auth recovery service — Phase B (forgot-password + email-verify).

Token model (per plan §3):
- raw token: secrets.token_urlsafe(32) → 43 char base64
- DB stores sha256(raw) hex (64 char) — D4
- single-use: used_at NULL → 可用; 一旦 set → reject
- TTL: settings.auth_*_ttl_minutes (D2/D3)
- D6: reset 成功 invalidate 同 user 其他 active password_reset token
- P1-6: forgot 重复请求 invalidate 同 user 同 kind 旧 unused token (替 rate-limit)

Error semantics: 任何 bad token (不存在 / 已用 / 过期) 都返 `GoneError`
+ code="token_invalid" — 不让攻击者通过 status code / code 区分 "假 token"
vs "真 token 但过期".
"""

from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db.models import AuthToken, User, utc_now
from sikao_api.modules.system.infrastructure.email import EmailProvider
from sikao_api.modules.system.application.errors import GoneError, ValidationError
from sikao_api.modules.auth.application.security import hash_password

logger = logging.getLogger(__name__)


KIND_PASSWORD_RESET = "password_reset"
KIND_EMAIL_VERIFY = "email_verify"


def normalize_email(email: str) -> str:
    """Lowercase + strip. 在 register / forgot / profile-update 用同一份."""
    return email.strip().lower()


def _generate_raw_token() -> str:
    """43-char base64 url-safe, 32 byte 熵. 匹配 plan §3."""
    return secrets.token_urlsafe(32)


def _hash_token(raw: str) -> str:
    """sha256(raw) hex (64 char). DB-stored only."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _build_password_reset_link(settings: Settings, raw_token: str) -> str:
    base = settings.frontend_base_url.rstrip("/")
    return f"{base}/reset-password?token={raw_token}"


def _build_email_verify_link(settings: Settings, raw_token: str) -> str:
    base = settings.frontend_base_url.rstrip("/")
    return f"{base}/verify-email?token={raw_token}"


def _invalidate_unused_tokens(
    session: Session, user_id: int, kind: str, now_ts: object
) -> None:
    """Mark used_at=now_ts on user 同 kind 所有 unused tokens.

    P1-6 (forgot 重复请求) + D6 (reset 成功后 invalidate 其它). 共用一个
    update SQL 让重放窗口最小化.
    """
    session.execute(
        update(AuthToken)
        .where(
            AuthToken.user_id == user_id,
            AuthToken.kind == kind,
            AuthToken.used_at.is_(None),
        )
        .values(used_at=now_ts)
    )


def _lookup_token(session: Session, raw_token: str, kind: str) -> AuthToken | None:
    """Hash + lookup by kind. 不过滤 used / expired —— 调用方分别检查."""
    if not raw_token:
        return None
    return session.scalar(
        select(AuthToken).where(
            AuthToken.token_hash == _hash_token(raw_token),
            AuthToken.kind == kind,
        )
    )


def _consume_token_or_raise(token: AuthToken | None, *, now_ts: datetime) -> AuthToken:
    """检查 token 状态, mark used_at, 否则 raise GoneError.

    Pure helper — 不 flush. 调 site flush + 处理后续 user state.
    """
    if token is None:
        raise GoneError("invalid or expired token", code="token_invalid")
    if token.used_at is not None or token.expires_at <= now_ts:
        # 不区分 used vs expired — 攻击者 probe 不到额外信息.
        raise GoneError("invalid or expired token", code="token_invalid")
    token.used_at = now_ts
    return token


class AuthRecoveryService:
    """Forgot-password + email-verify orchestrator. 不直 emit HTTP, 由 route 层接."""

    def __init__(
        self,
        session: Session,
        settings: Settings,
        email_provider: EmailProvider,
    ) -> None:
        self.session = session
        self.settings = settings
        self.email_provider = email_provider

    # ---- password reset ---------------------------------------------------

    def request_password_reset(self, email: str) -> str | None:
        """D5: 总返 200, 不暴露 email 是否存在.

        Return: link string (供 dev_magic_link gate 用) 或 None (user 不存在 /
        inactive / email 空). Route handler 决定是否暴露 _devMagicLink.
        """
        normalized = normalize_email(email)
        if not normalized:
            return None
        user = self.session.scalar(select(User).where(User.email == normalized))
        if user is None or not user.is_active:
            return None
        return self._issue_reset_token_and_send(user)

    def _issue_reset_token_and_send(self, user: User) -> str:
        """Helper: invalidate-prior + new token + provider.send. 拆给 SRP."""
        now_ts = utc_now()
        _invalidate_unused_tokens(self.session, user.id, KIND_PASSWORD_RESET, now_ts)
        raw = _generate_raw_token()
        ttl_min = self.settings.auth_password_reset_ttl_minutes
        token = AuthToken(
            user_id=user.id,
            kind=KIND_PASSWORD_RESET,
            token_hash=_hash_token(raw),
            expires_at=now_ts + timedelta(minutes=ttl_min),
        )
        self.session.add(token)
        self.session.flush()
        link = _build_password_reset_link(self.settings, raw)
        # email may be None already filtered out at caller — narrow for type checker.
        assert user.email is not None
        # B-review B3 (SECURITY): D5 silent-200 必须 byte-identical 不论 email
        # 存在与否. Resend 等真 SaaS 抛 HTTPStatusError (4xx/5xx) 会冒到 route 返 500
        # → attacker 通过 200 vs 500 enumerate 哪些 email 注册过. 在 service 层
        # swallow 邮件发送错误 (token 已 store, link return 仍走). ops 看 logger
        # 知道 provider 出问题了, 用户体验仍是"邮件没收到, 重试 / 检查垃圾邮箱".
        try:
            self.email_provider.send_password_reset(to=user.email, link=link)
        except Exception as exc:  # noqa: BLE001 — fail-open by design (D5)
            logger.error(
                "auth_recovery.send_password_reset.failed user_id=%s err=%s",
                user.id,
                exc,
            )
        return link

    def reset_password(self, raw_token: str, new_password: str) -> User:
        if not new_password:
            raise ValidationError("new password must not be empty")
        now_ts = utc_now()
        token = _consume_token_or_raise(
            _lookup_token(self.session, raw_token, KIND_PASSWORD_RESET),
            now_ts=now_ts,
        )
        user = self.session.get(User, token.user_id)
        if user is None or not user.is_active:
            # 极少见: token 有效但 user 在 TTL 内被删除/禁用. 当 token 失效处理.
            raise GoneError("invalid or expired token", code="token_invalid")
        user.password_hash = hash_password(new_password)
        # D6: invalidate 同 user 其它 unused reset token, 减重放窗口.
        _invalidate_unused_tokens(self.session, user.id, KIND_PASSWORD_RESET, now_ts)
        self.session.flush()
        return user

    # ---- email verify -----------------------------------------------------

    def request_email_verify(self, user: User) -> str | None:
        """已验过 / 没 email → None (no-op). 否则发新 token + invalidate 旧."""
        if user.email is None or user.email_verified:
            return None
        return self._issue_verify_token_and_send(user)

    def _issue_verify_token_and_send(self, user: User) -> str:
        now_ts = utc_now()
        _invalidate_unused_tokens(self.session, user.id, KIND_EMAIL_VERIFY, now_ts)
        raw = _generate_raw_token()
        ttl_min = self.settings.auth_email_verify_ttl_minutes
        token = AuthToken(
            user_id=user.id,
            kind=KIND_EMAIL_VERIFY,
            token_hash=_hash_token(raw),
            expires_at=now_ts + timedelta(minutes=ttl_min),
        )
        self.session.add(token)
        self.session.flush()
        link = _build_email_verify_link(self.settings, raw)
        assert user.email is not None
        self.email_provider.send_email_verify(to=user.email, link=link)
        return link

    def confirm_email_verify(self, raw_token: str) -> User:
        now_ts = utc_now()
        token = _consume_token_or_raise(
            _lookup_token(self.session, raw_token, KIND_EMAIL_VERIFY),
            now_ts=now_ts,
        )
        user = self.session.get(User, token.user_id)
        if user is None or not user.is_active:
            raise GoneError("invalid or expired token", code="token_invalid")
        user.email_verified = True
        self.session.flush()
        return user

