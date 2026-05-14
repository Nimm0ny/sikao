"""Rate limiter infra tests — commit #6a.

Cover:
- init_limiter(None) skips silently (dev/test noop)
- close_limiter no-op when not init'd
- make_limiter returns dependency that no-ops when Redis not init'd
- Identifier helpers extract phone/email/IP correctly + fallback to IP

Note: 项目无 pytest-asyncio plugin, 用 asyncio.run() 包 async helpers.
"""

from __future__ import annotations

import asyncio
from typing import Any

from starlette.requests import Request

from sikao_api.core.limiter import (
    close_limiter,
    identifier_by_body_email,
    identifier_by_body_phone,
    identifier_by_ip,
    init_limiter,
    make_limiter,
)


def _make_request(
    *,
    body_bytes: bytes = b"",
    headers: dict[str, str] | None = None,
    client_host: str = "127.0.0.1",
) -> Request:
    """Build a minimal ASGI Request for unit tests (no FastAPI app needed)."""
    scope: dict[str, Any] = {
        "type": "http",
        "method": "POST",
        "path": "/test",
        "headers": [
            (k.lower().encode(), v.encode()) for k, v in (headers or {}).items()
        ],
        "client": (client_host, 12345),
    }
    body_consumed = False

    async def receive() -> dict[str, Any]:
        nonlocal body_consumed
        if body_consumed:
            return {"type": "http.disconnect"}
        body_consumed = True
        return {"type": "http.request", "body": body_bytes, "more_body": False}

    return Request(scope, receive=receive)


# ─── init / close lifecycle ────────────────────────────────


def test_init_limiter_with_none_redis_url_skips_silently() -> None:
    """dev/test redis_url=None → init no-op, no exception."""
    asyncio.run(init_limiter(None))


def test_close_limiter_when_not_init_is_noop() -> None:
    """close_limiter on uninit'd FastAPILimiter is safe (no AttributeError)."""
    asyncio.run(close_limiter())


# ─── make_limiter shim ─────────────────────────────────────


def test_make_limiter_noop_when_redis_not_initialized() -> None:
    """When FastAPILimiter.redis is None, dependency should pass without
    raising — this is the dev/test noop path."""
    try:
        from fastapi_limiter import FastAPILimiter
    except ImportError:
        FastAPILimiter = None

    # Force redis to None (simulating dev mode where init wasn't called).
    if FastAPILimiter is not None:
        FastAPILimiter.redis = None

    limiter_dep = make_limiter(times=1, seconds=60)
    request = _make_request(body_bytes=b'{"phone": "13800138000"}')
    # Should not raise.
    asyncio.run(limiter_dep(request, response=None))


# ─── identifier helpers ────────────────────────────────────


def test_identifier_by_ip_uses_x_forwarded_for_first() -> None:
    request = _make_request(headers={"X-Forwarded-For": "203.0.113.5, 10.0.0.1"})
    key = asyncio.run(identifier_by_ip(request))
    assert key == "ip:203.0.113.5"


def test_identifier_by_ip_falls_back_to_client_host() -> None:
    request = _make_request(client_host="198.51.100.7")
    key = asyncio.run(identifier_by_ip(request))
    assert key == "ip:198.51.100.7"


def test_identifier_by_body_phone_normalizes() -> None:
    """+86 / spaces 输入 normalize 后跨格式同 key (防绕过限流)."""
    r1 = _make_request(body_bytes=b'{"phone": "13800138000"}')
    r2 = _make_request(body_bytes=b'{"phone": "+86 138-0013-8000"}')
    k1 = asyncio.run(identifier_by_body_phone(r1))
    k2 = asyncio.run(identifier_by_body_phone(r2))
    assert k1 == "phone:13800138000"
    assert k2 == "phone:13800138000"


def test_identifier_by_body_phone_invalid_format_falls_back_to_ip() -> None:
    """非法 phone (e.g. 1 后第二位 0) → fallback IP key (粒度变粗, 不挂)."""
    request = _make_request(
        body_bytes=b'{"phone": "12800138000"}',
        client_host="203.0.113.5",
    )
    key = asyncio.run(identifier_by_body_phone(request))
    assert key == "ip:203.0.113.5"


def test_identifier_by_body_phone_missing_falls_back_to_ip() -> None:
    """body 没 phone 字段 → fallback IP."""
    request = _make_request(
        body_bytes=b'{"foo": "bar"}', client_host="198.51.100.42"
    )
    key = asyncio.run(identifier_by_body_phone(request))
    assert key == "ip:198.51.100.42"


def test_identifier_by_body_phone_invalid_json_falls_back_to_ip() -> None:
    """body 非 JSON → 不能 raise, fallback IP."""
    request = _make_request(
        body_bytes=b"not json{", client_host="192.0.2.1"
    )
    key = asyncio.run(identifier_by_body_phone(request))
    assert key == "ip:192.0.2.1"


def test_identifier_by_body_email_normalizes_lowercase() -> None:
    """大小写敏感 email 输入 → lowercased key (跟 normalize_email 同模式)."""
    request = _make_request(body_bytes=b'{"email": "ALICE@Example.COM"}')
    key = asyncio.run(identifier_by_body_email(request))
    assert key == "email:alice@example.com"


def test_identifier_by_body_email_invalid_falls_back_to_ip() -> None:
    """email 没 @ → fallback IP."""
    request = _make_request(
        body_bytes=b'{"email": "notanemail"}', client_host="10.0.0.1"
    )
    key = asyncio.run(identifier_by_body_email(request))
    assert key == "ip:10.0.0.1"
