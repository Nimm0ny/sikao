"""Resend SaaS email provider.

ARCH §7.3 P2 backlog 关闭. 切真邮件之前需要 ops 完成:
  1. https://resend.com 注册帐号 (免费 tier 100 邮件/天 + 3000/月).
  2. Verify domain (DNS DKIM/SPF/MX records). 单 domain 整链路认证.
  3. 生成 API key, 设到 prod / poc 环境的 `RESEND_API_KEY` env.
  4. 设 `EMAIL_PROVIDER=resend` + `RESEND_FROM_EMAIL=noreply@yourdomain.com`.
  5. (可选) 设 `RESEND_REPLY_TO=support@yourdomain.com` 给用户回邮箱.

API ref: https://resend.com/docs/api-reference/emails/send-email
"""

from __future__ import annotations

import html
import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"
DEFAULT_TIMEOUT_SECONDS = 10.0


@dataclass(frozen=True)
class ResendConfig:
    """Inject 到 ResendEmailProvider — 跟 settings 解耦, factory 端读 env."""

    api_key: str
    from_email: str
    reply_to: str | None = None
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS


def _password_reset_template(link: str) -> tuple[str, str]:
    """Returns (text_body, html_body). 调性按 §1.3 中性, 不打鸡血.

    B-review B-R6 修: link 在 HTML 内插必须 html.escape — 防 frontend_base_url
    含 `"` 等导致 attribute breakage. token 部分是 secrets.token_urlsafe (URL-
    safe charset 不需要 escape) 但整 URL 仍走 html.escape 以防未来 base_url
    源变化. quote=True 让 `"` 也 escape (默认只 escape <>&).
    """
    safe_link = html.escape(link, quote=True)
    text = (
        "你好,\n\n"
        "我们收到了重置思考账号密码的请求. 点击下方链接设置新密码:\n\n"
        f"{link}\n\n"
        "链接 1 小时内有效. 如果不是你本人操作, 忽略此邮件即可.\n\n"
        "—— 思考"
    )
    html_body = (
        '<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;'
        'padding:24px;color:#0b1120;line-height:1.6">'
        '<h2 style="font-size:20px;margin:0 0 16px;font-weight:600">重置密码</h2>'
        "<p>我们收到了重置思考账号密码的请求. 点击下方按钮设置新密码:</p>"
        f'<p style="margin:24px 0"><a href="{safe_link}" '
        'style="display:inline-block;padding:10px 20px;background:#0b1120;color:#fff;'
        'text-decoration:none;border-radius:6px;font-weight:600">设置新密码</a></p>'
        '<p style="font-size:14px;color:#64748b">'
        "或复制此链接到浏览器打开 (1 小时内有效):<br>"
        f'<code style="word-break:break-all;font-size:12px">{safe_link}</code></p>'
        '<p style="font-size:14px;color:#64748b;margin-top:24px">'
        "如果不是你本人操作, 忽略此邮件即可.</p>"
        '<hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0">'
        '<p style="font-size:12px;color:#94a3b8">—— 思考 (SIKAO)</p>'
        "</div>"
    )
    return text, html_body


def _email_verify_template(link: str) -> tuple[str, str]:
    safe_link = html.escape(link, quote=True)
    text = (
        "你好,\n\n"
        "请点击下方链接验证你的思考账号邮箱:\n\n"
        f"{link}\n\n"
        "链接 24 小时内有效.\n\n"
        "—— 思考"
    )
    html_body = (
        '<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;'
        'padding:24px;color:#0b1120;line-height:1.6">'
        '<h2 style="font-size:20px;margin:0 0 16px;font-weight:600">验证邮箱</h2>'
        "<p>请点击下方按钮验证你的思考账号邮箱:</p>"
        f'<p style="margin:24px 0"><a href="{safe_link}" '
        'style="display:inline-block;padding:10px 20px;background:#0b1120;color:#fff;'
        'text-decoration:none;border-radius:6px;font-weight:600">验证邮箱</a></p>'
        '<p style="font-size:14px;color:#64748b">'
        "或复制此链接到浏览器打开 (24 小时内有效):<br>"
        f'<code style="word-break:break-all;font-size:12px">{safe_link}</code></p>'
        '<hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0">'
        '<p style="font-size:12px;color:#94a3b8">—— 思考 (SIKAO)</p>'
        "</div>"
    )
    return text, html_body


class ResendEmailProvider:
    """Resend HTTP API client. Implements EmailProvider Protocol.

    Failure semantics: HTTP 非 2xx 立即 raise httpx.HTTPStatusError. 调用方
    (auth_recovery service) 不 swallow — 让 forgot-password endpoint 走
    D5 silent-200 还是上 500 看 service 层决策.
    """

    def __init__(self, config: ResendConfig, client: httpx.Client | None = None) -> None:
        self._config = config
        # client 注入让 test 用 MockTransport. 默认懒构造 short-lived client.
        self._client = client

    def _post_email(self, *, to: str, subject: str, text: str, html: str) -> None:
        payload: dict[str, object] = {
            "from": self._config.from_email,
            "to": [to],
            "subject": subject,
            "text": text,
            "html": html,
        }
        if self._config.reply_to is not None:
            payload["reply_to"] = self._config.reply_to
        headers = {
            "Authorization": f"Bearer {self._config.api_key}",
            "Content-Type": "application/json",
        }
        # short-lived client 默认; test 注 MockTransport 走 self._client.
        client = self._client or httpx.Client(timeout=self._config.timeout_seconds)
        try:
            resp = client.post(RESEND_API_URL, json=payload, headers=headers)
        finally:
            if self._client is None:
                client.close()
        # raise_for_status 立即抛 HTTPStatusError, 上层决定 swallow vs propagate.
        resp.raise_for_status()
        logger.info(
            "email.resend.sent to=%s subject=%s message_id=%s",
            to,
            subject,
            resp.json().get("id", "?"),
        )

    def send_password_reset(self, *, to: str, link: str) -> None:
        text, html = _password_reset_template(link)
        self._post_email(to=to, subject="重置思考账号密码", text=text, html=html)

    def send_email_verify(self, *, to: str, link: str) -> None:
        text, html = _email_verify_template(link)
        self._post_email(to=to, subject="验证思考账号邮箱", text=text, html=html)
