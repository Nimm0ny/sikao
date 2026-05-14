"""Auth binding service — Identity v2 (D10/D11/D12/D16/D18).

Bind / unbind orchestrator: 已登录 user 给自己的 user.phone / user.email 加 /
换 / 解绑. 跟 AuthRecoveryService (forgot-password / register-email-verify) 互补.

设计:
  - **D10 verify-then-write**: send-code/send-link 不写 user; confirm verify
    通过才写. 防 typo 覆盖丢号.
  - **D12 password confirm**: bind/unbind 都是敏感操作, 必须 password 二次校验.
  - **D16 token kind 隔离**: bind 流走 PreRegisterCode (with user_id, purpose=
    'bind_email'/'bind_phone'), 跟 register 流的 AuthToken (kind=
    'email_verify') / 直接 user 表写入完全隔离.
  - **D18 unique 入口预检**: confirm 入口先查 newPhone/newEmail 是否被别 user
    占, 撞 → 409 code=identifier_taken (不消耗 SMS/email code attempt).
  - **#4a user_id 强校验**: SmsCodeService.verify_code 用 user_id 强匹配, 防
    attacker 偷 victim token 在自己 session confirm.

Unbind (D11): 必须保留至少一个**已 verified** identifier. 解 phone 要求
email IS NOT NULL AND email_verified=True; 反之亦然. 否则 reject 带 code=
identifier_must_remain_verified.
"""

from __future__ import annotations

import logging
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db.models import User
from sikao_api.modules.system.infrastructure.email.provider import EmailProvider
from sikao_api.modules.system.application.errors import ConflictError, ForbiddenError, ValidationError
from sikao_api.modules.auth.application.phone import normalize_phone
from sikao_api.modules.auth.application.security import verify_password
from sikao_api.modules.system.infrastructure.sms.provider import SMSProvider
from sikao_api.modules.auth.application.sms_code import SmsCodeService

logger = logging.getLogger(__name__)


def _build_bind_email_link(settings: Settings, raw_token: str) -> str:
    base = settings.frontend_base_url.rstrip("/")
    return f"{base}/bind-email?token={raw_token}"


