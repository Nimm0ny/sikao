"""User BYOM (Bring Your Own Model) LLM config CRUD — Slice 0c.

每用户多 config (label / base_url / api_key / model 四元组), is_default
标记当前激活. api_key AES-256-GCM 加密存 (services/llm/byom_config.py),
base_url 走 SSRF 防护 (services/llm/ssrf_guard.py).

DNS rebinding 双 check:
- create / update base_url 时 validate_base_url 一次 (合规校验)
- 每次 build provider 调用前 validate_base_url **再一次** (防 hostname rebind)

Service 层是 sync. 真 LLM call 测试 (test_connectivity) 在 route handler 里
async — service 只 decrypt + build provider, 让 caller 跑 await call.
"""

from __future__ import annotations

import builtins
import logging
from collections.abc import Iterable
from datetime import datetime
from typing import Literal

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db.models import UserLlmConfig, utc_now
from sikao_api.modules.system.application.errors import ConflictError, NotFoundError
from sikao_api.modules.llm.application.llm.byom_config import (
    decrypt_api_key,
    encrypt_api_key,
    mask_api_key,
)
from sikao_api.modules.llm.application.llm.openai_compatible import (
    OpenAICompatibleConfig,
    OpenAICompatibleProvider,
)
from sikao_api.modules.llm.application.llm.ssrf_guard import validate_base_url

TestStatus = Literal["ok", "unreachable", "auth_failed", "timeout"]

logger = logging.getLogger(__name__)


