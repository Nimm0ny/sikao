"""LLM service factory + public API — Slice 0a.

build_llm_provider(settings) → OpenAICompatibleProvider 配 settings 默认.
Slice 0c (BYOM) 后扩 user_id 参数, 优先读 user_llm_configs.is_default
(encrypted key 解密 + SSRF 校验 + 调用前 re-resolve DNS).

Provider 配置不全 → LLMConfigError (route 层 catch → 503 service_unavailable).
"""

from __future__ import annotations

import logging
import re
from typing import Literal

from sikao_api.core.config import Settings
from sikao_api.modules.system.application.errors import LLMServiceError
from sikao_api.modules.llm.application.llm.byom_config import InvalidEncryptedBlob
from sikao_api.modules.llm.application.llm.openai_compatible import (
    OpenAICompatibleConfig,
    OpenAICompatibleProvider,
)
from sikao_api.modules.llm.application.llm.provider import (
    ChatCompletionChunk,
    ChatCompletionResult,
    LLMMessage,
    LLMProvider,
)
from sikao_api.modules.llm.application.llm.ssrf_guard import SsrfBlockedError
from sikao_api.modules.llm.application.llm.usage_estimator import estimate_tokens

logger = logging.getLogger(__name__)

# host 后必须紧跟 `:port` / `/path` / 字符串结尾, 防子域钓鱼 (如
# 'http://localhost.evil.com') + DNS rebind. 跟 app/core/config.py
# `_LOCAL_HOST_HTTP_RE` keep in sync.
_LOCAL_HOST_HTTP_RE = re.compile(r"^http://(?:localhost|127\.0\.0\.1)(?::\d+|/|$)")


class LLMConfigError(LLMServiceError):
    """LLM 配置不完整 (e.g. api_key 缺失 / base_url 非法). 503 + code='llm_config_missing'.

    跟 errors.py ServiceError 协议对齐, route 层统一 catch ServiceError 转
    JSON {message, code} + status_code, 不需要单独 handler.
    """

    def __init__(self, message: str) -> None:
        super().__init__(message, code="llm_config_missing")


ProviderLabel = Literal["mock", "system", "user_byom"]


