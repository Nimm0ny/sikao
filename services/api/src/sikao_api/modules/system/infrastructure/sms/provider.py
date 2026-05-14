"""SMS provider Protocol — Identity v2 (D8).

Provider 只管 "send code", 不知道 dev_magic_code 这种 dev expose 概念 ——
那是 service / route handler 层根据 settings 决定的. provider 接 to_phone +
code 就发, 失败抛 (fail-fast 不 swallow).

跟 EmailProvider 同模式: stub / noop / tencent 都 implement 同一 Protocol,
切真 SaaS 时只换 factory 拼装, business code 0 改动.

Purpose 字段决定模板:
- 'register': 注册码 (anonymous-allowed)
- 'bind_phone': 绑定/换绑码 (logged-in only)
- 'login_otp': OTP 登录 (Phase 1 不做, 字段留扩展)
"""

from __future__ import annotations

from typing import Literal, Protocol

SmsPurpose = Literal["register", "bind_phone", "login_otp"]


class SMSProvider(Protocol):
    """Outbound SMS sender. Caller pre-generates the 6-digit code."""

    def send_verify_code(
        self,
        *,
        to_phone: str,
        code: str,
        purpose: SmsPurpose,
    ) -> None:
        """Send 6-digit verify code to phone.

        Args:
            to_phone: 11-digit normalized phone (normalize_phone 应用过).
            code: 6-digit numeric string.
            purpose: 决定使用哪个短信模板 (注册 / 绑定 / OTP 登录).

        Raises on transport failure — caller decides whether to surface or
        absorb (e.g. forgot-password 的 silent-200 swallow 模式).
        """
        ...
