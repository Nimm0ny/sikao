"""Stub email provider — logs to stdout instead of actual SMTP / SaaS API.

Use cases:
- local dev: 看 link 走 logger.info (terminal 可见)
- pytest: 不发真邮件
- poc 部署 (lhr 单机): 起步用 stub, 后置 ticket 接 Resend / SES

Dev 模式下 route handler 会 把 link 也回写 response.body._devMagicLink
(P1-3 双 gate: app_env in {local, test} AND dev_expose_magic_link=True).
但**那是 route 层判断**, provider 自己不暴露 link, 始终只 logger.info.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


class StubEmailProvider:
    """Logs the magic link instead of sending email.

    Implements the EmailProvider Protocol structurally — no inheritance.
    """

    def send_password_reset(self, *, to: str, link: str) -> None:
        # to 字段写日志: 接到 forgot-password 请求确认 wiring 起作用.
        # link 写日志: dev 手拿 link 测 reset flow (无浏览器邮箱).
        logger.info("email.stub.password_reset to=%s link=%s", to, link)

    def send_email_verify(self, *, to: str, link: str) -> None:
        logger.info("email.stub.email_verify to=%s link=%s", to, link)
