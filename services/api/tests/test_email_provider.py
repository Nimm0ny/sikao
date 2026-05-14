"""Email provider factory tests — Phase B.2.

Cover: factory dispatch + dev gate runtime validation.
"""

from __future__ import annotations

import logging

import pytest

from sikao_api.core.config import Settings
from sikao_api.modules.system.infrastructure.email import build_email_provider
from sikao_api.modules.system.infrastructure.email.noop_provider import NoopEmailProvider
from sikao_api.modules.system.infrastructure.email.stub_provider import StubEmailProvider


def _make_settings(**overrides: object) -> Settings:
    """Settings(_env_file=None) 隔离 .env, 用 overrides 注 fields."""
    return Settings(_env_file=None, **overrides)  # type: ignore[call-arg]


def test_factory_returns_stub_by_default() -> None:
    settings = _make_settings()
    provider = build_email_provider(settings)
    assert isinstance(provider, StubEmailProvider)


def test_factory_returns_noop_when_configured() -> None:
    settings = _make_settings(email_provider="noop")
    provider = build_email_provider(settings)
    assert isinstance(provider, NoopEmailProvider)


def test_stub_provider_logs_password_reset(caplog: pytest.LogCaptureFixture) -> None:
    """Stub send_password_reset 必须把 to + link 写 logger.info."""
    provider = StubEmailProvider()
    with caplog.at_level(logging.INFO, logger="sikao_api.modules.system.infrastructure.email.stub_provider"):
        provider.send_password_reset(to="alice@example.com", link="http://x/r/abc")
    record = next(r for r in caplog.records if r.name.endswith("stub_provider"))
    assert "alice@example.com" in record.getMessage()
    assert "http://x/r/abc" in record.getMessage()


def test_stub_provider_logs_email_verify(caplog: pytest.LogCaptureFixture) -> None:
    provider = StubEmailProvider()
    with caplog.at_level(logging.INFO, logger="sikao_api.modules.system.infrastructure.email.stub_provider"):
        provider.send_email_verify(to="bob@example.com", link="http://x/v/xyz")
    record = next(
        r
        for r in caplog.records
        if r.name.endswith("stub_provider") and "email_verify" in r.getMessage()
    )
    assert "bob@example.com" in record.getMessage()
    assert "http://x/v/xyz" in record.getMessage()


def test_noop_provider_silent() -> None:
    """Noop 不应该 log, 也不抛."""
    provider = NoopEmailProvider()
    # 跑两次不爆即 happy path; 没 stderr 副作用断言 (logger 配置环境敏感).
    provider.send_password_reset(to="x@y", link="http://x/r/1")
    provider.send_email_verify(to="x@y", link="http://x/v/1")


def test_prod_blocks_dev_expose_magic_link() -> None:
    """P1-3 兜底: prod + dev_expose=True 必须 fail-fast."""
    settings = _make_settings(
        app_env="prod",
        dev_expose_magic_link=True,
        auth_cookie_secure=True,  # 不让 prod cookie secure 兜底先 fire
        jwt_secret="not-default-changeme",
    )
    with pytest.raises(RuntimeError, match="DEV_EXPOSE_MAGIC_LINK"):
        settings.validate_runtime()


def test_poc_also_blocks_dev_expose_magic_link() -> None:
    """poc 等同 prod, 单机部署也不让 leak."""
    settings = _make_settings(
        app_env="poc",
        dev_expose_magic_link=True,
        database_url="postgresql+pg8000://x:y@h/d",  # poc 强制 PG
    )
    with pytest.raises(RuntimeError, match="DEV_EXPOSE_MAGIC_LINK"):
        settings.validate_runtime()


def test_local_dev_expose_magic_link_allowed() -> None:
    """local + dev_expose=True 是预期 dev 用法, 不应 fail."""
    settings = _make_settings(
        app_env="local",
        dev_expose_magic_link=True,
    )
    settings.validate_runtime()  # 不抛即 OK
