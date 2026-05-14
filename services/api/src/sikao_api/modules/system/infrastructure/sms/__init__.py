"""SMS provider factory — by settings.sms_provider.

Identity v2 (D8). 三种 provider:
- stub: dev (logger.info + raw code 给 route 层 dev gate 暴露 _devMagicCode)
- noop: PoC 单机起步 (silent drop)
- tencent: prod / poc 切真 SaaS (腾讯云 SMS, 走 [sms] optional SDK)

跟 email provider 同模式 (app/services/email). business code 通过
Protocol 解耦, 切 provider 时只换 factory 拼装.
"""

from __future__ import annotations

from sikao_api.core.config import Settings
from sikao_api.modules.system.infrastructure.sms.noop_provider import NoopSMSProvider
from sikao_api.modules.system.infrastructure.sms.provider import SMSProvider
from sikao_api.modules.system.infrastructure.sms.stub_provider import StubSMSProvider
from sikao_api.modules.system.infrastructure.sms.tencent_provider import (
    SmsSendError,
    TencentCloudSMSProvider,
    TencentSMSConfig,
)


def build_sms_provider(settings: Settings) -> SMSProvider:
    """Factory: settings.sms_provider literal → concrete provider.

    tencent 走 lazy SDK import: dev (.[dev]) 不装 SDK 但只要不切 tencent
    就不触发 import. validate_runtime 已确保 6 个必填字段都不为 None,
    这里 RuntimeError 是兜底 (assert 在 -O 会被剥; factory 调用绕过
    validate_runtime 时 fail-fast 当场).
    """
    if settings.sms_provider == "stub":
        return StubSMSProvider()
    if settings.sms_provider == "noop":
        return NoopSMSProvider()
    if settings.sms_provider == "tencent":
        if (
            settings.tencent_sms_secret_id is None
            or settings.tencent_sms_secret_key is None
            or settings.tencent_sms_app_id is None
            or settings.tencent_sms_sign_name is None
            or settings.tencent_sms_template_register is None
            or settings.tencent_sms_template_bind is None
        ):
            raise RuntimeError(
                "sms_provider=tencent requires all 6 required fields: "
                "tencent_sms_secret_id / secret_key / app_id / sign_name / "
                "template_register / template_bind"
            )
        return TencentCloudSMSProvider(
            TencentSMSConfig(
                secret_id=settings.tencent_sms_secret_id,
                secret_key=settings.tencent_sms_secret_key,
                app_id=settings.tencent_sms_app_id,
                sign_name=settings.tencent_sms_sign_name,
                template_register=settings.tencent_sms_template_register,
                template_bind=settings.tencent_sms_template_bind,
                template_login_otp=settings.tencent_sms_template_login_otp,
            )
        )
    # Literal 已限到上面三种, 这里到不了; raise 是 future-proof.
    raise RuntimeError(f"unknown sms_provider: {settings.sms_provider!r}")


__all__ = [
    "SMSProvider",
    "SmsSendError",
    "TencentSMSConfig",
    "build_sms_provider",
]
