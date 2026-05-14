"""LLM factory + prompt SSOT unit tests — Slice 0a.

Cover:
- build_llm_provider 在 settings.llm_api_key 设时构造成功
- 缺 api_key → LLMConfigError
- prompts._shared.SYSTEM_TONE_PREFIX 含 banlist 关键词
- with_tone(...) 拼接前缀 + feature message
"""

from __future__ import annotations

import pytest

from sikao_api.core.config import Settings
from sikao_api.modules.llm.application.llm import (
    LLMConfigError,
    LLMProvider,
    build_llm_provider,
)
from sikao_api.modules.llm.application.llm.openai_compatible import OpenAICompatibleProvider
from sikao_api.modules.llm.application.llm.prompts import SYSTEM_TONE_PREFIX, with_tone


def _make_settings(**overrides: object) -> Settings:
    return Settings(_env_file=None, **overrides)  # type: ignore[call-arg]


def test_build_llm_provider_returns_openai_compatible(monkeypatch: pytest.MonkeyPatch) -> None:
    """settings 配齐 → 返 OpenAICompatibleProvider 实例."""
    monkeypatch.setattr("sikao_api.core.config._read_apikey_file_default", lambda: None)
    settings = _make_settings(llm_api_key="sk-test")
    provider, _label = build_llm_provider(settings)
    assert isinstance(provider, OpenAICompatibleProvider)
    # structural: 也满足 LLMProvider Protocol
    assert hasattr(provider, "chat_completion")
    assert hasattr(provider, "chat_completion_stream")


def test_build_llm_provider_passes_settings_to_config(monkeypatch: pytest.MonkeyPatch) -> None:
    """factory 把 settings 字段透传给 OpenAICompatibleConfig."""
    monkeypatch.setattr("sikao_api.core.config._read_apikey_file_default", lambda: None)
    settings = _make_settings(
        llm_api_key="sk-x",
        llm_base_url="https://custom.example/v1",
        llm_timeout_seconds=30,
    )
    provider, _label = build_llm_provider(settings)
    assert isinstance(provider, OpenAICompatibleProvider)
    # private 但测一下 wiring
    assert provider._config.base_url == "https://custom.example/v1"  # type: ignore[attr-defined]
    assert provider._config.api_key == "sk-x"  # type: ignore[attr-defined]
    assert provider._config.timeout_seconds == 30.0  # type: ignore[attr-defined]


def test_build_llm_provider_raises_when_api_key_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    """llm_api_key=None → LLMConfigError. Route 层 catch 转 503."""
    monkeypatch.setattr("sikao_api.core.config._read_apikey_file_default", lambda: None)
    settings = _make_settings(llm_api_key=None)
    with pytest.raises(LLMConfigError, match="LLM_API_KEY not configured"):
        build_llm_provider(settings)


def test_system_tone_prefix_bans_cheerleading() -> None:
    """SYSTEM_TONE_PREFIX 显式 ban 鸡血/网感卖萌/情绪安抚词汇."""
    assert "加油" in SYSTEM_TONE_PREFIX
    assert "棒棒哒" in SYSTEM_TONE_PREFIX
    assert "哎呀" in SYSTEM_TONE_PREFIX
    assert "不要灰心" in SYSTEM_TONE_PREFIX
    # 风格描述含产品调性
    assert "图书馆隔壁桌" in SYSTEM_TONE_PREFIX


def test_with_tone_prepends_prefix() -> None:
    """with_tone 把 SYSTEM_TONE_PREFIX 拼到 feature message 前."""
    feature = "你的任务是评估申论答案."
    combined = with_tone(feature)
    assert combined.startswith(SYSTEM_TONE_PREFIX)
    assert combined.endswith(feature)
    assert "\n\n" in combined  # 有分隔空行


def test_llm_provider_protocol_satisfied_structurally() -> None:
    """OpenAICompatibleProvider structurally satisfies LLMProvider Protocol."""
    from sikao_api.modules.llm.application.llm.openai_compatible import OpenAICompatibleConfig

    config = OpenAICompatibleConfig(base_url="x", api_key="y")
    provider: LLMProvider = OpenAICompatibleProvider(config)  # type: ignore[assignment]
    # 编译期 Protocol 检查 + runtime hasattr check
    assert callable(provider.chat_completion)
    assert callable(provider.chat_completion_stream)


def test_llm_config_error_extends_service_error() -> None:
    """LLMConfigError 走 ServiceError 协议: status_code=503 + code 字段."""
    from sikao_api.modules.system.application.errors import LLMServiceError, ServiceError

    err = LLMConfigError("test message")
    assert isinstance(err, LLMServiceError)
    assert isinstance(err, ServiceError)
    assert err.status_code == 503
    assert err.code == "llm_config_missing"
    assert err.message == "test message"


def test_build_llm_provider_rejects_non_https_external_base_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """factory 二次校验 base_url scheme: http://公网 → LLMConfigError.

    settings field_validator 已守一道, 但 BYOM 用户传值时也走这 factory
    (Slice 0c 才接 user config), 防御性多一层.
    """
    monkeypatch.setattr("sikao_api.core.config._read_apikey_file_default", lambda: None)
    # 跳过 settings field_validator 用 model_construct 直接构造 (绕开 validation)
    settings = Settings.model_construct(
        llm_api_key="sk-x",
        llm_base_url="http://api.example.com/v1",  # 非法 scheme
        llm_timeout_seconds=120,
    )
    with pytest.raises(LLMConfigError, match="LLM_BASE_URL must start with"):
        build_llm_provider(settings)


@pytest.mark.parametrize(
    "subdomain_url",
    [
        "http://localhost.evil.com/v1",
        "http://127.0.0.1.evil.com/v1",
        "http://localhostxyz/v1",
        "http://127.0.0.1xyz",
    ],
)
def test_build_llm_provider_rejects_subdomain_attack(
    monkeypatch: pytest.MonkeyPatch, subdomain_url: str
) -> None:
    """factory 端 _is_acceptable_base_url_scheme 跟 settings field_validator 行为
    一致, 子域钓鱼 URL 双层防御都拒.

    P1-#2-A: BYOM 用户提供 user_llm_configs.base_url='http://localhost.evil.com'
    时 settings 不参与 (绕过 settings validator), factory 端必须独立守门.
    """
    monkeypatch.setattr("sikao_api.core.config._read_apikey_file_default", lambda: None)
    settings = Settings.model_construct(
        llm_api_key="sk-x",
        llm_base_url=subdomain_url,
        llm_timeout_seconds=120,
    )
    with pytest.raises(LLMConfigError, match="LLM_BASE_URL must start with"):
        build_llm_provider(settings)
