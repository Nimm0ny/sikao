"""Stub SMS provider — logs to stdout instead of actual SMS gateway.

Use cases:
- local dev: 看 code 走 logger.info (terminal 可见)
- pytest: 不发真短信
- poc 部署起步: 起步用 stub, 后置 ticket 接腾讯云 SMS

Dev 模式下 route handler 会把 code 也回写 response.body._devMagicCode
(双 gate: app_env in {local, test} AND dev_expose_magic_code=True).
**那是 route 层判断**, provider 自己只 logger.info, 不暴露 code.
"""

from __future__ import annotations

import logging

from sikao_api.modules.system.infrastructure.sms.provider import SmsPurpose

logger = logging.getLogger(__name__)


class StubSMSProvider:
    """Logs the verify code instead of sending SMS.

    Implements the SMSProvider Protocol structurally — no inheritance.
    """

    def send_verify_code(
        self,
        *,
        to_phone: str,
        code: str,
        purpose: SmsPurpose,
    ) -> None:
        # to_phone + code + purpose 全打 — dev 手拿 code 测注册 / 绑定 flow
        # (无真手机收码). 11 位 phone 不脱敏 (dev 环境无 PII 风险).
        logger.info(
            "sms.stub.verify_code to=%s purpose=%s code=%s",
            to_phone,
            purpose,
            code,
        )
