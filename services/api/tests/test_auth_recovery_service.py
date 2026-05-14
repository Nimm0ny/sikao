"""AuthRecoveryService unit tests — Phase B.3.

Cover:
- request_password_reset: empty / nonexistent / inactive / happy / repeat invalidates
- reset_password: invalid / expired / used / happy / new password works / D6
- request_email_verify: no email / already verified / happy / repeat invalidates
- confirm_email_verify: invalid / expired / used / happy
- update_user_email: empty / happy with verified→False reset (P1-5)
- normalize_email: lower + strip
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import timedelta

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from sikao_api.core.config import Settings
from sikao_api.db.base import Base
from sikao_api.db.models import AuthToken, User, utc_now
from sikao_api.modules.auth.application.auth_recovery import (
    KIND_EMAIL_VERIFY,
    KIND_PASSWORD_RESET,
    AuthRecoveryService,
    normalize_email,
)
from sikao_api.modules.system.infrastructure.email.stub_provider import StubEmailProvider
from sikao_api.modules.system.application.errors import GoneError, ValidationError
from sikao_api.modules.auth.application.security import hash_password, verify_password


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
    """Local-mode settings, no .env load."""
    return Settings(_env_file=None)  # type: ignore[call-arg]


@pytest.fixture
def service(session: Session, settings: Settings) -> AuthRecoveryService:
    return AuthRecoveryService(session, settings, StubEmailProvider())


def _make_user(
    session: Session,
    *,
    username: str = "alice",
    email: str | None = "alice@example.com",
    is_active: bool = True,
    email_verified: bool = False,
    password: str = "OrigPass123!",
) -> User:
    user = User(
        username=username,
        password_hash=hash_password(password),
        display_name=username,
        is_active=is_active,
        email=email,
        email_verified=email_verified,
    )
    session.add(user)
    session.flush()
    return user


# ---- normalize_email -------------------------------------------------------


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("Alice@Example.com", "alice@example.com"),
        ("  bob@x.io  ", "bob@x.io"),
        ("CAPS@DOMAIN.NET", "caps@domain.net"),
        ("", ""),
    ],
)
def test_normalize_email(raw: str, expected: str) -> None:
    assert normalize_email(raw) == expected


# ---- request_password_reset ------------------------------------------------


def test_request_reset_empty_email(service: AuthRecoveryService) -> None:
    assert service.request_password_reset("") is None
    assert service.request_password_reset("   ") is None


def test_request_reset_nonexistent_email(service: AuthRecoveryService) -> None:
    """D5: 不存在 email 必须 silent (None), 不抛."""
    assert service.request_password_reset("ghost@example.com") is None


def test_request_reset_inactive_user(service: AuthRecoveryService, session: Session) -> None:
    _make_user(session, is_active=False)
    assert service.request_password_reset("alice@example.com") is None


def test_request_reset_happy_path(service: AuthRecoveryService, session: Session) -> None:
    _make_user(session)
    link = service.request_password_reset("alice@example.com")
    assert link is not None
    assert "/reset-password?token=" in link
    # exactly 1 active token
    tokens = session.scalars(select(AuthToken)).all()
    assert len(tokens) == 1
    assert tokens[0].kind == KIND_PASSWORD_RESET
    assert tokens[0].used_at is None


def test_request_reset_case_insensitive(service: AuthRecoveryService, session: Session) -> None:
    """user.email 用 lowercase 存; lookup 也 lowercase. 输入 mixed case 一样命中."""
    _make_user(session, email="alice@example.com")
    link = service.request_password_reset("Alice@EXAMPLE.com")
    assert link is not None


def test_request_reset_invalidates_prior_unused(
    service: AuthRecoveryService, session: Session
) -> None:
    """P1-6: 重复请求让旧 token 立即失效 (替 rate-limit)."""
    user = _make_user(session)
    link1 = service.request_password_reset("alice@example.com")
    link2 = service.request_password_reset("alice@example.com")
    assert link1 != link2
    tokens = session.scalars(
        select(AuthToken).where(AuthToken.user_id == user.id)
    ).all()
    # both rows present, but only the latest is unused
    assert len(tokens) == 2
    unused_count = sum(1 for t in tokens if t.used_at is None)
    assert unused_count == 1


# ---- reset_password --------------------------------------------------------


def test_reset_password_happy_path(
    service: AuthRecoveryService, session: Session
) -> None:
    user = _make_user(session)
    link = service.request_password_reset("alice@example.com")
    assert link is not None
    raw_token = link.split("token=")[1]

    service.reset_password(raw_token, "NewPass456!")

    session.refresh(user)
    assert verify_password("NewPass456!", user.password_hash)
    assert not verify_password("OrigPass123!", user.password_hash)
    # token mark used
    tk = session.scalar(select(AuthToken).where(AuthToken.user_id == user.id))
    assert tk is not None and tk.used_at is not None


def test_reset_password_empty_password_rejected(
    service: AuthRecoveryService, session: Session
) -> None:
    _make_user(session)
    link = service.request_password_reset("alice@example.com")
    assert link is not None
    raw = link.split("token=")[1]
    with pytest.raises(ValidationError):
        service.reset_password(raw, "")


def test_reset_password_invalid_token(service: AuthRecoveryService) -> None:
    with pytest.raises(GoneError):
        service.reset_password("totally-fake-token", "NewPass123!")


def test_reset_password_used_token(
    service: AuthRecoveryService, session: Session
) -> None:
    _make_user(session)
    link = service.request_password_reset("alice@example.com")
    assert link is not None
    raw = link.split("token=")[1]
    service.reset_password(raw, "First!")
    with pytest.raises(GoneError):
        service.reset_password(raw, "Second!")


def test_reset_password_expired_token(
    service: AuthRecoveryService, session: Session
) -> None:
    user = _make_user(session)
    link = service.request_password_reset("alice@example.com")
    assert link is not None
    raw = link.split("token=")[1]
    # backdate expiry
    tk = session.scalar(select(AuthToken).where(AuthToken.user_id == user.id))
    assert tk is not None
    tk.expires_at = utc_now() - timedelta(seconds=1)
    session.flush()
    with pytest.raises(GoneError):
        service.reset_password(raw, "NewPass!")


def test_reset_password_invalidates_other_active_tokens(
    service: AuthRecoveryService, session: Session
) -> None:
    """D6: 成功 reset 后, user 的其它 unused reset token 也失效."""
    user = _make_user(session)
    # request 两次 → 第二次自动 invalidate 第一次. 但 D6 是关于 reset 后的状态.
    # 先伪造两条 active token: 直插一条额外的 unused token.
    link = service.request_password_reset("alice@example.com")
    assert link is not None
    extra_raw = "extra-raw-token-for-test"
    from hashlib import sha256

    extra = AuthToken(
        user_id=user.id,
        kind=KIND_PASSWORD_RESET,
        token_hash=sha256(extra_raw.encode()).hexdigest(),
        expires_at=utc_now() + timedelta(hours=1),
    )
    session.add(extra)
    session.flush()
    raw = link.split("token=")[1]

    service.reset_password(raw, "NewOne!")

    # 直插的 extra token 现在应该 used_at 非空
    session.refresh(extra)
    assert extra.used_at is not None


# ---- request_email_verify --------------------------------------------------


def test_request_verify_no_email(
    service: AuthRecoveryService, session: Session
) -> None:
    user = _make_user(session, email=None)
    assert service.request_email_verify(user) is None


def test_request_verify_already_verified(
    service: AuthRecoveryService, session: Session
) -> None:
    user = _make_user(session, email_verified=True)
    assert service.request_email_verify(user) is None


def test_request_verify_happy_path(
    service: AuthRecoveryService, session: Session
) -> None:
    user = _make_user(session)
    link = service.request_email_verify(user)
    assert link is not None
    assert "/verify-email?token=" in link
    tokens = session.scalars(
        select(AuthToken).where(AuthToken.user_id == user.id)
    ).all()
    assert len(tokens) == 1
    assert tokens[0].kind == KIND_EMAIL_VERIFY


# ---- confirm_email_verify --------------------------------------------------


def test_confirm_email_verify_happy_path(
    service: AuthRecoveryService, session: Session
) -> None:
    user = _make_user(session, email_verified=False)
    link = service.request_email_verify(user)
    assert link is not None
    raw = link.split("token=")[1]
    service.confirm_email_verify(raw)
    session.refresh(user)
    assert user.email_verified is True


def test_confirm_email_verify_invalid(service: AuthRecoveryService) -> None:
    with pytest.raises(GoneError):
        service.confirm_email_verify("nope")


# update_user_email tests deleted (#3d): the helper itself was removed
# (D10 review fix #2 unsafe — typo overwrites email + loses verified state).
# Replacement is /auth/bind/email/* (commit #4 — verify-then-write).


# ─── B-review B3 regression: provider failure must NOT propagate (D5) ────


class _FailingEmailProvider:
    """Mocks Resend / 真 SaaS provider 抛 HTTPStatusError 等. 防 future commit
    无意中让 provider error 冒到 forgot-password endpoint 返 500 → enumerate.
    """

    def send_password_reset(self, *, to: str, link: str) -> None:  # noqa: ARG002
        raise RuntimeError("simulated Resend 503 / network down")

    def send_email_verify(self, *, to: str, link: str) -> None:  # noqa: ARG002
        raise RuntimeError("simulated Resend 503")


def test_request_password_reset_swallows_email_send_failure(
    session: Session, settings: Settings
) -> None:
    """B-review B3 (SECURITY) regression: D5 byte-identical 200 必须保证 —
    Resend / 真 SaaS provider 抛 error 时 service 内部 swallow + logger.error.
    没此守护, 攻击者通过 forgot-password 200 vs 500 能 enumerate 哪些 email
    已注册.
    """
    user = _make_user(session, email="alice@example.com")
    failing_service = AuthRecoveryService(session, settings, _FailingEmailProvider())

    # Provider 抛错时 request_password_reset 必须 NOT propagate.
    # link 仍 return (token 已 store + dev_magic_link gate 还能用).
    link = failing_service.request_password_reset("alice@example.com")
    assert link is not None  # token + link 已生成, 只是邮件没发出去

    # Token 实际写入了 (D5 同样 timing — 不让 attacker 发现 provider down).
    from sqlalchemy import select as _select

    from sikao_api.db.models import AuthToken

    tokens = session.scalars(
        _select(AuthToken).where(AuthToken.user_id == user.id)
    ).all()
    assert len(tokens) == 1
