"""SMS / Email pre-register code service — Identity v2 (D9, D17, D19).

Generate / verify target-bound codes for register / bind / future OTP login.
跟 AuthRecoveryService 互补:
  - AuthRecoveryService: **user-bound** tokens (password_reset / email_verify,
    user 已登录, AuthToken.user_id NOT NULL)
  - SmsCodeService: **target-bound** codes (target_kind + target_value, user
    还不存在 [register] 或 user.phone/email 还未写 [bind])

设计点:
  - D9: target-bound 不依赖 user_id, register / bind 复用同一表
  - D17 (b) confirm 端自废: 单 code 失败 ≥3 → mark used_at=now (一次性废,
    引导用户重发 code, 防爆破)
  - D19 比对: code_hash WHERE 查 (DB-side lookup, 跟 AuthToken._lookup_token
    同模式, 天然防时序攻击, Python `==` 比 hash 不安全)
  - Replace 模式: issue_code 时 invalidate 同 target+purpose 旧 unused codes
    (减 active code surface + 防表灌满)

错误语义: 任何 verify 失败 (不存在 / 已 used / 过期 / hash 不匹配) 都返
GoneError + code="code_invalid" — 攻击者 probe 不到额外信息. 跟
auth_recovery._consume_token_or_raise 同模式.
"""

from __future__ import annotations

import hashlib
import logging
import secrets
import string
from datetime import datetime, timedelta
from typing import Literal

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db.models import PreRegisterCode, utc_now
from sikao_api.modules.system.application.errors import GoneError

logger = logging.getLogger(__name__)


CodePurpose = Literal["register", "bind_phone", "bind_email", "login_otp"]
TargetKind = Literal["phone", "email"]

# D17 (b): 单 code confirm 失败 ≥3 → mark used_at=now (一次性废).
# 3 是 industry standard (银行 / 支付场景普遍 3-5), 平衡用户笨手 vs 爆破成本.
D17_MAX_ATTEMPTS = 3


def _generate_numeric_code(length: int) -> str:
    """N-digit random numeric, secrets-backed (CSPRNG).

    可含 leading zero (e.g. "012345"); 模板报备时允许首位 0.
    secrets.choice + string.digits 让 code 在 [0, 10^length) 均匀分布.
    """
    return "".join(secrets.choice(string.digits) for _ in range(length))


def _hash_code(code: str) -> str:
    """sha256(code) hex. 跟 AuthToken.token_hash 同模式 (D19 防时序攻击)."""
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


