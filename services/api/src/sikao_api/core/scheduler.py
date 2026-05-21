"""Phase-Profile PR-P6: hard-delete sweep scheduler.

把 `modules.profile_v2.application.deletion_worker.run_hard_delete_sweep`
接到 FastAPI lifespan 后台任务，按 `deletion_sweep_interval_seconds` 周期
触发；启动时可选 `deletion_sweep_run_on_startup` 立即跑（运维兜底），否则
延迟 `deletion_sweep_initial_delay_seconds` 防 startup 抖动。

设计依据：D-P11 + Del-5/6/7（详见 docs/vault/05-migration/Phase/Profile/
00-Decisions.md §3）。

为什么不引 APScheduler：
- 调度需求单一（一个 sweep 任务）
- multi-uvicorn-worker 下 APScheduler 仍要 Redis jobstore 协调，复杂度反超
- pytest 友好（默认关闭，无新依赖）

为什么 worker 包 `asyncio.to_thread`：
- run_hard_delete_sweep 是同步 SQLAlchemy Session API（PR-P5 既有签名）
- 在 async lifespan 任务里直接调会阻塞 event loop（uvicorn 的 HTTP 请求会卡住）
- to_thread 把同步 IO 推到 default ThreadPoolExecutor，event loop 保持响应

故障隔离（Del-7）：
- worker 内部已有 v2-#1 FK SET NULL 审计保留 + v2-#2 单 job 异常 rollback
- scheduler 层再包一层 try/except 吞掉所有 worker 异常 + log error
- worker 抛出 → loop 不退出 → 下个周期照常跑（task 退出 = 后续到期 job 永远积压）

多 worker 警告：
- run_hard_delete_sweep 有 race（两个 worker 同时拿到同一 pending job → 第二个
  delete user 时已被 FK CASCADE 清掉 → 标 failed 给本应 completed 的 job）
- MVP 部署：仅 leader worker 设 DELETION_SWEEP_ENABLED=true，或起独立 worker
  进程（uvicorn --workers 1）专门跑 sweep
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import Callable
from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from sikao_api.db.session import DatabaseManager

_logger = logging.getLogger(__name__)


# Worker 函数签名: (session) -> processed_count.
# 默认 import 时从 deletion_worker 取，测试可注入 stub 不依赖 ORM。
SweepFn = Callable[[Session], int]


def _default_sweep_fn() -> SweepFn:
    # Lazy import 避免 core 包反向依赖 modules 包（main.py 启动顺序敏感）。
    from sikao_api.modules.profile_v2.application.deletion_worker import (
        run_hard_delete_sweep,
    )

    return run_hard_delete_sweep


class DeletionSweepScheduler:
    """Account-deletion hard-delete sweep, lifespan-managed asyncio task.

    Lifecycle:
        scheduler = DeletionSweepScheduler(db, ...)
        await scheduler.start()    # in FastAPI lifespan startup
        # ... uvicorn serves requests; sweep runs every interval_seconds
        await scheduler.stop()     # in FastAPI lifespan shutdown (cancels task)

    Task body (`_run_loop`)：
        1. 若 run_on_startup=False → wait initial_delay_seconds（或 stop()）
        2. while not stopped:
             - asyncio.to_thread(self._sweep_in_session)
             - 异常 → log + 吞（loop 不退出）
             - wait interval_seconds（或 stop() 立即唤醒）
        3. asyncio.CancelledError → 让出（stop() 调用 cancel() 后到达）

    Stop 用 asyncio.Event：sleep 期间可立即唤醒，避免 shutdown 等满 24h。
    """

    def __init__(
        self,
        db: DatabaseManager,
        *,
        interval_seconds: float,
        initial_delay_seconds: float,
        run_on_startup: bool,
        sweep_fn: SweepFn | None = None,
    ) -> None:
        if interval_seconds <= 0:
            raise ValueError(
                f"interval_seconds must be > 0, got {interval_seconds}"
            )
        if initial_delay_seconds < 0:
            raise ValueError(
                f"initial_delay_seconds must be >= 0, got {initial_delay_seconds}"
            )

        self._db = db
        self._interval = float(interval_seconds)
        self._initial_delay = float(initial_delay_seconds)
        self._run_on_startup = run_on_startup
        # sweep_fn 注入点：测试可传 stub，prod 默认 deletion_worker.run_hard_delete_sweep
        self._sweep_fn: SweepFn = sweep_fn or _default_sweep_fn()
        self._task: asyncio.Task[None] | None = None
        self._stop_event: asyncio.Event | None = None

    @property
    def is_running(self) -> bool:
        return self._task is not None and not self._task.done()

    async def start(self) -> None:
        """Schedule the background sweep task. Idempotent: 二次调用是 no-op。"""
        if self.is_running:
            _logger.warning("deletion_sweep.start_skipped reason=already_running")
            return
        # Event 必须在 start 时（即 event loop 内）创建，构造期 loop 可能不存在。
        self._stop_event = asyncio.Event()
        self._task = asyncio.create_task(
            self._run_loop(), name="profile-deletion-sweep"
        )
        _logger.info(
            "deletion_sweep.started interval_seconds=%.0f initial_delay=%.0f run_on_startup=%s",
            self._interval,
            self._initial_delay,
            self._run_on_startup,
        )

    async def stop(self) -> None:
        """Cancel the task and wait for it to settle. Idempotent."""
        task = self._task
        if task is None:
            return
        if self._stop_event is not None:
            self._stop_event.set()
        if not task.done():
            task.cancel()
        # 永远 await（即使 cancel 已触发）确保 task 真正退出再返回 lifespan。
        with contextlib.suppress(asyncio.CancelledError):
            await task
        self._task = None
        self._stop_event = None
        _logger.info("deletion_sweep.stopped")

    async def trigger_now(self) -> int:
        """Run a single sweep synchronously（不影响 loop 调度）。供测试 / ops 接口使用。"""
        return await self._run_once_safely()

    # ─── internals ────────────────────────────────────────

    async def _run_loop(self) -> None:
        try:
            if not self._run_on_startup:
                # 首次延迟（防 startup 期间 DB / metrics 还没就绪）
                if await self._wait_or_stop(self._initial_delay):
                    return
            while True:
                await self._run_once_safely()
                if await self._wait_or_stop(self._interval):
                    return
        except asyncio.CancelledError:
            # stop() 调用 cancel()；让 await self._task 看到 CancelledError
            raise

    async def _run_once_safely(self) -> int:
        """Run sweep in a worker thread. Swallow + log all exceptions."""
        try:
            processed = await asyncio.to_thread(self._sweep_in_session)
            if processed:
                _logger.info("deletion_sweep.completed processed=%d", processed)
            else:
                _logger.debug("deletion_sweep.completed processed=0")
            return processed
        except Exception:
            # 必须吞 — 否则 _run_loop 退出，后续到期 job 永远不跑。worker 内部
            # 单 job 异常已经被 v2-#2 处理；这里抓的是 sweep 自身（DB 不可达 /
            # connection pool exhausted / 程序逻辑 bug）。
            _logger.exception("deletion_sweep.error")
            return 0

    def _sweep_in_session(self) -> int:
        """Sync wrapper: open session → sweep_fn → close. Runs in to_thread executor."""
        session = self._db.session_factory()
        try:
            return self._sweep_fn(session)
        finally:
            session.close()

    async def _wait_or_stop(self, seconds: float) -> bool:
        """Sleep `seconds` 秒，期间若 stop_event 被 set 立即返回 True。

        Returns:
            True  → stop() 被调用，调用方应退出 loop
            False → 正常 timeout，继续 loop
        """
        if seconds <= 0:
            # 0 秒 wait → 立即检查 stop_event 当前状态
            return self._stop_event is not None and self._stop_event.is_set()
        if self._stop_event is None:
            # 不应到达（start 已建 event），保守兜底
            await asyncio.sleep(seconds)
            return False
        try:
            await asyncio.wait_for(self._stop_event.wait(), timeout=seconds)
            return True  # event 被 set
        except asyncio.TimeoutError:
            return False  # 正常超时


def build_deletion_sweep_scheduler(
    db: DatabaseManager,
    *,
    enabled: bool,
    interval_seconds: float,
    initial_delay_seconds: float,
    run_on_startup: bool,
    sweep_fn: SweepFn | None = None,
) -> DeletionSweepScheduler | None:
    """Factory：enabled=False 返 None（lifespan 调用方据此短路）。

    把 enabled 检查放工厂层而不是 scheduler 内部，是为了让 scheduler 类
    在测试里能不带 Settings 直接构造 + 启动，简化单测。
    """
    if not enabled:
        _logger.info("deletion_sweep.disabled reason=settings_flag_off")
        return None
    return DeletionSweepScheduler(
        db,
        interval_seconds=interval_seconds,
        initial_delay_seconds=initial_delay_seconds,
        run_on_startup=run_on_startup,
        sweep_fn=sweep_fn,
    )