def build_llm_provider(
    settings: Settings,
    *,
    db: object | None = None,
    user_id: int | None = None,
    timeout_seconds_override: float | None = None,
) -> tuple[LLMProvider, ProviderLabel]:
    """Factory: 优先用户 BYOM default config, fallback system default settings.

    返 (provider, label) tuple — label 是**实际选用**的 provider 标签 ('system'
    或 'user_byom'), 给 caller 在记账时 (Slice 0b record_usage) 准确标记 provider.
    Slice 1a review P1: 早先返裸 provider, caller 反推 label 时 BYOM fallback
    场景错标 'user_byom' (实际走 system) — 改 tuple 让 truth 由 factory 唯一来源.

    PoC 阶段:
    - db + user_id 都传 → 查 user_llm_configs.is_default. 有 → decrypt + SSRF
      re-check + 用 user's base_url/model. label='user_byom'.
    - db / user_id 缺 / decrypt fail / SSRF rebind → fallback system default,
      label='system'.

    Slice 1a/2c/3a 的 route handler 应当传 db + user_id 让用户 BYOM 生效.
    匿名 / system task (e.g. cron) 不传, 走 system default.

    db 类型 marked `object` 避 circular import (sqlalchemy.orm.Session 在
    services/llm/__init__.py 不直接 import). 实际 lazy import 时拿 Session.

    timeout_seconds_override (Slice 3a P0-new-2): **仅作用 system path**.
    传入 → system path 用此 timeout 覆盖 settings.llm_timeout_seconds (默认
    120s, config.py). BYOM path **不应用 override**, 继续用
    settings.llm_timeout_seconds (用户自配 base_url 可能高延迟 azure region
    等, 强制 override 反而打断用户; 用户自配自负). Slice 3a 学习计划同步
    路径用此压短到 10s, 申论批改 / AI 答疑等不传走默认 120s.
    """
    # Explicit mock provider always wins.
    if settings.llm_provider == "mock":
        from sikao_api.modules.llm.application.llm._stub import StubLLMProvider

        return StubLLMProvider(), "mock"

    # Test env fallback: no implicit .env/apikey file lookup, and no real key means
    # deterministic stub. If the caller explicitly provides a real key in test env,
    # allow the real provider path for smoke/debug use.
    if settings.app_env == "test" and not settings.llm_api_key:
        from sikao_api.modules.llm.application.llm._stub import StubLLMProvider

        return StubLLMProvider(), "mock"

    # Try user BYOM first (Slice 0c). 4th-review P1 #3: decrypt 失败 / SSRF
    # 失败 → logger.warn + fallback system default (BYOM 是 optional layer,
    # 不该让全站 AI 500 直到用户手动删除 row).
    if db is not None and user_id is not None:
        from sikao_api.modules.llm.application.user_configs import UserLlmConfigService

        service = UserLlmConfigService(db, settings)  # type: ignore[arg-type]
        user_default = service.get_user_default(user_id=user_id)
        if user_default is not None:
            try:
                provider, _config = service.build_provider(
                    user_id=user_id,
                    config_id=user_default.id,
                    timeout_seconds=float(settings.llm_timeout_seconds),
                )
                return provider, "user_byom"
            except InvalidEncryptedBlob as exc:
                logger.warning(
                    "llm.byom.decrypt_failed user_id=%s config_id=%s err=%s -> fallback to system default",
                    user_id,
                    user_default.id,
                    exc,
                )
            except SsrfBlockedError as exc:
                logger.warning(
                    "llm.byom.ssrf_recheck_failed user_id=%s config_id=%s err=%s -> fallback to system default",
                    user_id,
                    user_default.id,
                    exc,
                )

    # Fallback to system default (Slice 0a).
    if not settings.llm_api_key:
        raise LLMConfigError(
            "LLM_API_KEY not configured. Set env var or write to .env/apikey."
        )
    # E2E / smoke escape hatch: LLM_API_KEY 以 'mock-' / 'fake-' 开头时返
    # in-process StubLLMProvider, 不打真 LLM. essay grade 走 stub fixture
    # (200ms 假延迟模拟 BackgroundTask). 详 services/llm/_stub.py.
    if settings.llm_api_key.startswith(("mock-", "fake-")):
        from sikao_api.modules.llm.application.llm._stub import StubLLMProvider

        return StubLLMProvider(), "mock"
    base_url = settings.llm_base_url.strip()
    if not _is_acceptable_base_url_scheme(base_url):
        raise LLMConfigError(
            f"LLM_BASE_URL must start with 'https://' or 'http://localhost' "
            f"(dev). Got: {base_url!r}"
        )
    # P0-new-2: system path 应用 timeout override; BYOM path 上面 line ~92 不应用.
    system_timeout = (
        timeout_seconds_override
        if timeout_seconds_override is not None
        else float(settings.llm_timeout_seconds)
    )
    config = OpenAICompatibleConfig(
        base_url=base_url,
        api_key=settings.llm_api_key,
        timeout_seconds=system_timeout,
    )
    return OpenAICompatibleProvider(config), "system"


def _is_acceptable_base_url_scheme(url: str) -> bool:
    """https:// 起头 (生产), 或 http://localhost / http://127.0.0.1 (dev vLLM).

    拒 file:// / ftp:// / 任意公网 http (避免明文 key 泄露). 用 regex 限定
    host 边界 ('localhost' 后紧跟 ':' / '/' / EOF), 防子域钓鱼 (例如
    'http://localhost.evil.com').
    """
    if url.startswith("https://"):
        return True
    return bool(_LOCAL_HOST_HTTP_RE.match(url))


__all__ = [
    "ChatCompletionChunk",
    "ChatCompletionResult",
    "LLMConfigError",
    "LLMMessage",
    "LLMProvider",
    "ProviderLabel",
    "build_llm_provider",
    "estimate_tokens",
]
