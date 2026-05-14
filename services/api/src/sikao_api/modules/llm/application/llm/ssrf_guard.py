"""BYOM URL SSRF 防护 — Slice 0c (plan §3.2.2).

用户在 user_llm_configs.base_url 输入 URL 时, 防御:
1. 协议白名单: 必须 https:// (生产) 或 http://localhost / 127.0.0.1 (dev vLLM).
2. Hostname 黑名单: cloud metadata endpoint (AWS / GCP / Azure / 阿里云 / 腾讯).
3. IP 黑名单: 解析 host → IP 后 deny RFC1918 / loopback / link-local /
   reserved / multicast / unspecified. cloud metadata IP 也直接 deny (用户
   绕 DNS 直传 IP).
4. DNS rebinding 防护: 创建 BYOM 时 resolve once, **调用 LLM 时再次 resolve**
   (hostname 可能被 attacker 改 DNS 让第一次解析公网 IP, 第二次解析 127.0.0.1).
   PoC 阶段用 "double-check" 模式 (create + call 各一次), 完整 connect-time
   pinning 留 v0.4.

ValidationError 子类 (status_code=422): 用户输入问题, 不是 service 问题 (LLM
不可用走 LLMServiceError 503).
"""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

from sikao_api.modules.system.application.errors import ValidationError


class SsrfBlockedError(ValidationError):
    """SSRF 拦截: URL 试图打内网 / cloud metadata / 非法协议."""

    def __init__(self, message: str) -> None:
        super().__init__(message, code="ssrf_blocked")


# Cloud metadata hostnames (case insensitive). 用户输入 'http://metadata.google.internal'
# 不会被 IP 黑名单拦 (因为不解析它), 必须显式 hostname blacklist.
# Note: Azure IMDS 是 169.254.169.254 直接 IP, 没 DNS 名 (4th-review P2 #2 验证),
# 所以不需要列 'metadata.azure.com' (实际不存在的 placeholder).
_BLOCKED_HOSTNAMES = frozenset({
    "metadata",
    "metadata.google.internal",
    "metadata.tencentyun.com",
    "metadata.aliyun.com",
})

# Cloud metadata IPs (用户绕 DNS 直传 IP 时拦下).
_BLOCKED_IPS = frozenset({
    "169.254.169.254",  # AWS / GCP / Azure (link-local 也覆盖 169.254/16, 但显式列防遗漏)
    "100.100.100.200",  # 阿里云
    "fd00:ec2::254",    # AWS IPv6
})


def parse_url_host(url: str) -> str:
    """Extract hostname from URL, validate scheme. Raise SsrfBlockedError on
    illegal scheme / no hostname.

    https:// 全部允许; http:// 仅 localhost / 127.0.0.1 (dev vLLM).
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("https", "http"):
        raise SsrfBlockedError(
            f"URL must use https:// (or http://localhost for dev), got scheme={parsed.scheme!r}"
        )
    if parsed.hostname is None:
        raise SsrfBlockedError(f"URL has no hostname: {url!r}")
    if parsed.scheme == "http":
        host_lower = parsed.hostname.lower()
        if host_lower != "localhost" and host_lower != "127.0.0.1":
            raise SsrfBlockedError(
                f"http:// only allowed for localhost/127.0.0.1, got {parsed.hostname!r}"
            )
    return parsed.hostname


def resolve_and_check(host: str) -> str:
    """Resolve host → IP, deny if internal / cloud metadata.

    Returns: 解析的第一个 IP (caller 可用作 connect-time pinning).
    Raises: SsrfBlockedError 当 host 是 metadata hostname / 解析 IP 私网.
    """
    # Hostname 显式黑名单 (case insensitive). 必须先于 IP check, 因为
    # metadata.google.internal 解析出来的 IP 是 169.254.169.254 — IP 黑名单
    # 也会拦, 但 hostname check 让错误信息更清晰 (告诉用户具体 hostname 错).
    host_lower = host.lower()
    if host_lower in _BLOCKED_HOSTNAMES:
        raise SsrfBlockedError(f"cloud metadata hostname blocked: {host!r}")

    # 解析所有 IP (可能多 A/AAAA records). 任一私网 / metadata IP → reject.
    try:
        addrinfo = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:
        raise SsrfBlockedError(f"DNS lookup failed for {host!r}") from exc

    if not addrinfo:
        raise SsrfBlockedError(f"DNS lookup empty for {host!r}")

    for _family, _socktype, _proto, _canon, sockaddr in addrinfo:
        ip_str = sockaddr[0]
        # cloud metadata IP 显式黑名单
        if ip_str in _BLOCKED_IPS:
            raise SsrfBlockedError(f"cloud metadata IP blocked: {ip_str}")
        # 私网 / 保留 IP
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError as exc:
            raise SsrfBlockedError(f"invalid IP in DNS response: {ip_str}") from exc
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            raise SsrfBlockedError(
                f"internal/reserved IP rejected: {ip_str} (host={host!r})"
            )
    # 所有 IP 都通过. 返第一个给 caller (DNS rebinding pin 用).
    first_ip = addrinfo[0][4][0]
    if not isinstance(first_ip, str):
        raise SsrfBlockedError(f"invalid DNS response IP type: {type(first_ip).__name__}")
    return first_ip


def validate_base_url(base_url: str, *, allow_dev_localhost: bool = True) -> None:
    """完整校验流: parse scheme + hostname → resolve → check IP/metadata.

    Raises SsrfBlockedError 任何 step failure. 调用方 (BYOM create / call) 在
    create 时 + 每次 call 时各调一次 (DNS rebinding double-check).

    allow_dev_localhost=False 时 http://localhost 也拒 (生产环境锁死).
    """
    host = parse_url_host(base_url)
    # localhost / 127.0.0.1 短路 (loopback IP 会被 is_loopback 拦, 但 dev 想
    # 接 vLLM @ http://localhost:8000 是合法用例, 跳 IP check).
    host_lower = host.lower()
    if host_lower in {"localhost", "127.0.0.1"}:
        if not allow_dev_localhost:
            raise SsrfBlockedError(
                f"localhost not allowed in this context (production), got {host!r}"
            )
        return
    resolve_and_check(host)