class AuthBindingService:
    """Bind / unbind 4 + 2 流程. 不直 emit HTTP, 由 route 层接.

    Constructor 注入 sms_code_service / sms_provider / email_provider 让 test
    能 mock 不真发短信/邮件.
    """

    def __init__(
        self,
        session: Session,
        settings: Settings,
        *,
        sms_code_service: SmsCodeService | None = None,
        sms_provider: SMSProvider | None = None,
        email_provider: EmailProvider | None = None,
    ) -> None:
        self.session = session
        self.settings = settings
        self._sms_code_service = sms_code_service or SmsCodeService(session, settings)
        # sms / email provider 默认懒构造 (avoid circular: route 层注入更干净).
        self._sms_provider = sms_provider
        self._email_provider = email_provider

    # ---- bind phone ------------------------------------------------------

    def bind_phone_send_code(
        self,
        user: User,
        phone: str,
        *,
        requester_ip: str | None = None,
    ) -> str:
        """Logged-in user 给 newPhone 发 SMS code. D10 不写 user.phone.

        D18 入口预检: newPhone 已被别 user 占 → ConflictError. 自己已绑同
        phone → ConflictError (不允许重复 bind 同 phone, 浪费 SMS).

        Returns: raw 6-digit code (route 层 dev gate 决定是否暴露给 client).
        """
        normalized = normalize_phone(phone)
        if normalized is None:
            raise ValidationError(
                "phone must be 11-digit mainland China format"
            )
        # D18 unique 入口预检 (在 verify_code 之前 — 不消耗 attempt).
        existing = self.session.scalar(
            select(User).where(User.phone == normalized)
        )
        if existing is not None and existing.id == user.id:
            raise ConflictError(
                "phone already bound to this account",
                code="phone_already_bound",
            )
        if existing is not None:
            raise ConflictError(
                "phone already bound to another account",
                code="phone_taken",
            )

        raw_code = self._sms_code_service.issue_code(
            target_kind="phone",
            target_value=normalized,
            purpose="bind_phone",
            user_id=user.id,
            requester_ip=requester_ip,
        )
        if self._sms_provider is None:
            from sikao_api.modules.system.infrastructure.sms import build_sms_provider

            self._sms_provider = build_sms_provider(self.settings)
        # SMS provider 失败 swallow + log (跟 forgot-password D5 silent 同模式).
        try:
            self._sms_provider.send_verify_code(
                to_phone=normalized,
                code=raw_code,
                purpose="bind_phone",
            )
        except Exception as exc:  # noqa: BLE001 — fail-open by design
            logger.error(
                "auth_binding.send_bind_sms.failed user_id=%s phone=%s err=%s",
                user.id,
                normalized,
                exc,
            )
        return raw_code

    def bind_phone_confirm(
        self,
        user: User,
        phone: str,
        sms_code: str,
        password: str,
        *,
        confirmer_ip: str | None = None,
    ) -> User:
        """Verify code + password → 写 user.phone + phone_verified=True.

        D12 password confirm 必填. D18 unique 入口再次预检 (race window:
        send-code 时未占, confirm 时被别 user 抢). #4a SmsCodeService 用
        user_id 强匹配防 token leak.
        """
        if not verify_password(password, user.password_hash):
            raise ForbiddenError(
                "password confirmation failed", code="password_invalid"
            )
        normalized = normalize_phone(phone)
        if normalized is None:
            raise ValidationError(
                "phone must be 11-digit mainland China format"
            )
        # D18 race-safe 二次预检.
        existing = self.session.scalar(
            select(User).where(User.phone == normalized)
        )
        if existing is not None and existing.id != user.id:
            raise ConflictError(
                "phone already bound to another account",
                code="phone_taken",
            )

        # SmsCodeService.verify_code 失败 raise GoneError("code_invalid"),
        # route 翻译成 410.
        self._sms_code_service.verify_code(
            target_kind="phone",
            target_value=normalized,
            purpose="bind_phone",
            code=sms_code,
            user_id=user.id,
            confirmer_ip=confirmer_ip,
        )

        user.phone = normalized
        user.phone_verified = True
        self.session.flush()
        return user

    # ---- bind email ------------------------------------------------------

    def bind_email_send_link(
        self,
        user: User,
        email: str,
        *,
        requester_ip: str | None = None,
    ) -> str:
        """Logged-in user 给 newEmail 发 verify link. D10 不写 user.email.

        D18 入口预检 (newEmail 别 user 占 / 自己已绑). Token 是
        secrets.token_urlsafe(32) (43 char base64) 跟 password_reset 同熵.
        Returns: raw token (route 层 dev gate 暴露 _devMagicLink).
        """
        from sikao_api.modules.auth.application.auth_recovery import normalize_email

        normalized = normalize_email(email)
        if not normalized or "@" not in normalized:
            raise ValidationError("email must be valid")
        existing = self.session.scalar(
            select(User).where(User.email == normalized)
        )
        if existing is not None and existing.id == user.id:
            raise ConflictError(
                "email already bound to this account",
                code="email_already_bound",
            )
        if existing is not None:
            raise ConflictError(
                "email already bound to another account",
                code="email_taken",
            )

        # token 跟 reset_password / register email_verify 同熵: 32-byte
        # base64-urlsafe (~256 bits 安全余量).
        raw_token = secrets.token_urlsafe(32)
        self._sms_code_service.issue_code(
            target_kind="email",
            target_value=normalized,
            purpose="bind_email",
            user_id=user.id,
            requester_ip=requester_ip,
            raw_code=raw_token,
        )

        if self._email_provider is None:
            from sikao_api.modules.system.infrastructure.email import build_email_provider

            self._email_provider = build_email_provider(self.settings)
        link = _build_bind_email_link(self.settings, raw_token)
        # B-review B3 同模式: provider 失败 swallow + log (silent-200, 不 leak
        # email 是否注册过).
        try:
            self._email_provider.send_email_verify(to=normalized, link=link)
        except Exception as exc:  # noqa: BLE001 — fail-open by design
            logger.error(
                "auth_binding.send_bind_email.failed user_id=%s email=%s err=%s",
                user.id,
                normalized,
                exc,
            )
        return raw_token

    def bind_email_confirm(
        self,
        user: User,
        token: str,
        password: str,
    ) -> User:
        """Verify token + password → 写 user.email + email_verified=True.

        D12 password confirm. D18 二次预检. #4a SmsCodeService user_id 强匹配.

        Note: token 在 PreRegisterCode 里以 sha256 hash 存; raw token 是
        send-link 时 return 给 route 层拼 link. confirm 端走 verify_code
        SQL WHERE 比对 (D19 防时序攻击).
        """
        if not verify_password(password, user.password_hash):
            raise ForbiddenError(
                "password confirmation failed", code="password_invalid"
            )
        # confirm 时不知道 newEmail (token 自己鉴权 — 用 user_id+purpose+hash
        # WHERE 命中唯一 row, 然后从 row 读 target_value 写 user.email).
        # 但 SmsCodeService.verify_code 必须传 target_value, 我们用 user_id
        # purpose 反查 active row 拿 target_value.
        # D19 hash lookup: WHERE code_hash + user_id + purpose 命中唯一 row.
        # ORM-level 不需要 target_value, 因为 user_id+purpose+hash 已 unique
        # (replace 模式保证同 user 同 purpose 同时只 1 active code).
        from sikao_api.db.models import PreRegisterCode, utc_now
        from sikao_api.modules.auth.application.sms_code import _hash_code

        now_ts = utc_now()
        row = self.session.scalar(
            select(PreRegisterCode).where(
                PreRegisterCode.user_id == user.id,
                PreRegisterCode.purpose == "bind_email",
                PreRegisterCode.code_hash == _hash_code(token),
                PreRegisterCode.used_at.is_(None),
                PreRegisterCode.expires_at > now_ts,
            )
        )
        if row is None:
            from sikao_api.modules.system.application.errors import GoneError

            raise GoneError(
                "invalid or expired bind link", code="token_invalid"
            )
        new_email = row.target_value

        # D18 二次预检 (race window: send-link 时未占, confirm 时被抢).
        existing = self.session.scalar(
            select(User).where(User.email == new_email)
        )
        if existing is not None and existing.id != user.id:
            raise ConflictError(
                "email already bound to another account",
                code="email_taken",
            )

        # 调 SmsCodeService.verify_code 让它走 mark used + attempt 累计 path.
        # 已 hash lookup 命中, 这次 verify 必命中 + mark used.
        self._sms_code_service.verify_code(
            target_kind="email",
            target_value=new_email,
            purpose="bind_email",
            code=token,
            user_id=user.id,
        )

        user.email = new_email
        user.email_verified = True
        self.session.flush()
        return user

    # ---- unbind (D11 solo-verified 保留) -----------------------------------

    def unbind_phone(self, user: User, password: str) -> User:
        """Unbind user.phone — D11: email 必须 IS NOT NULL AND email_verified=True
        (留至少一个 verified identifier 防账号死锁).

        D12 password confirm. 已 unbind 状态 (user.phone IS NULL) → no-op-style
        success (avoid leaking state via 409). 但用户已无 phone 通常不会触此
        endpoint, 当 idempotent.
        """
        if not verify_password(password, user.password_hash):
            raise ForbiddenError(
                "password confirmation failed", code="password_invalid"
            )
        if user.phone is None:
            # 已 unbind, idempotent.
            return user
        # D11: 必须保留至少一个已 verified identifier (这里是 email).
        if user.email is None or not user.email_verified:
            raise ConflictError(
                "must keep at least one verified identifier (email)",
                code="identifier_must_remain_verified",
            )
        user.phone = None
        user.phone_verified = False
        self.session.flush()
        return user

    def unbind_email(self, user: User, password: str) -> User:
        """Unbind user.email — D11 反向: phone 必须 IS NOT NULL AND
        phone_verified=True.
        """
        if not verify_password(password, user.password_hash):
            raise ForbiddenError(
                "password confirmation failed", code="password_invalid"
            )
        if user.email is None:
            return user
        if user.phone is None or not user.phone_verified:
            raise ConflictError(
                "must keep at least one verified identifier (phone)",
                code="identifier_must_remain_verified",
            )
        user.email = None
        user.email_verified = False
        self.session.flush()
        return user
