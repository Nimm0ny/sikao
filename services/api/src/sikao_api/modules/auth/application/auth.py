from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db import schemas
from sikao_api.db.models import User
from sikao_api.modules.system.application.errors import ConflictError, UnauthorizedError, ValidationError
from sikao_api.modules.auth.application.phone import normalize_phone
from sikao_api.modules.auth.application.security import (
    create_access_token,
    hash_password,
    verify_password,
)

IdentifierKind = Literal["email", "phone", "username_legacy"]


def detect_identifier_kind(identifier: str) -> IdentifierKind:
    """Identity v2 (D1 + D15): identifier 格式探测.

    - 含 `@` → email
    - normalize_phone 命中 → phone
    - 其他 → username_legacy (D15 老用户兼容路径; 仅 email 与 phone 都 NULL
      的老用户能命中, login_with_identifier 走 SQL filter 强制此约束)

    不验 identifier 内容合法性 — 仅探测格式. 实际 user lookup 在
    login_with_identifier 走 SQL WHERE 比对; 探测错也只是落到 username_legacy
    分支 SQL 命中 0 行 → 401 invalid_credentials.
    """
    s = identifier.strip()
    if "@" in s:
        return "email"
    if normalize_phone(s) is not None:
        return "phone"
    return "username_legacy"


def _build_display_name(
    *,
    payload_display_name: str | None,
    email: str | None = None,
    phone: str | None = None,
    username: str | None = None,
) -> str:
    """Identity v2 (review fix #6): display_name fallback 规则.

    优先级: payload.display_name (非空) → email split @ → f"用户{phone[-4:]}"
    → username (legacy register only). 任一非空 strip 即用; 全空 raise
    ValidationError (User.display_name NOT NULL).
    """
    cleaned = (payload_display_name or "").strip()
    if cleaned:
        return cleaned
    if email:
        local = email.split("@", 1)[0].strip()
        if local:
            return local
    if phone:
        return f"用户{phone[-4:]}"
    if username:
        return username
    raise ValidationError("display_name fallback exhausted (no email/phone/username)")


@dataclass
class LoginResult:
    """Internal result from AuthService.login/register.

    Post-Phase D N3: access_token 不再在 LoginResponseV2 body, 但路由层
    需要它去 Set-Cookie. 用 internal-only dataclass 让 service 返回完整
    元组, 路由层提取 access_token 后构造 public LoginResponseV2 (不含 token).
    """

    access_token: str
    expires_in: int
    user_summary: schemas.UserSummaryV2

    def to_response(self) -> schemas.LoginResponseV2:
        return schemas.LoginResponseV2(expires_in=self.expires_in, user=self.user_summary)


