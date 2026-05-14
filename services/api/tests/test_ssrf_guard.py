"""BYOM URL SSRF guard unit tests — Slice 0c (plan §3.2.2).

Cover:
- parse_url_host: scheme 白名单 (https / http localhost) + 拒 file/ftp/etc
- resolve_and_check: cloud metadata hostname / IP / RFC1918 / link-local 全 deny
- validate_base_url: 整合 check, localhost 短路 (绕 IP loopback 拦截)
- DNS rebinding 模拟 (mock socket.getaddrinfo 返不同 IP 模拟 rebind)
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from sikao_api.modules.llm.application.llm.ssrf_guard import (
    SsrfBlockedError,
    parse_url_host,
    resolve_and_check,
    validate_base_url,
)


def _mock_addrinfo(ip: str) -> list:  # type: ignore[type-arg]
    """Build socket.getaddrinfo return value with given IP."""
    return [(2, 1, 6, "", (ip, 0))]


# ─── parse_url_host ───────────────────────────────────────────────────────


def test_parse_url_host_https_passes() -> None:
    assert parse_url_host("https://api.openai.com/v1") == "api.openai.com"


def test_parse_url_host_http_localhost_passes() -> None:
    assert parse_url_host("http://localhost:8000/v1") == "localhost"


def test_parse_url_host_http_127_0_0_1_passes() -> None:
    assert parse_url_host("http://127.0.0.1:8000/v1") == "127.0.0.1"


def test_parse_url_host_http_external_rejected() -> None:
    """http://api.public.com 拒 (明文 key 泄露)."""
    with pytest.raises(SsrfBlockedError, match="http:// only allowed"):
        parse_url_host("http://api.public.com/v1")


def test_parse_url_host_file_scheme_rejected() -> None:
    with pytest.raises(SsrfBlockedError, match="https://"):
        parse_url_host("file:///etc/passwd")


def test_parse_url_host_ftp_scheme_rejected() -> None:
    with pytest.raises(SsrfBlockedError, match="https://"):
        parse_url_host("ftp://files.example.com")


# ─── resolve_and_check ────────────────────────────────────────────────────


def test_resolve_and_check_metadata_google_internal_rejected() -> None:
    with pytest.raises(SsrfBlockedError, match="cloud metadata hostname"):
        resolve_and_check("metadata.google.internal")


def test_resolve_and_check_metadata_aliyun_rejected() -> None:
    with pytest.raises(SsrfBlockedError, match="cloud metadata hostname"):
        resolve_and_check("metadata.aliyun.com")


def test_resolve_and_check_bare_metadata_rejected() -> None:
    with pytest.raises(SsrfBlockedError, match="cloud metadata hostname"):
        resolve_and_check("metadata")


def test_resolve_and_check_metadata_ip_rejected_via_dns() -> None:
    """用户绕 DNS 注个看似公网的 hostname 但解析到 metadata IP → 拒."""
    with patch("socket.getaddrinfo", return_value=_mock_addrinfo("169.254.169.254")):
        with pytest.raises(SsrfBlockedError, match="cloud metadata IP"):
            resolve_and_check("attacker-controlled.example")


def test_resolve_and_check_aliyun_metadata_ip_rejected() -> None:
    with patch("socket.getaddrinfo", return_value=_mock_addrinfo("100.100.100.200")):
        with pytest.raises(SsrfBlockedError, match="cloud metadata IP"):
            resolve_and_check("attacker.example")


def test_resolve_and_check_rfc1918_10_rejected() -> None:
    """10.0.0.0/8 私网 IP 拒."""
    with patch("socket.getaddrinfo", return_value=_mock_addrinfo("10.0.0.1")):
        with pytest.raises(SsrfBlockedError, match="internal/reserved"):
            resolve_and_check("internal.corp")


