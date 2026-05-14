"""SMS provider factory + stub/noop tests — Identity v2 (D8).

Covers: factory dispatch + stub log content + noop silent + factory
tencent config-validation. TencentCloudSMSProvider 内部行为测试在
test_tencent_sms_provider.py (mock SDK, dev 不需要装 [sms] extra).
"""

from __future__ import annotations

import logging

import pytest

from sikao_api.core.config import Settings
from sikao_api.modules.system.infrastructure.sms import build_sms_provider
from sikao_api.modules.system.infrastructure.sms.noop_provider import NoopSMSProvider
from sikao_api.modules.system.infrastructure.sms.stub_provider import StubSMSProvider


def _make_settings(**overrides: object) -> Settings:
    """Settings(_env_file=None) 隔离 .env, 用 overrides 注 fields."""
    return Settings(_env_file=None, **overrides)  # type: ignore[call-arg]


# ─── Factory dispatch ────────────────────────────────────────


def test_factory_returns_stub_by_default() -> None:
    settings = _make_settings()
    provider = build_sms_provider(settings)
    assert isinstance(provider, StubSMSProvider)


def test_factory_returns_noop_when_configured() -> None:
    settings = _make_settings(sms_provider="noop")
    provider = build_sms_provider(settings)
    assert isinstance(provider, NoopSMSProvider)


def test_factory_tencent_raises_when_config_incomplete() -> None:
    """Factory 兜底验 6 个必填字段缺失 raise — validate_runtime 第二道防线
    (避免 Settings(_env_file=None) 绕过 validate_runtime 落到弱配置).
    """
    settings = _make_settings(sms_provider="tencent")  # 6 字段都 None
    with pytest.raises(RuntimeError, match="requires all 6"):
        build_sms_provider(settings)


def test_factory_tencent_returns_provider_when_fully_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """6 字段配齐 + monkeypatch lazy SDK helpers → factory 返 TencentCloudSMSProvider.

    比 sys.modules 整链 mock 简单: patch _import_sdk_or_raise +
    _build_default_client 两个 helper 即可跳过整个 tencentcloud import 链.
    """
    from types import SimpleNamespace
    from unittest.mock import MagicMock

    from sikao_api.modules.system.infrastructure.sms import tencent_provider as tp

    fake_models = SimpleNamespace(SendSmsRequest=SimpleNamespace)
    fake_client = MagicMock()
    monkeypatch.setattr(tp, "_import_sdk_or_raise", lambda: (fake_models, None))
    monkeypatch.setattr(tp, "_build_default_client", lambda cfg: fake_client)

    settings = _make_settings(
        sms_provider="tencent",
        tencent_sms_secret_id="sid",
        tencent_sms_secret_key="skey",
        tencent_sms_app_id="1400000000",
        tencent_sms_sign_name="思考",
        tencent_sms_template_register="100001",
        tencent_sms_template_bind="100002",
    )
    from sikao_api.modules.system.infrastructure.sms.tencent_provider import TencentCloudSMSProvider

    provider = build_sms_provider(settings)
    assert isinstance(provider, TencentCloudSMSProvider)


# ─── StubSMSProvider 行为 ────────────────────────────────────


def test_stub_logs_code_with_purpose(caplog: pytest.LogCaptureFixture) -> None:
    """Stub provider logs to_phone + code + purpose — dev 手拿 code 测试."""
    provider = StubSMSProvider()
    with caplog.at_level(logging.INFO, logger="sikao_api.modules.system.infrastructure.sms.stub_provider"):
        provider.send_verify_code(
            to_phone="13800138000", code="123456", purpose="register"
        )
    assert any(
        "sms.stub.verify_code" in record.message
        and "to=13800138000" in record.message
        and "purpose=register" in record.message
        and "code=123456" in record.message
        for record in caplog.records
    )


@pytest.mark.parametrize("purpose", ["register", "bind_phone", "login_otp"])
def test_stub_accepts_all_purposes(
    purpose: str, caplog: pytest.LogCaptureFixture
) -> None:
    """所有 SmsPurpose literal 都不 raise — Protocol 兼容性 smoke."""
    provider = StubSMSProvider()
    with caplog.at_level(logging.INFO, logger="sikao_api.modules.system.infrastructure.sms.stub_provider"):
        provider.send_verify_code(
            to_phone="13800138000",
            code="000000",
            purpose=purpose,  # type: ignore[arg-type]
        )
    # 只断言不挂; 内容覆盖在 test_stub_logs_code_with_purpose.


# ─── NoopSMSProvider 行为 ────────────────────────────────────


def test_noop_returns_none_silently(caplog: pytest.LogCaptureFixture) -> None:
    """Noop provider 不 log + 返 None — silent drop."""
    provider = NoopSMSProvider()
    with caplog.at_level(logging.INFO):
        result = provider.send_verify_code(
            to_phone="13800138000", code="123456", purpose="register"
        )
    assert result is None
    # noop 不应 log 任何东西.
    assert not any(
        "sms" in record.name and "noop" in record.message.lower()
        for record in caplog.records
    )