class AuthService:
    def __init__(self, session: Session, settings: Settings) -> None:
        self.session = session
        self.settings = settings

    def me(self, user: User) -> schemas.UserSummaryV2:
        return self.serialize_user(user)

    def serialize_user(self, user: User) -> schemas.UserSummaryV2:
        """Identity v2 (review fix #5/#7): 加 phone / phone_verified +
        needs_identifier_setup 派生字段 (email 与 phone 都 NULL → True).
        前端 router guard 据此 push /complete-profile.
        """
        return schemas.UserSummaryV2(
            id=user.id,
            username=user.username,
            display_name=user.display_name,
            email=user.email,
            email_verified=user.email_verified,
            phone=user.phone,
            phone_verified=user.phone_verified,
            needs_identifier_setup=(user.email is None and user.phone is None),
        )

    # ─── Identity v2 (D1, D3, D4, D6, D7, D10, D15) ────────────────────────
    # 老 login / register methods 已删 (commit #3d). 仅 login_with_identifier +
    # register_email + register_phone 三个 entry point.

    def login_with_identifier(
        self, payload: schemas.LoginIdentifierRequest
    ) -> LoginResult:
        """Identity v2 (D1 + D15): identifier 探测后按 kind 走不同 SQL filter.

        - email: WHERE email == identifier (lower)
        - phone: WHERE phone == normalize_phone(identifier)
        - username_legacy: WHERE username == identifier AND email IS NULL
          AND phone IS NULL (D15: 仅老 user — email/phone 都未设的 — 命中)
        """
        identifier = payload.identifier.strip()
        if not identifier:
            raise UnauthorizedError(
                "invalid identifier or password", code="invalid_credentials"
            )
        kind = detect_identifier_kind(identifier)
        user = self._lookup_by_identifier(identifier, kind)
        # Probe 一致: 用户不存在 / 错密码 / inactive 全报同样错误.
        if (
            user is None
            or not user.is_active
            or not verify_password(payload.password, user.password_hash)
        ):
            raise UnauthorizedError(
                "invalid identifier or password", code="invalid_credentials"
            )
        access_token, expires_in = create_access_token(
            settings=self.settings, user=user
        )
        return LoginResult(
            access_token=access_token,
            expires_in=expires_in,
            user_summary=self.serialize_user(user),
        )

    def _lookup_by_identifier(
        self, identifier: str, kind: IdentifierKind
    ) -> User | None:
        """Identity v2: SQL filter by detected identifier kind.

        D15 username_legacy 分支约束: email IS NULL AND phone IS NULL —
        防新 phone/email 注册的用户被 username 误命中 (新 user 可能 username
        留 NULL 或老昵称, 但 email/phone 已是主标识).
        """
        if kind == "email":
            from sikao_api.modules.auth.application.auth_recovery import normalize_email

            normalized_email = normalize_email(identifier)
            if not normalized_email:
                return None
            return self.session.scalar(
                select(User).where(User.email == normalized_email)
            )
        if kind == "phone":
            normalized_phone_val = normalize_phone(identifier)
            if normalized_phone_val is None:
                return None
            return self.session.scalar(
                select(User).where(User.phone == normalized_phone_val)
            )
        # username_legacy (D15)
        return self.session.scalar(
            select(User).where(
                User.username == identifier,
                User.email.is_(None),
                User.phone.is_(None),
            )
        )

    def register_email(
        self, payload: schemas.RegisterEmailRequest
    ) -> LoginResult:
        """Identity v2 (D3): email + password 注册. write-then-verify.

        email 唯一约束撞 → ConflictError("email_taken"). display_name fallback
        规则见 _build_display_name. user.username = NULL (新 user 不要 username).
        """
        from sikao_api.modules.auth.application.auth_recovery import normalize_email

        normalized_email = normalize_email(payload.email)
        if not normalized_email or "@" not in normalized_email:
            raise ValidationError("email must be valid")
        if (
            self.session.scalar(select(User).where(User.email == normalized_email))
            is not None
        ):
            raise ConflictError("email already registered", code="email_taken")
        display_name = _build_display_name(
            payload_display_name=payload.display_name,
            email=normalized_email,
        )
        user = User(
            username=None,
            display_name=display_name,
            password_hash=hash_password(payload.password),
            email=normalized_email,
            email_verified=False,
            phone=None,
            phone_verified=False,
            is_active=True,
        )
        self.session.add(user)
        self.session.flush()
        access_token, expires_in = create_access_token(
            settings=self.settings, user=user
        )
        return LoginResult(
            access_token=access_token,
            expires_in=expires_in,
            user_summary=self.serialize_user(user),
        )

    def register_phone(
        self,
        payload: schemas.RegisterPhoneRequest,
        *,
        sms_code_service: object | None = None,
        confirmer_ip: str | None = None,
    ) -> LoginResult:
        """Identity v2 (D4 + D10): phone + sms_code 注册. verify-then-write.

        sms_code 必须先验通过 (pre_register_codes purpose='register'); 验通过
        才创 user with phone_verified=True. phone 唯一约束撞 → ConflictError.

        sms_code_service 默认懒构造 (in-process, 与 self.session 共 transaction).
        Test 注入 mock 跳过真 verify; 注入路径用 SmsCodeService duck-type
        (verify_code(target_kind, target_value, purpose, code, confirmer_ip?)).
        """
        normalized_phone = normalize_phone(payload.phone)
        if normalized_phone is None:
            raise ValidationError("phone must be 11-digit mainland China format")

        # 撞 unique 提前拦 (D18 review fix bind 入口预检, 注册同模式).
        if (
            self.session.scalar(
                select(User).where(User.phone == normalized_phone)
            )
            is not None
        ):
            raise ConflictError("phone already registered", code="phone_taken")

        # 懒构造 sms_code_service (跟 self.session 共 transaction).
        if sms_code_service is None:
            from sikao_api.modules.auth.application.sms_code import SmsCodeService

            sms_code_service = SmsCodeService(self.session, self.settings)
        # verify_code 失败 raise GoneError("code_invalid"), 调用方 (route)
        # 把 GoneError 翻译成 410 + code=code_invalid (跟 reset-password 同模式).
        sms_code_service.verify_code(  # type: ignore[attr-defined]
            target_kind="phone",
            target_value=normalized_phone,
            purpose="register",
            code=payload.sms_code,
            confirmer_ip=confirmer_ip,
        )

        display_name = _build_display_name(
            payload_display_name=payload.display_name,
            phone=normalized_phone,
        )
        user = User(
            username=None,
            display_name=display_name,
            password_hash=hash_password(payload.password),
            email=None,
            email_verified=False,
            phone=normalized_phone,
            phone_verified=True,  # D10 verify-then-write: 写入即 verified
            is_active=True,
        )
        self.session.add(user)
        self.session.flush()
        access_token, expires_in = create_access_token(
            settings=self.settings, user=user
        )
        return LoginResult(
            access_token=access_token,
            expires_in=expires_in,
            user_summary=self.serialize_user(user),
        )