def test_resolve_and_check_rfc1918_192_rejected() -> None:
    """192.168.0.0/16 私网 IP 拒."""
    with patch("socket.getaddrinfo", return_value=_mock_addrinfo("192.168.1.1")):
        with pytest.raises(SsrfBlockedError, match="internal/reserved"):
            resolve_and_check("router.local")


def test_resolve_and_check_rfc1918_172_rejected() -> None:
    """172.16.0.0/12 私网 IP 拒."""
    with patch("socket.getaddrinfo", return_value=_mock_addrinfo("172.16.0.1")):
        with pytest.raises(SsrfBlockedError, match="internal/reserved"):
            resolve_and_check("vpn.internal")


def test_resolve_and_check_link_local_rejected() -> None:
    """169.254/16 link-local 拒 (覆盖 cloud metadata 的 IP range)."""
    with patch("socket.getaddrinfo", return_value=_mock_addrinfo("169.254.1.1")):
        with pytest.raises(SsrfBlockedError, match="internal/reserved"):
            resolve_and_check("link.local.example")


def test_resolve_and_check_loopback_rejected() -> None:
    """127.0.0.0/8 loopback 拒 (callers 显式想 localhost 走 validate_base_url 短路)."""
    with patch("socket.getaddrinfo", return_value=_mock_addrinfo("127.0.0.1")):
        with pytest.raises(SsrfBlockedError, match="internal/reserved"):
            resolve_and_check("localhost.tricky.example")


def test_resolve_and_check_public_ip_passes() -> None:
    """8.8.8.8 (Google DNS) 公网 IP 通过."""
    with patch("socket.getaddrinfo", return_value=_mock_addrinfo("8.8.8.8")):
        ip = resolve_and_check("dns.google")
        assert ip == "8.8.8.8"


def test_resolve_and_check_dns_failure_raises() -> None:
    """DNS lookup 失败 → SsrfBlockedError (而非穿透 socket.gaierror)."""
    import socket
    with patch("socket.getaddrinfo", side_effect=socket.gaierror("nodename nor servname provided")):
        with pytest.raises(SsrfBlockedError, match="DNS lookup failed"):
            resolve_and_check("nonexistent.example.invalid")


# ─── validate_base_url integration ────────────────────────────────────────


def test_validate_base_url_localhost_short_circuits() -> None:
    """localhost 跳 IP check (loopback 会被拦), 但 dev vLLM 是合法用例."""
    validate_base_url("http://localhost:8000/v1")  # 不抛
    validate_base_url("http://127.0.0.1:8000/v1")  # 不抛


def test_validate_base_url_localhost_disallowed_in_prod() -> None:
    """allow_dev_localhost=False 时 localhost 也拒 (生产环境)."""
    with pytest.raises(SsrfBlockedError, match="localhost not allowed"):
        validate_base_url("http://localhost:8000", allow_dev_localhost=False)


def test_validate_base_url_https_public_passes() -> None:
    """https://api.deepseek.com/v1 是合法 production endpoint."""
    with patch("socket.getaddrinfo", return_value=_mock_addrinfo("47.92.13.45")):
        validate_base_url("https://api.deepseek.com/v1")


def test_validate_base_url_dns_rebind_simulation() -> None:
    """模拟 DNS rebinding: hostname 第一次解析公网 IP 通过, 第二次解析 127.0.0.1.

    PoC double-check 模式让两次 resolve 都跑, 第二次会拦 (mock 返不同 IP).
    """
    public_ip = _mock_addrinfo("8.8.8.8")
    private_ip = _mock_addrinfo("127.0.0.1")

    # 第一次 (create) — public IP 通过
    with patch("socket.getaddrinfo", return_value=public_ip):
        validate_base_url("https://attacker-rebind.example/v1")

    # 第二次 (call) — rebind 到 loopback, 拒
    with patch("socket.getaddrinfo", return_value=private_ip):
        with pytest.raises(SsrfBlockedError, match="internal/reserved"):
            validate_base_url("https://attacker-rebind.example/v1")
