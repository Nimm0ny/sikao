"""Tencent Cloud SMS provider — Identity v2 (D8) prod 用.

使用 tencentcloud-sdk-python (装在 [sms] optional extra). dev (.[dev])
不装 SDK, 跑 stub 不影响. prod (.[postgres,sms]) 装 SDK 后由
settings.sms_provider=="tencent" 触发 factory 切到此 provider.

ARCH §7.3 P3 backlog 关闭. 切真短信前 ops 完成:
  1. 腾讯云控制台 (https://console.cloud.tencent.com/smsv2) 注册 + 企业实名
  2. 申请短信签名 (e.g. "思考"), 报备 1-2 工作日审核
  3. 申请短信模板 (注册码 / 绑定码 / OTP), 报备审核
  4. 取得 SmsSdkAppId / SecretId / SecretKey, 设到 prod env
  5. 设 SMS_PROVIDER=tencent + TENCENT_SMS_* 6 个字段

模板报备约定 (D17 配合 10min TTL):
  - 注册: "您的注册验证码 {1}, 10 分钟内有效, 请勿泄露."
  - 绑定: "您的绑定验证码 {1}, 10 分钟内有效, 请勿泄露."
  - OTP (Phase 1 不强制): "您的登录验证码 {1}, 10 分钟内有效."

错误语义:
  - SDK 异常 (TencentCloudSDKException) propagate — 网络 / 鉴权 / 限流
  - 业务失败 (resp.SendStatusSet[0].Code != "Ok") raise SmsSendError
    带 vendor code + message 给 ops 排查 (PhoneNumberInvalid /
    QuotaExceeded / TemplateInvalid / 等)

API ref: https://cloud.tencent.com/document/api/382/55981
"""

from __future__ import annotations

from dataclasses import dataclass
import importlib
from typing import Any

from sikao_api.modules.system.infrastructure.sms.provider import SmsPurpose

# 腾讯云 SMS 全国 endpoint + region (国内业务都走 ap-guangzhou).
TENCENT_SMS_ENDPOINT = "sms.tencentcloudapi.com"
TENCENT_SMS_REGION = "ap-guangzhou"


@dataclass(frozen=True)
class TencentSMSConfig:
    """Tencent Cloud SMS config — 跟 settings 解耦, factory 端读 env."""

    secret_id: str
    secret_key: str
    app_id: str
    sign_name: str
    template_register: str
    template_bind: str
    template_login_otp: str | None = None


class SmsSendError(RuntimeError):
    """Vendor-side 业务失败 (HTTP 成功但 SendStatusSet[0].Code != 'Ok').

    包含 vendor code + message 给 ops 排查. 调用方 (auth_binding service)
    决定 swallow vs surface (类比 forgot-password D5 silent-200 模式).
    """

    def __init__(self, code: str, message: str, *, phone: str) -> None:
        super().__init__(
            f"sms send failed: code={code} msg={message} phone={phone}"
        )
        self.vendor_code = code
        self.vendor_message = message


def _import_sdk_or_raise() -> tuple[Any, Any]:
    """Lazy-import SDK at first use; raise actionable error if [sms] missing.

    Returns:
        (models, sms_client) module objects from tencentcloud.sms.v20210111.
    """
    try:
        models = importlib.import_module("tencentcloud.sms.v20210111.models")
        sms_client = importlib.import_module("tencentcloud.sms.v20210111.sms_client")
    except ImportError as exc:
        raise RuntimeError(
            "sms_provider=tencent requires .[sms] optional extra: "
            "`pip install -e '.[postgres,sms]'`. "
            "tencentcloud-sdk-python is not installed."
        ) from exc
    return models, sms_client


def _build_default_client(config: TencentSMSConfig) -> Any:
    """Build a real tencentcloud SmsClient. 走 lazy import 防止 dev 误触."""
    try:
        credential = importlib.import_module("tencentcloud.common.credential")
        client_profile_module = importlib.import_module(
            "tencentcloud.common.profile.client_profile"
        )
        http_profile_module = importlib.import_module(
            "tencentcloud.common.profile.http_profile"
        )
        sms_client = importlib.import_module("tencentcloud.sms.v20210111.sms_client")
    except ImportError as exc:
        raise RuntimeError(
            "sms_provider=tencent requires .[sms] optional extra: "
            "`pip install -e '.[postgres,sms]'`. "
            "tencentcloud-sdk-python is not installed."
        ) from exc
    cred = credential.Credential(config.secret_id, config.secret_key)
    http_profile = http_profile_module.HttpProfile()
    http_profile.endpoint = TENCENT_SMS_ENDPOINT
    client_profile = client_profile_module.ClientProfile()
    client_profile.httpProfile = http_profile
    return sms_client.SmsClient(cred, TENCENT_SMS_REGION, client_profile)


class TencentCloudSMSProvider:
    """Tencent Cloud SMS API client. Implements SMSProvider Protocol.

    Constructor 注入点 (test 友好):
      - client: 注入 mock SmsClient 跳过 real SDK 调用
      - models_module: 注入 mock models 跳过 lazy import
    """

    def __init__(
        self,
        config: TencentSMSConfig,
        *,
        client: Any | None = None,
        models_module: Any | None = None,
    ) -> None:
        self._config = config
        if models_module is None:
            models_module, _ = _import_sdk_or_raise()
        self._models = models_module
        if client is None:
            client = _build_default_client(config)
        self._client = client

    def _resolve_template_id(self, purpose: SmsPurpose) -> str:
        if purpose == "register":
            return self._config.template_register
        if purpose == "bind_phone":
            return self._config.template_bind
        if purpose == "login_otp":
            tpl = self._config.template_login_otp
            if tpl is None:
                raise RuntimeError(
                    "tencent_sms_template_login_otp required for purpose=login_otp"
                )
            return tpl
        # SmsPurpose Literal 已限到三种, 这里到不了; raise 是 future-proof.
        raise RuntimeError(f"unknown sms purpose: {purpose!r}")

    def send_verify_code(
        self,
        *,
        to_phone: str,
        code: str,
        purpose: SmsPurpose,
    ) -> None:
        # 腾讯云 PhoneNumberSet 要求 E.164 格式 +86 前缀;
        # normalize_phone 输出 11 位纯数字, 拼即可.
        e164_phone = f"+86{to_phone}"
        template_id = self._resolve_template_id(purpose)

        req = self._models.SendSmsRequest()
        req.SmsSdkAppId = self._config.app_id
        req.SignName = self._config.sign_name
        req.TemplateId = template_id
        # 模板 {1} 占位 — 模板报备时定义只有一个参数 (6-digit code).
        req.TemplateParamSet = [code]
        req.PhoneNumberSet = [e164_phone]

        # SDK SendSms 失败 (TencentCloudSDKException) 直接抛.
        # 鉴权错误 / 网络错误 / 限流 / API 不可用都走这条路径.
        resp = self._client.SendSms(req)

        # 业务级失败检查: 单 phone 也要看 SendStatusSet[0].Code.
        # 成功 "Ok"; 任何非 Ok 都 raise SmsSendError 让上层决定吞 vs 抛.
        statuses = resp.SendStatusSet or []
        if not statuses:
            # 罕见: 200 OK 但 SendStatusSet 空. 当业务失败处理.
            raise SmsSendError(
                "EmptyStatusSet", "no SendStatus returned", phone=to_phone
            )
        status = statuses[0]
        if status.Code != "Ok":
            raise SmsSendError(status.Code, status.Message, phone=to_phone)
