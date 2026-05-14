"""Email provider Protocol — Phase B (auth recovery).

Provider 只管 "send", 不知道 dev_magic_link 这种 dev expose 概念 ——
那是 service / route handler 层根据 settings 决定的. provider 接 to + link
就发, 失败抛 (fail-fast 不 swallow).

Stub / noop / 真 SaaS 都 implement 同一 Protocol, 切 SaaS 时只换 factory
拼装, business code 0 改动.
"""

from __future__ import annotations

from typing import Protocol


class EmailProvider(Protocol):
    """Outbound email sender. Caller pre-builds the magic link."""

    def send_password_reset(self, *, to: str, link: str) -> None:
        """Send password-reset magic link.

        Raises on transport failure — caller decides whether to surface or
        absorb (e.g. forgot-password D5 silent-200 swallow).
        """
        ...

    def send_email_verify(self, *, to: str, link: str) -> None:
        """Send email-verify magic link. Same failure semantics."""
        ...