class UserLlmConfigService:
    """CRUD over user_llm_configs + decrypt + provider 实例化.

    缺 LLM_CONFIG_ENC_KEY → encrypt/decrypt 会失败. 业务层用 _ensure_master_key
    fail-fast 在 create 时, 比 use site 之后才报错更早暴露.
    """

    def __init__(self, db: Session, settings: Settings) -> None:
        self._db = db
        self._settings = settings

    # ─── public API ─────────────────────────────────────────────────────

    def list(self, *, user_id: int) -> list[UserLlmConfig]:
        """List configs for a user, sorted by created_at desc."""
        stmt = (
            select(UserLlmConfig)
            .where(UserLlmConfig.user_id == user_id)
            .order_by(UserLlmConfig.created_at.desc())
        )
        return list(self._db.scalars(stmt))

    def create(
        self,
        *,
        user_id: int,
        label: str,
        base_url: str,
        api_key: str,
        model: str,
    ) -> UserLlmConfig:
        """Create new BYOM config. SSRF check + AES encrypt + UNIQUE constraint."""
        master_key_hex = self._ensure_master_key()
        validate_base_url(base_url)
        encrypted = encrypt_api_key(
            plaintext=api_key, user_id=user_id, master_key_hex=master_key_hex
        )
        config = UserLlmConfig(
            user_id=user_id,
            label=label,
            base_url=base_url,
            api_key_encrypted=encrypted,
            model=model,
            is_default=False,
        )
        self._db.add(config)
        try:
            self._db.flush()
        except IntegrityError as exc:
            self._db.rollback()
            raise ConflictError(
                f"label {label!r} already exists for this user",
                code="llm_config_label_taken",
            ) from exc
        return config

    def update(
        self,
        *,
        user_id: int,
        config_id: int,
        label: str | None = None,
        base_url: str | None = None,
        api_key: str | None = None,
        model: str | None = None,
    ) -> UserLlmConfig:
        """Partial update. None 字段跳过. 改 base_url 触发 SSRF re-check, 改
        api_key 触发 AES re-encrypt.
        """
        config = self._get_or_404(user_id=user_id, config_id=config_id)
        if label is not None:
            config.label = label
        if base_url is not None:
            validate_base_url(base_url)
            config.base_url = base_url
        if api_key is not None:
            master_key_hex = self._ensure_master_key()
            config.api_key_encrypted = encrypt_api_key(
                plaintext=api_key, user_id=user_id, master_key_hex=master_key_hex
            )
        if model is not None:
            config.model = model
        try:
            self._db.flush()
        except IntegrityError as exc:
            self._db.rollback()
            raise ConflictError(
                f"label {label!r} already exists for this user",
                code="llm_config_label_taken",
            ) from exc
        return config

    def delete(self, *, user_id: int, config_id: int) -> None:
        config = self._get_or_404(user_id=user_id, config_id=config_id)
        self._db.delete(config)
        self._db.flush()

    def set_default(self, *, user_id: int, config_id: int) -> UserLlmConfig:
        """设当前 config 为 default, 同 user 其他全 is_default=False."""
        config = self._get_or_404(user_id=user_id, config_id=config_id)
        # 单 SQL UPDATE 同 user 其他 row is_default=False (避免逐行 mutate).
        self._db.execute(
            update(UserLlmConfig)
            .where(UserLlmConfig.user_id == user_id)
            .where(UserLlmConfig.id != config_id)
            .values(is_default=False)
        )
        config.is_default = True
        self._db.flush()
        return config

    def get_user_default(self, *, user_id: int) -> UserLlmConfig | None:
        """build_llm_provider 用: 返用户 is_default=True 的 config (或 None)."""
        stmt = (
            select(UserLlmConfig)
            .where(UserLlmConfig.user_id == user_id)
            .where(UserLlmConfig.is_default)
        )
        return self._db.scalar(stmt)

    def build_provider(
        self,
        *,
        user_id: int,
        config_id: int,
        timeout_seconds: float = 10.0,
    ) -> tuple[OpenAICompatibleProvider, UserLlmConfig]:
        """Decrypt key + DNS rebinding re-check + build provider.

        Returns (provider, config) tuple — caller (route handler) 拿 config
        读 model 字段构造 chat_completion call (避免重复 _get_or_404 + 重复
        decrypt). 4th-review P1 #5 fix.

        timeout_seconds: 测试连通性默认 10s, 真 LLM call 由 caller 传配置 timeout.
        DNS rebinding 防护: validate_base_url 第二次 check, hostname 可能被 rebind.
        """
        config = self._get_or_404(user_id=user_id, config_id=config_id)
        master_key_hex = self._ensure_master_key()
        api_key = decrypt_api_key(
            blob=config.api_key_encrypted,
            user_id=user_id,
            master_key_hex=master_key_hex,
        )
        # DNS rebinding double-check: create 时 resolve 过, 调用前再 resolve.
        validate_base_url(config.base_url)
        provider = OpenAICompatibleProvider(
            OpenAICompatibleConfig(
                base_url=config.base_url,
                api_key=api_key,
                timeout_seconds=timeout_seconds,
            )
        )
        return provider, config

    def update_test_status(
        self,
        *,
        user_id: int,
        config_id: int,
        status: TestStatus,
        tested_at: datetime | None = None,
    ) -> None:
        """Route handler 测连通性后回调写 last_tested_at / status.

        P1-2 fix (security review 2026-04-30): 加 user_id 参数 + ownership check.
        当前 caller (llm_v2.py:266/299) 在 build_provider 已 ownership check,
        无利用路径; 但 helper 自身签名允许跨用户写, 防御层加一道.

        语义说明 (回归 review P1-C): test status 回写是 best-effort, 不该把 test
        endpoint 主流程失败. 但 ownership 失败仍是 caller bug, 需要 logger.warning
        让调试可追 (silent skip 不撞 §4 fail-fast 唯一例外的"明确容错"语义).
        """
        config = self._db.get(UserLlmConfig, config_id)
        if config is None:
            logger.warning(
                "user_llm_configs.update_test_status no_such_config "
                "config_id=%s user_id=%s",
                config_id, user_id,
            )
            return
        if config.user_id != user_id:
            logger.warning(
                "user_llm_configs.update_test_status ownership_mismatch "
                "config_id=%s caller_user_id=%s actual_owner=%s",
                config_id, user_id, config.user_id,
            )
            return
        config.last_tested_at = tested_at or utc_now()
        config.last_tested_status = status
        self._db.flush()

    def serialize_masked(self, configs: Iterable[UserLlmConfig]) -> builtins.list[dict[str, object]]:
        """UI 序列化: api_key 永远 mask, 不返 raw 给前端."""
        master_key_hex = self._settings.llm_config_enc_key
        result: builtins.list[dict[str, object]] = []
        for config in configs:
            try:
                if master_key_hex is None:
                    masked = "***"
                else:
                    plaintext = decrypt_api_key(
                        blob=config.api_key_encrypted,
                        user_id=config.user_id,
                        master_key_hex=master_key_hex,
                    )
                    masked = mask_api_key(plaintext)
            except Exception:
                # decrypt 失败 (master key 改 / blob 损坏) → 仍返 row 但 mask
                # 完全 hide. 用户看到 row 但不知道 key, 引导他重新填 api_key.
                masked = "***"
            result.append({
                "id": config.id,
                "label": config.label,
                "base_url": config.base_url,
                "model": config.model,
                "is_default": config.is_default,
                "api_key_masked": masked,
                "last_tested_at": (
                    config.last_tested_at.isoformat()
                    if config.last_tested_at is not None
                    else None
                ),
                "last_tested_status": config.last_tested_status,
                "created_at": config.created_at.isoformat(),
                "updated_at": config.updated_at.isoformat(),
            })
        return result

    # ─── private ────────────────────────────────────────────────────────

    def _get_or_404(self, *, user_id: int, config_id: int) -> UserLlmConfig:
        """Lookup config by id + check ownership.

        跨 user (User A 试图动 User B 的 config) 一律返 NotFoundError 而非
        ForbiddenError — 信息隐藏 (timing-attack defensive): 让 attacker 无法
        探测 config 是否存在. trade-off: user 自己 typo config_id 看到 404
        跟"真不存在"无法区分, 接受.
        """
        config = self._db.get(UserLlmConfig, config_id)
        if config is None or config.user_id != user_id:
            raise NotFoundError(
                f"BYOM config {config_id} not found", code="llm_config_not_found"
            )
        return config

    def _ensure_master_key(self) -> str:
        from sikao_api.modules.llm.application.llm import LLMConfigError

        if not self._settings.llm_config_enc_key:
            raise LLMConfigError(
                "BYOM unavailable: LLM_CONFIG_ENC_KEY not configured "
                "(set 32-byte hex env var)"
            )
        return self._settings.llm_config_enc_key
