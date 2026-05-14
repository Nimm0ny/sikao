"""No-op SMS provider — silent drop.

存在原因: poc 部署 (单机 VPS) 起步阶段不想 logger 噪声 + 也没真 SMS gateway,
干脆什么都不做. 用户体验是"短信没收到", 单机 PoC 期接受.

切真 provider 时 settings.sms_provider 改 "tencent", factory 切类即可.

跟 NoopEmailProvider 同模式 (app/services/email/noop_provider.py).
"""

from __future__ import annotations

from sikao_api.modules.system.infrastructure.sms.provider import SmsPurpose


class NoopSMSProvider:
    """Drops every SMS. Used when no real SMS provider is wired."""

    def send_verify_code(
        self,
        *,
        to_phone: str,  # noqa: ARG002
        code: str,  # noqa: ARG002
        purpose: SmsPurpose,  # noqa: ARG002
    ) -> None:
        return None
