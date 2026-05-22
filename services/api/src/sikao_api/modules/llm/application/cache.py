"""Small in-process caches for Home LLM features."""

from __future__ import annotations

from threading import RLock
from typing import Any

from cachetools import TTLCache

_caches: dict[int, TTLCache[str, Any]] = {}
_lock = RLock()


def _get_cache(ttl_seconds: int) -> TTLCache[str, Any]:
    with _lock:
        cache = _caches.get(ttl_seconds)
        if cache is None:
            cache = TTLCache(maxsize=512, ttl=ttl_seconds)
            _caches[ttl_seconds] = cache
        return cache


def get_cached_value(*, ttl_seconds: int, key: str) -> Any | None:
    with _lock:
        return _get_cache(ttl_seconds).get(key)


def set_cached_value(*, ttl_seconds: int, key: str, value: Any) -> None:
    with _lock:
        _get_cache(ttl_seconds)[key] = value


def invalidate_user_prefix(*, ttl_seconds: int, user_prefix: str) -> None:
    with _lock:
        cache = _get_cache(ttl_seconds)
        doomed = [key for key in cache.keys() if key.startswith(user_prefix)]
        for key in doomed:
            cache.pop(key, None)


def invalidate_user_prefix_all(*, user_prefix: str) -> None:
    with _lock:
        caches = list(_caches.values())
        for cache in caches:
            doomed = [key for key in cache.keys() if key.startswith(user_prefix)]
            for key in doomed:
                cache.pop(key, None)
