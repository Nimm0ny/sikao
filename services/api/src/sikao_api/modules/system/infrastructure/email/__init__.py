"""Email provider factory — by settings.email_provider.

Phase B (auth recovery). 三种 provider:
- stub: dev (logger.info)
- noop: PoC 单机起步 (silent drop)
- resend: prod / poc 切真 SaaS (HTTP API)
"""

from __future__ import annotations

from sikao_api.core.config import Settings
from sikao_api.modules.system.infrastructure.email.noop_provider import NoopEmailProvider
from sikao_api.modules.system.infrastructure.email.provider import EmailProvider
from sikao_api.modules.system.infrastructure.email.resend_provider import ResendConfig, ResendEmailProvider
from sikao_api.modules.system.infrastructure.email.stub_provider import StubEmailProvider


def build_email_provider(settings: Settings) -> EmailProvider:
    """Factory: settings.email_provider literal → concrete provider."""
    if settings.email_provider == "stub":
        return StubEmailProvider()
    if settings.email_provider == "noop":
        return NoopEmailProvider()
    if settings.email_provider == "resend":
        # validate_runtime 已确保 resend_api_key + resend_from_email 都不为 None,
        # 这里 RuntimeError 而非 assert — assert 在 python -O 会被剥掉, factory
        # 调用路径如果绕过 validate_runtime (比如直接 Settings()) 会拿到 None
        # 凭据穿透到 ResendEmailProvider, 第一次发邮件才炸. fail-fast 当场.
        if settings.resend_api_key is None or settings.resend_from_email is None:
            raise RuntimeError(
                "email_provider=resend requires resend_api_key + resend_from_email"
            )
        return ResendEmailProvider(
            ResendConfig(
                api_key=settings.resend_api_key,
                from_email=settings.resend_from_email,
                reply_to=settings.resend_reply_to,
            )
        )
    # Literal 已限到上面三种, 这里到不了; raise 是 future-proof.
    raise RuntimeError(f"unknown email_provider: {settings.email_provider!r}")


__all__ = ["EmailProvider", "build_email_provider"]
