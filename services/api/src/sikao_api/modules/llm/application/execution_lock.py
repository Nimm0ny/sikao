from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from threading import RLock

_registry_lock = RLock()
_locks: dict[int, asyncio.Lock] = {}


def _get_user_lock(user_id: int) -> asyncio.Lock:
    with _registry_lock:
        lock = _locks.get(user_id)
        if lock is None:
            lock = asyncio.Lock()
            _locks[user_id] = lock
        return lock


@asynccontextmanager
async def hold_user_execution_lock(*, user_id: int) -> AsyncIterator[None]:
    lock = _get_user_lock(user_id)
    await lock.acquire()
    try:
        yield
    finally:
        lock.release()
