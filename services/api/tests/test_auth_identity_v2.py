"""AuthService Identity v2 unit tests — commit #3b.

Covers:
- detect_identifier_kind: email / phone / username_legacy 三态
- _build_display_name: fallback chain (payload → email split → 用户XXXX → username)
- login_with_identifier: email / phone (含 +86 normalize) / username_legacy
  (D15 仅老 user) / wrong password / inactive
- register_email: happy + duplicate + normalize + display_name fallback
- register_phone: happy + sms code 验通过 + phone duplicate + sms_code 错 +
  phone normalize + phone_verified=True 写入
- serialize_user: needs_identifier_setup 派生
- create_access_token: payload 无 username (review fix #5) + 有 displayName

老 AuthService.login / register 的测试不在本文件 (commit #3c 删那俩 method
后顺手清理 tests).
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import jwt
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from sikao_api.core.config import Settings
from sikao_api.db.base import Base
from sikao_api.db import schemas
from sikao_api.db.models import User
from sikao_api.modules.auth.application.auth import (
    AuthService,
    _build_display_name,
    detect_identifier_kind,
)
from sikao_api.modules.system.application.errors import (
    ConflictError,
    GoneError,
    UnauthorizedError,
    ValidationError,
)
from sikao_api.modules.auth.application.security import create_access_token, hash_password


@pytest.fixture
def session() -> Iterator[Session]:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False, future=True
    )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def settings() -> Settings:
    return Settings(_env_file=None)  # type: ignore[call-arg]


@pytest.fixture
def service(session: Session, settings: Settings) -> AuthService:
    return AuthService(session, settings)


def _make_user(
    session: Session,
    *,
    username: str | None = None,
    email: str | None = None,
    phone: str | None = None,
    email_verified: bool = False,
    phone_verified: bool = False,
    is_active: bool = True,
    password: str = "Password123!",
    display_name: str | None = None,
) -> User:
    user = User(
        username=username,
        password_hash=hash_password(password),
        display_name=display_name or username or email or phone or "User",
        is_active=is_active,
        email=email,
        email_verified=email_verified,
        phone=phone,
        phone_verified=phone_verified,
    )
    session.add(user)
    session.flush()
    return user


# ─── detect_identifier_kind ────────────────────────────────


@pytest.mark.parametrize(
    "identifier,expected",
    [
        ("alice@example.com", "email"),
        ("user+tag@example.com", "email"),
        ("13800138000", "phone"),
        ("+86 138 0013 8000", "phone"),
        ("86-138-0013-8000", "phone"),
        ("alice", "username_legacy"),
        ("foo123", "username_legacy"),
        # Phone-format-fail (1 后第二位 0-2): 落 username_legacy
        ("12800138000", "username_legacy"),
    ],
)
def test_detect_identifier_kind(identifier: str, expected: str) -> None:
    assert detect_identifier_kind(identifier) == expected


# ─── _build_display_name (review fix #6) ───────────────────


def test_build_display_name_uses_payload_when_provided() -> None:
    assert _build_display_name(
        payload_display_name="Alice", email="x@example.com"
    ) == "Alice"


def test_build_display_name_strips_payload() -> None:
    assert _build_display_name(payload_display_name="  Alice  ", email=None) == "Alice"


def test_build_display_name_falls_back_to_email_local_part() -> None:
    assert _build_display_name(
        payload_display_name=None, email="alice@example.com"
    ) == "alice"


def test_build_display_name_falls_back_to_phone_last_4() -> None:
    assert _build_display_name(
        payload_display_name=None, phone="13800138000"
    ) == "用户8000"


def test_build_display_name_email_takes_precedence_over_phone() -> None:
    """Email + phone 都给时 email 优先 (按 fallback chain 顺序)."""
    assert _build_display_name(
        payload_display_name=None, email="alice@example.com", phone="13800138000"
    ) == "alice"


def test_build_display_name_raises_when_all_empty() -> None:
    with pytest.raises(ValidationError):
        _build_display_name(payload_display_name=None)


# ─── login_with_identifier ─────────────────────────────────


def test_login_with_identifier_email_happy(
    service: AuthService, session: Session
) -> None:
    _make_user(session, email="alice@example.com", password="Pass123!")
    result = service.login_with_identifier(
        schemas.LoginIdentifierRequest(
            identifier="alice@example.com", password="Pass123!"
        )
    )
    assert result.user_summary.email == "alice@example.com"


def test_login_with_identifier_email_normalized_lookup(
    service: AuthService, session: Session
) -> None:
    """Email 大小写不敏感 lookup (normalize_email lower)."""
    _make_user(session, email="alice@example.com", password="Pass123!")
    result = service.login_with_identifier(
        schemas.LoginIdentifierRequest(
            identifier="ALICE@Example.COM", password="Pass123!"
        )
    )
    assert result.user_summary.id


def test_login_with_identifier_phone_happy(
    service: AuthService, session: Session
) -> None:
    _make_user(session, phone="13800138000", password="Pass123!")
    result = service.login_with_identifier(
        schemas.LoginIdentifierRequest(
            identifier="13800138000", password="Pass123!"
        )
    )
    assert result.user_summary.phone == "13800138000"


def test_login_with_identifier_phone_with_plus86_input(
    service: AuthService, session: Session
) -> None:
    """User 输 +86 13800138000 应当 normalize 后命中 phone=13800138000 row."""
    _make_user(session, phone="13800138000", password="Pass123!")
    result = service.login_with_identifier(
        schemas.LoginIdentifierRequest(
            identifier="+86 13800138000", password="Pass123!"
        )
    )
    assert result.user_summary.phone == "13800138000"


def test_login_with_identifier_username_legacy_happy(
    service: AuthService, session: Session
) -> None:
    """D15: 老 user (email/phone 都 NULL) 仍能 username + password 登录."""
    _make_user(
        session, username="alice", email=None, phone=None, password="Pass123!"
    )
    result = service.login_with_identifier(
        schemas.LoginIdentifierRequest(identifier="alice", password="Pass123!")
    )
    assert result.user_summary.username == "alice"


def test_login_with_identifier_username_legacy_blocks_user_with_email(
    service: AuthService, session: Session
) -> None:
    """D15 SQL 约束: username_legacy 仅命中 email IS NULL AND phone IS NULL.

    有 email 的 user 即使 username 匹配也不命中 — 强制走 email/phone 主标识.
    """
    _make_user(
        session,
        username="alice",
        email="alice@example.com",
        password="Pass123!",
    )
    with pytest.raises(UnauthorizedError) as exc_info:
        service.login_with_identifier(
            schemas.LoginIdentifierRequest(identifier="alice", password="Pass123!")
        )
    assert exc_info.value.code == "invalid_credentials"


def test_login_with_identifier_wrong_password(
    service: AuthService, session: Session
) -> None:
    _make_user(session, email="alice@example.com", password="Pass123!")
    with pytest.raises(UnauthorizedError):
        service.login_with_identifier(
            schemas.LoginIdentifierRequest(
                identifier="alice@example.com", password="WrongPass!"
            )
        )


def test_login_with_identifier_inactive_user(
    service: AuthService, session: Session
) -> None:
    _make_user(
        session, email="alice@example.com", password="Pass123!", is_active=False
    )
    with pytest.raises(UnauthorizedError):
        service.login_with_identifier(
            schemas.LoginIdentifierRequest(
                identifier="alice@example.com", password="Pass123!"
            )
        )


def test_login_with_identifier_nonexistent(service: AuthService) -> None:
    with pytest.raises(UnauthorizedError):
        service.login_with_identifier(
            schemas.LoginIdentifierRequest(
                identifier="ghost@example.com", password="Pass123!"
            )
        )


# ─── register_email ────────────────────────────────────────


def test_register_email_happy(service: AuthService, session: Session) -> None:
    result = service.register_email(
        schemas.RegisterEmailRequest(
            email="alice@example.com", password="Pass123!"
        )
    )
    user = session.scalar(select(User).where(User.email == "alice@example.com"))
    assert user is not None
    assert user.username is None  # phone-style 注册无 username
    assert user.email_verified is False  # write-then-verify (D3)
    assert user.phone is None
    assert result.user_summary.email == "alice@example.com"


def test_register_email_normalizes_email(
    service: AuthService, session: Session
) -> None:
    """大小写 / 空格输入应 normalize 后存."""
    service.register_email(
        schemas.RegisterEmailRequest(
            email="  ALICE@Example.COM  ", password="Pass123!"
        )
    )
    user = session.scalar(select(User).where(User.email == "alice@example.com"))
    assert user is not None


def test_register_email_duplicate_raises_conflict(
    service: AuthService, session: Session
) -> None:
    service.register_email(
        schemas.RegisterEmailRequest(email="alice@example.com", password="Pass123!")
    )
    with pytest.raises(ConflictError) as exc_info:
        service.register_email(
            schemas.RegisterEmailRequest(
                email="ALICE@example.com", password="OtherPass!"
            )
        )
    assert exc_info.value.code == "email_taken"


def test_register_email_display_name_fallback_to_email_local(
    service: AuthService, session: Session
) -> None:
    """payload 无 display_name → fallback split('@')[0]."""
    service.register_email(
        schemas.RegisterEmailRequest(
            email="alice@example.com", password="Pass123!"
        )
    )
    user = session.scalar(select(User).where(User.email == "alice@example.com"))
    assert user is not None
    assert user.display_name == "alice"


# ─── register_phone (mock SmsCodeService) ──────────────────


class _StubSmsCodeService:
    """Test stub: verify_code accepts a fixed valid code; raises GoneError otherwise."""

    def __init__(self, valid_code: str = "123456") -> None:
        self._valid = valid_code
        self.last_call: dict[str, Any] | None = None

    def verify_code(
        self,
        *,
        target_kind: str,
        target_value: str,
        purpose: str,
        code: str,
        confirmer_ip: str | None = None,
    ) -> None:
        self.last_call = {
            "target_kind": target_kind,
            "target_value": target_value,
            "purpose": purpose,
            "code": code,
            "confirmer_ip": confirmer_ip,
        }
        if code != self._valid:
            raise GoneError("invalid or expired code", code="code_invalid")


def test_register_phone_happy_with_valid_sms_code(
    service: AuthService, session: Session
) -> None:
    stub = _StubSmsCodeService(valid_code="123456")
    result = service.register_phone(
        schemas.RegisterPhoneRequest(
            phone="13800138000", sms_code="123456", password="Pass123!"
        ),
        sms_code_service=stub,
    )
    user = session.scalar(select(User).where(User.phone == "13800138000"))
    assert user is not None
    assert user.username is None
    assert user.email is None
    assert user.phone_verified is True  # D10 verify-then-write 写入即 verified
    assert result.user_summary.phone == "13800138000"
    # SmsCodeService 调用参数核对
    assert stub.last_call is not None
    assert stub.last_call["target_kind"] == "phone"
    assert stub.last_call["target_value"] == "13800138000"  # normalized
    assert stub.last_call["purpose"] == "register"


def test_register_phone_normalizes_input(
    service: AuthService, session: Session
) -> None:
    """+86 / 空格 / 横线输入应 normalize 后存."""
    stub = _StubSmsCodeService(valid_code="123456")
    service.register_phone(
        schemas.RegisterPhoneRequest(
            phone="+86 138-0013-8000", sms_code="123456", password="Pass123!"
        ),
        sms_code_service=stub,
    )
    user = session.scalar(select(User).where(User.phone == "13800138000"))
    assert user is not None


def test_register_phone_duplicate_raises_conflict(
    service: AuthService, session: Session
) -> None:
    """D18: phone 已被占 → ConflictError(code='phone_taken'), 不进 verify_code."""
    _make_user(session, phone="13800138000", password="Existing!")
    stub = _StubSmsCodeService(valid_code="123456")
    with pytest.raises(ConflictError) as exc_info:
        service.register_phone(
            schemas.RegisterPhoneRequest(
                phone="13800138000", sms_code="123456", password="Pass123!"
            ),
            sms_code_service=stub,
        )
    assert exc_info.value.code == "phone_taken"
    # 撞 unique 入口预检 — 不该走到 verify_code (避免发码 / attempt 计数浪费).
    assert stub.last_call is None


def test_register_phone_invalid_sms_code_raises_gone(
    service: AuthService, session: Session
) -> None:
    """SMS code 错 / 过期 / used → SmsCodeService.verify_code raise GoneError."""
    stub = _StubSmsCodeService(valid_code="123456")
    with pytest.raises(GoneError) as exc_info:
        service.register_phone(
            schemas.RegisterPhoneRequest(
                phone="13800138000", sms_code="999999", password="Pass123!"
            ),
            sms_code_service=stub,
        )
    assert exc_info.value.code == "code_invalid"
    # SMS verify 失败 → user 不该写库
    assert (
        session.scalar(select(User).where(User.phone == "13800138000")) is None
    )


def test_register_phone_display_name_fallback_to_last_4(
    service: AuthService, session: Session
) -> None:
    """payload 无 display_name → fallback f'用户{phone[-4:]}'."""
    stub = _StubSmsCodeService(valid_code="123456")
    service.register_phone(
        schemas.RegisterPhoneRequest(
            phone="13800138000", sms_code="123456", password="Pass123!"
        ),
        sms_code_service=stub,
    )
    user = session.scalar(select(User).where(User.phone == "13800138000"))
    assert user is not None
    assert user.display_name == "用户8000"


# ─── serialize_user (needs_identifier_setup 派生) ─────────


def test_serialize_user_needs_identifier_setup_when_both_null(
    service: AuthService, session: Session
) -> None:
    user = _make_user(session, username="alice", email=None, phone=None)
    summary = service.serialize_user(user)
    assert summary.needs_identifier_setup is True


def test_serialize_user_no_setup_needed_when_email_set(
    service: AuthService, session: Session
) -> None:
    user = _make_user(session, email="alice@example.com")
    summary = service.serialize_user(user)
    assert summary.needs_identifier_setup is False


def test_serialize_user_no_setup_needed_when_phone_set(
    service: AuthService, session: Session
) -> None:
    user = _make_user(session, phone="13800138000")
    summary = service.serialize_user(user)
    assert summary.needs_identifier_setup is False


def test_serialize_user_includes_phone_fields(
    service: AuthService, session: Session
) -> None:
    user = _make_user(
        session, phone="13800138000", phone_verified=True
    )
    summary = service.serialize_user(user)
    assert summary.phone == "13800138000"
    assert summary.phone_verified is True


# ─── JWT payload (review fix #5) ───────────────────────────


def test_jwt_payload_has_no_username_field(
    session: Session, settings: Settings
) -> None:
    """review fix #5: payload 删 'username' 字段 (decode 端只读 sub)."""
    user = _make_user(session, username="alice", email="alice@example.com")
    token, _ = create_access_token(settings=settings, user=user)
    payload = jwt.decode(
        token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
    )
    assert "username" not in payload


def test_jwt_payload_has_displayname(
    session: Session, settings: Settings
) -> None:
    """displayName 保留 — frontend 解码 cookie 不查 DB 拿名字."""
    user = _make_user(
        session, email="alice@example.com", display_name="Alice"
    )
    token, _ = create_access_token(settings=settings, user=user)
    payload = jwt.decode(
        token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
    )
    assert payload["displayName"] == "Alice"


def test_jwt_payload_has_sub_as_user_id(
    session: Session, settings: Settings
) -> None:
    user = _make_user(session, email="alice@example.com")
    token, _ = create_access_token(settings=settings, user=user)
    payload = jwt.decode(
        token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
    )
    assert payload["sub"] == str(user.id)
