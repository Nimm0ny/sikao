"""TencentCloudSMSProvider tests — Identity v2 (D8) commit #2b.

不真装 tencentcloud-sdk-python (dev / test 不需要 [sms] extra). 通过 ctor
注入 mock client + models_module 跳过 SDK lazy import.

覆盖:
- send_verify_code success path (Code="Ok")
- 业务失败 raise SmsSendError 带 vendor code (PhoneNumberInvalid 等)
- 空 SendStatusSet raise SmsSendError
- phone 自动加 +86 前缀传给 SDK
- TemplateParamSet 是 [code] (单参数模板)
- _resolve_template_id 三种 purpose 路由对; login_otp 没配置 raise
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from sikao_api.modules.system.infrastructure.sms.tencent_provider import (
    SmsSendError,
    TencentCloudSMSProvider,
    TencentSMSConfig,
)


def _config(**overrides: object) -> TencentSMSConfig:
    """Build a TencentSMSConfig with sane test defaults."""
    defaults: dict[str, object] = {
        "secret_id": "sid",
        "secret_key": "skey",
        "app_id": "1400000000",
        "sign_name": "思考",
        "template_register": "100001",
        "template_bind": "100002",
        "template_login_otp": None,
    }
    defaults.update(overrides)
    return TencentSMSConfig(**defaults)  # type: ignore[arg-type]


_OK_STATUS = SimpleNamespace(Code="Ok", Message="ok")


def _make_provider(
    *,
    send_status: SimpleNamespace | None = _OK_STATUS,
    return_set: list[SimpleNamespace] | None = None,
    config: TencentSMSConfig | None = None,
) -> tuple[TencentCloudSMSProvider, MagicMock]:
    """Build provider with mock client + models. Return (provider, mock_client).

    Mocking strategy:
      - return_set 显式传 → 用它 (e.g. [] for empty SendStatusSet test)
      - 否则用 send_status 包成 [send_status] (default _OK_STATUS)
      - send_status 显式 None → [None]; 但**不要这样用**, 用 return_set=[] 更明确
    """
    if return_set is None:
        return_set = [send_status] if send_status is not None else []
    mock_models = SimpleNamespace(SendSmsRequest=SimpleNamespace)
    mock_client = MagicMock()
    mock_client.SendSms.return_value = SimpleNamespace(SendStatusSet=return_set)
    provider = TencentCloudSMSProvider(
        config or _config(),
        client=mock_client,
        models_module=mock_models,
    )
    return provider, mock_client


# ─── send_verify_code happy path ────────────────────────────


def test_send_verify_code_success() -> None:
    provider, mock_client = _make_provider()
    # 不 raise = 成功.
    provider.send_verify_code(
        to_phone="13800138000", code="123456", purpose="register"
    )
    mock_client.SendSms.assert_called_once()


def test_send_verify_code_passes_phone_with_plus86_prefix() -> None:
    provider, mock_client = _make_provider()
    provider.send_verify_code(
        to_phone="13800138000", code="123456", purpose="register"
    )
    req = mock_client.SendSms.call_args[0][0]
    assert req.PhoneNumberSet == ["+8613800138000"]


def test_send_verify_code_template_param_set_is_code_only() -> None:
    """模板报备约定: 单参数 {1} = 6-digit code. TemplateParamSet 必须 [code]."""
    provider, mock_client = _make_provider()
    provider.send_verify_code(
        to_phone="13800138000", code="654321", purpose="register"
    )
    req = mock_client.SendSms.call_args[0][0]
    assert req.TemplateParamSet == ["654321"]


def test_send_verify_code_uses_register_template_for_register() -> None:
    provider, mock_client = _make_provider()
    provider.send_verify_code(
        to_phone="13800138000", code="123456", purpose="register"
    )
    req = mock_client.SendSms.call_args[0][0]
    assert req.TemplateId == "100001"  # template_register


def test_send_verify_code_uses_bind_template_for_bind_phone() -> None:
    provider, mock_client = _make_provider()
    provider.send_verify_code(
        to_phone="13800138000", code="123456", purpose="bind_phone"
    )
    req = mock_client.SendSms.call_args[0][0]
    assert req.TemplateId == "100002"  # template_bind


def test_send_verify_code_passes_app_id_and_sign_name() -> None:
    provider, mock_client = _make_provider()
    provider.send_verify_code(
        to_phone="13800138000", code="123456", purpose="register"
    )
    req = mock_client.SendSms.call_args[0][0]
    assert req.SmsSdkAppId == "1400000000"
    assert req.SignName == "思考"


# ─── 业务失败路径 ───────────────────────────────────────────


def test_send_verify_code_raises_on_vendor_failure() -> None:
    """Vendor 返非 Ok code → raise SmsSendError 带 vendor code+message."""
    bad_status = SimpleNamespace(
        Code="PhoneNumberInvalid", Message="invalid phone format"
    )
    provider, _ = _make_provider(send_status=bad_status)
    with pytest.raises(SmsSendError) as exc_info:
        provider.send_verify_code(
            to_phone="13800138000", code="123456", purpose="register"
        )
    assert exc_info.value.vendor_code == "PhoneNumberInvalid"
    assert "invalid phone format" in exc_info.value.vendor_message


def test_send_verify_code_raises_on_empty_status_set() -> None:
    """SendStatusSet 空 (罕见) → raise SmsSendError("EmptyStatusSet")."""
    provider, _ = _make_provider(return_set=[])
    with pytest.raises(SmsSendError) as exc_info:
        provider.send_verify_code(
            to_phone="13800138000", code="123456", purpose="register"
        )
    assert exc_info.value.vendor_code == "EmptyStatusSet"


# ─── _resolve_template_id ────────────────────────────────────


def test_resolve_template_id_login_otp_when_configured() -> None:
    config = _config(template_login_otp="100099")
    provider, mock_client = _make_provider(config=config)
    provider.send_verify_code(
        to_phone="13800138000", code="123456", purpose="login_otp"
    )
    req = mock_client.SendSms.call_args[0][0]
    assert req.TemplateId == "100099"


def test_resolve_template_id_login_otp_raises_when_unconfigured() -> None:
    """login_otp 模板未配置时, 调 purpose=login_otp 必须 raise (Phase 1 不强制
    配 login_otp 模板, 但用户调时必须能 fail-fast 知道为啥发不出)."""
    provider, _ = _make_provider()  # template_login_otp=None by default
    with pytest.raises(RuntimeError, match="template_login_otp"):
        provider.send_verify_code(
            to_phone="13800138000", code="123456", purpose="login_otp"
        )