class SmsCodeService:
    """Pre-register code orchestrator. 不直 emit HTTP / 不发 SMS.

    职责边界 (SRP):
      - 此 service: code 生成 / hash / 持久化 / 验证 / attempt 计数
      - 调用方 (auth_v2 route): 调 sms_provider.send_verify_code(to_phone=..., code=...)
        + 决定 dev gate (`dev_expose_magic_code`) 暴露 _devMagicCode
      - 限流 (D13/D14): fastapi-limiter 在 route dependency 层 (commit #6)
    """

    def __init__(self, session: Session, settings: Settings) -> None:
        self.session = session
        self.settings = settings

    # ---- issue ------------------------------------------------------------

    def issue_code(
        self,
        *,
        target_kind: TargetKind,
        target_value: str,
        purpose: CodePurpose,
        user_id: int | None = None,
        requester_ip: str | None = None,
        raw_code: str | None = None,
    ) -> str:
        """Generate new code + persist pre_register_codes row. Return raw code.

        user_id (#4a fix): bind/* 必填 (logged-in user.id, 防 token leak —
        attacker 偷 victim newEmail token 不能在 attacker session confirm 写
        attacker.email); register / login_otp 时 None (user 还不存在).

        raw_code (#4a): bind_email 流要求传 secrets.token_urlsafe(32) 风格的
        link token (caller 已生成, 此 helper 只算 hash + persist). register /
        login_otp 不传, 内部用 _generate_numeric_code 生成 6-digit 数字.

        Caller 后续:
          - SMS purpose: sms_provider.send_verify_code(to_phone=target_value,
            code=raw_code, purpose=purpose)
          - Email purpose (bind_email): email_provider.send(to=target_value,
            link=f"{frontend_base_url}/bind-email?token={raw_code}")
          - dev 模式 (settings.dev_expose_magic_code 双 gate): 把 raw_code 也
            放 response.body._devMagicCode (SMS) / _devMagicLink (email).

        Side effect: invalidate 旧 unused codes — 两种模式:
          - bind_email / bind_phone (user_id 必填): 按 (purpose, user_id) prune
            所有 newEmail/newPhone (#6c P2 from #4 review F1: 用户连发 N 次 bind
            link 旧 row 累积, 现 user-level prune 收口)
          - register / login_otp (user_id NULL): 按 (target_kind, target_value,
            purpose) prune (不同 phone 同 register code 互不干涉)
        """
        now_ts = utc_now()
        self._invalidate_unused_codes(
            target_kind=target_kind,
            target_value=target_value,
            purpose=purpose,
            user_id=user_id,
            now_ts=now_ts,
        )
        if raw_code is None:
            raw_code = _generate_numeric_code(self.settings.auth_sms_code_length)
        ttl_min = self.settings.auth_sms_code_ttl_minutes
        row = PreRegisterCode(
            user_id=user_id,
            target_kind=target_kind,
            target_value=target_value,
            purpose=purpose,
            code_hash=_hash_code(raw_code),
            expires_at=now_ts + timedelta(minutes=ttl_min),
            requester_ip=requester_ip,
        )
        self.session.add(row)
        self.session.flush()
        logger.info(
            "sms_code.issued target_kind=%s purpose=%s user_id=%s requester_ip=%s",
            target_kind,
            purpose,
            user_id,
            requester_ip,
        )
        return raw_code

    def _invalidate_unused_codes(
        self,
        *,
        target_kind: TargetKind,
        target_value: str,
        purpose: CodePurpose,
        user_id: int | None,
        now_ts: datetime,
    ) -> None:
        """Mark used_at=now_ts on 旧 unused codes. 两种 prune 模式:

        - **bind_phone / bind_email** (user_id 必非 None): 按 (purpose, user_id)
          prune 所有 newEmail/newPhone 不论 target_value (#6c P2 from #4 review
          F1: 用户连发 N 次 bind link 旧 row 累积; user-level prune 让同 user
          同 purpose 同时只 1 active row).
        - **register / login_otp** (user_id is None): 按 (target_kind, target_value,
          purpose) prune (不同 phone 同 register code 互不干涉, target_value 强约束).

        SQLAlchemy `user_id == None` 自动转 `IS NULL`. 跨 register/bind 自然隔离
        (register row.user_id IS NULL ≠ bind row.user_id is int).
        """
        is_bind_purpose = purpose in ("bind_phone", "bind_email") and user_id is not None
        conditions = [
            PreRegisterCode.purpose == purpose,
            PreRegisterCode.user_id == user_id,
            PreRegisterCode.used_at.is_(None),
        ]
        if not is_bind_purpose:
            # register / login_otp: 限同 target — 不同 phone/email 互不干涉.
            conditions.extend(
                [
                    PreRegisterCode.target_kind == target_kind,
                    PreRegisterCode.target_value == target_value,
                ]
            )
        self.session.execute(
            update(PreRegisterCode)
            .where(*conditions)
            .values(used_at=now_ts)
        )

    # ---- verify -----------------------------------------------------------

    def verify_code(
        self,
        *,
        target_kind: TargetKind,
        target_value: str,
        purpose: CodePurpose,
        code: str,
        user_id: int | None = None,
        confirmer_ip: str | None = None,
    ) -> PreRegisterCode:
        """Verify code (D19 DB-side hash lookup) + mark used_at on success.

        user_id (#4a fix): caller 必须传当前 session user.id (bind/*) 或 None
        (register/login_otp). WHERE 强匹配 user_id — 防 attacker 偷 victim 的
        bind token 在自己 session 用, 也防 register code 被重用为 bind code.
        SQLAlchemy `== None` 自动转 `IS NULL`, register row (user_id=NULL) 跟
        bind row (user_id=int) 互不命中.

        D17 (b) 失败路径:
          - hash 不匹配 / 已 used / 已过期 / user_id 不对 → 找 (target, purpose,
            user_id) active code 给 attempt_count+1
          - attempt_count ≥3 → mark used_at=now (一次性废, 引导用户重发 code)
          - 全部错误返 GoneError("code_invalid") — 攻击者 probe 行为一致

        Returns: 验证通过的 PreRegisterCode row (caller 用 row 后续 side
        effect, e.g. AuthService.register_phone 创 user + phone_verified=True).
        """
        now_ts = utc_now()
        # D19: code_hash 作 SQL WHERE 查 (DB-side lookup), 不在 Python 层 ==
        # 比 hash. 跟 AuthToken._lookup_token 同模式.
        # #4a: PreRegisterCode.user_id == user_id (None matches NULL via SQLAlchemy)
        # — register row (user_id=NULL) 跟 bind row (user_id=int) 互不命中.
        row = self.session.scalar(
            select(PreRegisterCode).where(
                PreRegisterCode.target_kind == target_kind,
                PreRegisterCode.target_value == target_value,
                PreRegisterCode.purpose == purpose,
                PreRegisterCode.code_hash == _hash_code(code),
                PreRegisterCode.user_id == user_id,
                PreRegisterCode.used_at.is_(None),
                PreRegisterCode.expires_at > now_ts,
            )
        )
        if row is None:
            # 失败: D17 (b) 找 active code 加 attempt; ≥3 mark used.
            self._increment_attempt_for_target(
                target_kind=target_kind,
                target_value=target_value,
                purpose=purpose,
                user_id=user_id,
                now_ts=now_ts,
            )
            raise GoneError("invalid or expired code", code="code_invalid")

        # 成功: mark used_at (single-use).
        row.used_at = now_ts
        if confirmer_ip is not None:
            row.confirmer_ip = confirmer_ip
        self.session.flush()
        return row

    def _increment_attempt_for_target(
        self,
        *,
        target_kind: TargetKind,
        target_value: str,
        purpose: CodePurpose,
        user_id: int | None,
        now_ts: datetime,
    ) -> None:
        """D17 (b): 失败时 active code attempt+1; ≥3 mark used_at=now.

        active code 同 (target, purpose, user_id) 单 row (issue_code replace
        模式保证), 不需 race-safe SQL update — flush() 让 ORM 层 dirty tracking
        更新. 无 active code (e.g. attacker 撞陌生 target / 错 user_id 跨流) →
        静默 no-op (失败仍报 invalid, probe 行为一致).
        """
        active = self.session.scalar(
            select(PreRegisterCode).where(
                PreRegisterCode.target_kind == target_kind,
                PreRegisterCode.target_value == target_value,
                PreRegisterCode.purpose == purpose,
                PreRegisterCode.user_id == user_id,
                PreRegisterCode.used_at.is_(None),
                PreRegisterCode.expires_at > now_ts,
            )
        )
        if active is None:
            return
        active.attempt_count += 1
        if active.attempt_count >= D17_MAX_ATTEMPTS:
            active.used_at = now_ts
        self.session.flush()
