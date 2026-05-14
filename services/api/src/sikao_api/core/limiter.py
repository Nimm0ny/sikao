"""Rate limiter setup — fastapi-limiter + Redis (prod) or noop (dev/test).

Plan §4 + §6 P6: 防爆破/防 SMS 烧钱. dev/tests redis_url=None → 走 noop,
prod 必须 redis_url 配置 (validate_runtime 兜底拦半配置).

API:
- init_limiter(redis_url): 在 FastAPI lifespan startup 调; redis_url=None
  跳过 init, 后续 RateLimiter shim 检测 self.redis = None 自动 noop.
- close_limiter(): lifespan shutdown 调.
- make_limiter(times, seconds, identifier=None): 返 FastAPI dependency.
  noop-aware (无 Redis 时直接 pass).
- Identifier helpers: identifier_by_ip / identifier_by_body_phone /
  identifier_by_body_email — 按需导入到 endpoint dependency 配置.

Plan §4 限流表:
  - /sms/send-code: 1/min/phone, 5/24h/phone, 10/min/IP
  - /email/send-code: 同上
  - /login: 5 失败/30min/identifier — 复杂逻辑 (按失败计数), 推 P1 backlog
  - /forgot-password: 3/min/IP
  - /register/email, /register/phone: 3/min/IP
  - D17(a) confirm: 单 (target_value, IP) 5 失败/10min 锁 (推 P1)
  - D17(c) 24h 同 target ≥10 失败 → 拒发新 code (推 P1)
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from fastapi import Request

logger = logging.getLogger(__name__)


# ─── Lifespan hooks ───────────────────────────────────────


async def init_limiter(redis_url: str | None) -> None:
    """Init FastAPILimiter on app startup.

    None redis_url → skip (dev/test noop). All RateLimiter dependencies
    via make_limiter become passthrough.

    Prod: validate_runtime fail-fast 如果 None (避免静默 noop on prod).
    """
    if redis_url is None:
        logger.info("limiter.disabled redis_url=None (dev/test noop)")
        return
    import redis.asyncio as redis_asyncio
    try:
        from fastapi_limiter import FastAPILimiter
    except ImportError:
        logger.warning("limiter.disabled fastapi_limiter.FastAPILimiter unavailable")
        return

    redis_client = redis_asyncio.from_url(
        redis_url, encoding="utf-8", decode_responses=False
    )
    await FastAPILimiter.init(redis_client)
    logger.info("limiter.enabled redis_url=%s", redis_url)


async def close_limiter() -> None:
    """Close limiter Redis connection on app shutdown.

    No-op when limiter not initialized (redis_url=None / init failed).
    """
    from fastapi_limiter import FastAPILimiter

    if getattr(FastAPILimiter, "redis", None):
        await FastAPILimiter.close()


# ─── Limiter factory + noop shim ──────────────────────────


def make_limiter(
    *,
    times: int,
    seconds: int = 0,
    minutes: int = 0,
    hours: int = 0,
    identifier: Callable[[Request], Any] | None = None,
) -> Callable[..., Any]:
    """Build a noop-aware rate limiter dependency.

    Returns Callable suitable for FastAPI Depends(). Behavior:
      - FastAPILimiter not init'd (dev/test, redis_url=None) → no-op
      - init'd → delegates to fastapi_limiter.depends.RateLimiter

    Why wrapper: fastapi_limiter.depends.RateLimiter raises if redis is None
    (production safety). Dev/test 跑 pytest 时 redis_url=None, 我们想让所有
    rate limit dep 自动 pass. wrapper 检测 self.redis 决定 delegate 或 skip.

    Args:
        times: max requests per window
        seconds/minutes/hours: window size (任一 > 0)
        identifier: async callable extracting rate-limit key from Request.
            Default None → fastapi-limiter default (IP + path)
    """
    try:
        from fastapi_limiter import FastAPILimiter
        from fastapi_limiter.depends import RateLimiter
    except ImportError:
        async def _noop(request: Request, response: Any = None) -> None:
            return

        return _noop

    rate_limiter = RateLimiter(
        times=times,
        seconds=seconds,
        minutes=minutes,
        hours=hours,
        identifier=identifier,
    )

    async def _shim(request: Request, response: Any = None) -> None:
        if not getattr(FastAPILimiter, "redis", None):
            return  # noop in dev/test
        # fastapi-limiter expects (request, response) but FastAPI Depends will
        # pass them automatically when registered as a dependency.
        await rate_limiter(request, response)

    return _shim


# ─── Identifier helpers ───────────────────────────────────


async def identifier_by_ip(request: Request) -> str:
    """Default IP-based identifier (tracks X-Forwarded-For first hop)."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        ip = forwarded.split(",")[0].strip()
    elif request.client:
        ip = request.client.host
    else:
        ip = "127.0.0.1"
    return f"ip:{ip}"


async def identifier_by_body_phone(request: Request) -> str:
    """Extract `phone` from JSON body for per-phone rate limiting.

    Used by /sms/send-code (limit 1/min/phone). normalize_phone applied so
    `+86 138...` 跟 `13800138000` 跨格式同 key 限流.

    Falls back to IP if phone missing / body unparseable (defense — never
    raise, fastapi-limiter swallow exception 会让 limit 失效).
    """
    try:
        body = await request.json()
        phone_raw = body.get("phone")
        if isinstance(phone_raw, str):
            from sikao_api.modules.auth.application.phone import normalize_phone

            normalized = normalize_phone(phone_raw)
            if normalized is not None:
                return f"phone:{normalized}"
    except Exception:  # noqa: BLE001 — must not raise inside identifier
        pass
    # fallback: IP key (worst case 不影响 rate limit, 仅粒度变粗)
    return await identifier_by_ip(request)


async def identifier_by_body_email(request: Request) -> str:
    """Extract `email` from JSON body for per-email rate limiting (lowercased).

    Falls back to IP. Used by /email/send-code (P1 future) + /forgot-password
    (variant if 想按 email 限流).
    """
    try:
        body = await request.json()
        email_raw = body.get("email")
        if isinstance(email_raw, str):
            normalized = email_raw.strip().lower()
            if normalized and "@" in normalized:
                return f"email:{normalized}"
    except Exception:  # noqa: BLE001
        pass
    return await identifier_by_ip(request)
