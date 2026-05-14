"""No-op email provider — silent drop.

存在原因: poc 部署 (lhr 单机 VPS) 起步阶段不想 logger 噪声 + 也没真 SaaS,
干脆什么都不做. forgot-password / verify-email 的用户体验是"邮件没收到"
(等同 D5 silent-200), 单机 PoC 期接受.

切真 provider 时 settings.email_provider 改 "resend" / "ses" / etc,
factory 切类即可.
"""

from __future__ import annotations


class NoopEmailProvider:
    """Drops every email. Used when no real SaaS provider is wired."""

    def send_password_reset(self, *, to: str, link: str) -> None:  # noqa: ARG002
        return None

    def send_email_verify(self, *, to: str, link: str) -> None:  # noqa: ARG002
        return None
