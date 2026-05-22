from __future__ import annotations

import asyncio

import pytest

from sikao_api.modules.llm.application import execution_lock
from sikao_api.modules.llm.application.execution_lock import hold_user_execution_lock


@pytest.mark.asyncio
async def test_execution_lock_cancellation_does_not_leak_lock() -> None:
    gate = asyncio.Event()
    released = asyncio.Event()

    async def holder() -> None:
        async with hold_user_execution_lock(user_id=99):
            gate.set()
            await released.wait()

    async def waiter() -> None:
        async with hold_user_execution_lock(user_id=99):
            return None

    holder_task = asyncio.create_task(holder())
    await gate.wait()

    waiter_task = asyncio.create_task(waiter())
    await asyncio.sleep(0.05)
    waiter_task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await waiter_task

    released.set()
    await holder_task

    reacquire_task = asyncio.create_task(waiter())
    await asyncio.wait_for(reacquire_task, timeout=1.0)


@pytest.mark.asyncio
async def test_execution_lock_does_not_leak_when_cancelled_immediately_after_acquire(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    original_to_thread = execution_lock.asyncio.to_thread
    current_task = asyncio.current_task()
    assert current_task is not None

    async def patched_to_thread(func, *args):
        result = await original_to_thread(func, *args)
        if result is True:
            asyncio.get_running_loop().call_soon(current_task.cancel)
        return result

    monkeypatch.setattr(execution_lock.asyncio, "to_thread", patched_to_thread)

    with pytest.raises(asyncio.CancelledError):
        async with hold_user_execution_lock(user_id=199):
            await asyncio.sleep(0)

    async with hold_user_execution_lock(user_id=199):
        assert True
