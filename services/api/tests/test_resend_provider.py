"""Resend provider tests — closed §7.3 P2 SaaS provider 接入.

httpx MockTransport 拦 HTTP 调用, 验:
- 正确 endpoint + Bearer auth + JSON shape
- text + html body 两段都填
- reply_to 可选
- 4xx/5xx 抛 HTTPStatusError (不 swallow)
"""

from __future__ import annotations

import json

import httpx
import pytest

from sikao_api.core.config import Settings
from sikao_api.modules.system.infrastructure.email import build_email_provider
from sikao_api.modules.system.infrastructure.email.resend_provider import (
    RESEND_API_URL,
    ResendConfig,
    ResendEmailProvider,
)


def _make_client(handler):
    """Helper: httpx.Client with MockTransport for unit testing."""
    transport = httpx.MockTransport(handler)
    return httpx.Client(transport=transport)


def test_password_reset_posts_correct_payload() -> None:
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json={"id": "msg_abc123"})

    provider = ResendEmailProvider(
        ResendConfig(api_key="re_test_key", from_email="noreply@example.com"),
        client=_make_client(handler),
    )
    provider.send_password_reset(to="alice@example.com", link="http://x/r/abc")

    assert len(captured) == 1
    req = captured[0]
    assert str(req.url) == RESEND_API_URL
    assert req.method == "POST"
    assert req.headers["Authorization"] == "Bearer re_test_key"
    assert req.headers["Content-Type"] == "application/json"
    body = json.loads(req.content)
    assert body["from"] == "noreply@example.com"
    assert body["to"] == ["alice@example.com"]
    assert "重置" in body["subject"]
    assert "http://x/r/abc" in body["text"]
    assert "http://x/r/abc" in body["html"]
    # html 应该包含 button + 完整 styling
    assert "设置新密码" in body["html"]


def test_email_verify_posts_with_verify_subject() -> None:
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json={"id": "msg_xyz"})

    provider = ResendEmailProvider(
        ResendConfig(api_key="re_x", from_email="noreply@example.com"),
        client=_make_client(handler),
    )
    provider.send_email_verify(to="bob@example.com", link="http://x/v/xyz")

    body = json.loads(captured[0].content)
    assert body["to"] == ["bob@example.com"]
    assert "验证" in body["subject"]
    assert "http://x/v/xyz" in body["text"]


def test_reply_to_included_when_set() -> None:
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json={"id": "msg_1"})

    provider = ResendEmailProvider(
        ResendConfig(
            api_key="re_x",
            from_email="noreply@example.com",
            reply_to="support@example.com",
        ),
        client=_make_client(handler),
    )
    provider.send_password_reset(to="x@x.com", link="http://x/r/1")

    body = json.loads(captured[0].content)
    assert body["reply_to"] == "support@example.com"


def test_reply_to_omitted_when_none() -> None:
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json={"id": "msg_1"})

    provider = ResendEmailProvider(
        ResendConfig(api_key="re_x", from_email="noreply@example.com"),
        client=_make_client(handler),
    )
    provider.send_password_reset(to="x@x.com", link="http://x/r/1")

    body = json.loads(captured[0].content)
    assert "reply_to" not in body


def test_4xx_raises_http_error() -> None:
    """API 错配 / 限流 等 4xx — fail-fast 抛, 不 swallow."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"name": "validation_error", "message": "bad api key"})

    provider = ResendEmailProvider(
        ResendConfig(api_key="re_bad", from_email="noreply@example.com"),
        client=_make_client(handler),
    )
    with pytest.raises(httpx.HTTPStatusError) as exc:
        provider.send_password_reset(to="x@x", link="http://x/r/1")
    assert exc.value.response.status_code == 401


def test_5xx_raises_http_error() -> None:
    """Resend down — 也抛, 不 swallow."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503)

    provider = ResendEmailProvider(
        ResendConfig(api_key="re_x", from_email="noreply@example.com"),
        client=_make_client(handler),
    )
    with pytest.raises(httpx.HTTPStatusError):
        provider.send_email_verify(to="x@x", link="http://x/v/1")


# ─── factory + settings validation ────────────────────────────────────────


def _make_settings(**overrides: object) -> Settings:
    return Settings(_env_file=None, **overrides)  # type: ignore[call-arg]


def test_factory_returns_resend_when_configured() -> None:
    settings = _make_settings(
        email_provider="resend",
        resend_api_key="re_test",
        resend_from_email="noreply@example.com",
    )
    provider = build_email_provider(settings)
    assert isinstance(provider, ResendEmailProvider)


def test_validate_runtime_blocks_resend_without_api_key() -> None:
    settings = _make_settings(
        email_provider="resend",
        resend_api_key=None,
        resend_from_email="noreply@example.com",
    )
    with pytest.raises(RuntimeError, match="RESEND_API_KEY"):
        settings.validate_runtime()


def test_validate_runtime_blocks_resend_without_from_email() -> None:
    settings = _make_settings(
        email_provider="resend",
        resend_api_key="re_x",
        resend_from_email=None,
    )
    with pytest.raises(RuntimeError, match="RESEND_FROM_EMAIL"):
        settings.validate_runtime()


def test_validate_runtime_passes_with_full_resend_config() -> None:
    settings = _make_settings(
        email_provider="resend",
        resend_api_key="re_x",
        resend_from_email="noreply@example.com",
    )
    settings.validate_runtime()  # 不抛即 OK
