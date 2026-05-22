from __future__ import annotations

import asyncio
from contextlib import AbstractAsyncContextManager
from threading import Lock, RLock
from types import TracebackType

_registry_lock = RLock()
_locks: dict[int, Lock] = {}


def _get_user_lock(user_id: int) -> Lock:
    with _registry_lock:
        lock = _locks.get(user_id)
        if lock is None:
            lock = Lock()
            _locks[user_id] = lock
        return lock


class _UserExecutionLockGuard(AbstractAsyncContextManager[None]):
    def __init__(self, lock: Lock) -> None:
        self._lock = lock
        self._acquired = False

    async def __aenter__(self) -> None:
        while True:
            acquired = await asyncio.to_thread(self._lock.acquire, False)
            if acquired:
                self._acquired = True
                return None
            await asyncio.sleep(0.01)

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> bool:
        if self._acquired:
            self._lock.release()
            self._acquired = False
        return False


def hold_user_execution_lock(*, user_id: int) -> AbstractAsyncContextManager[None]:
    return _UserExecutionLockGuard(_get_user_lock(user_id))
