"""PR-P6: hard-delete sweep scheduler tests.

Covers:
- Factory: enabled=False → None, enabled=True → DeletionSweepScheduler
- Constructor validation: bad interval / delay → ValueError
- Lifecycle: start / stop idempotent + cancel during sleep
- run_on_startup True: sweep fires immediately
- run_on_startup False: respects initial_delay
- Periodic: short interval triggers sweep multiple times
- Exception isolation: sweep_fn raises → loop continues
- Stop wakes from long sleep
- trigger_now: sync triggers + returns count
- Lifespan integration: enabled flag controls app.state.deletion_scheduler
- End-to-end with real worker against sqlite (smoke)
"""

from __future__ import annotations

import asyncio
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.core.scheduler import (
    DeletionSweepScheduler,
    build_deletion_sweep_scheduler,
)
from sikao_api.db.models_v2 import AccountDeletionJobV2, UserV2
from sikao_api.db.session import DatabaseManager


# ─── Fixtures ────────────────────────────────────────────────────────────────


def _make_settings(tmp_path: Path, **overrides: Any) -> Settings:
    """Test Settings — sqlite + reasonable defaults; overrides win."""
    base: dict[str, Any] = dict(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'sched.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="sched-test-secret",
        app_version="sched-test",
        git_sha="sched-sha",
        image_tag="sched-tag",
        build_time="2026-05-21T00:00:00Z",
        schema_version="sched-schema",
    )
    base.update(overrides)
    return Settings(**base)


def _make_db(settings: Settings) -> DatabaseManager:
    db = DatabaseManager(settings)
    db.create_all()
    return db


# ─── Factory ────────────────────────────────────────────────────────────────


def test_factory_returns_none_when_disabled(tmp_path: Path) -> None:
    db = _make_db(_make_settings(tmp_path))
    scheduler = build_deletion_sweep_scheduler(
        db,
        enabled=False,
        interval_seconds=10,
        initial_delay_seconds=0,
        run_on_startup=False,
    )
    assert scheduler is None


def test_factory_returns_scheduler_when_enabled(tmp_path: Path) -> None:
    db = _make_db(_make_settings(tmp_path))
    scheduler = build_deletion_sweep_scheduler(
        db,
        enabled=True,
        interval_seconds=10,
        initial_delay_seconds=0,
        run_on_startup=False,
    )
    assert isinstance(scheduler, DeletionSweepScheduler)
    assert scheduler.is_running is False  # 未 start


# ─── Constructor validation ─────────────────────────────────────────────────


def test_constructor_rejects_non_positive_interval(tmp_path: Path) -> None:
    db = _make_db(_make_settings(tmp_path))
    with pytest.raises(ValueError, match="interval_seconds"):
        DeletionSweepScheduler(
            db,
            interval_seconds=0,
            initial_delay_seconds=0,
            run_on_startup=False,
            sweep_fn=lambda _s: 0,
        )


def test_constructor_rejects_negative_initial_delay(tmp_path: Path) -> None:
    db = _make_db(_make_settings(tmp_path))
    with pytest.raises(ValueError, match="initial_delay_seconds"):
        DeletionSweepScheduler(
            db,
            interval_seconds=10,
            initial_delay_seconds=-1,
            run_on_startup=False,
            sweep_fn=lambda _s: 0,
        )


# ─── Lifecycle ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_start_stop_lifecycle_idempotent(tmp_path: Path) -> None:
    """start/stop 二次调用 no-op；stop 后 task 干净退出。"""
    db = _make_db(_make_settings(tmp_path))
    scheduler = DeletionSweepScheduler(
        db,
        interval_seconds=3600,  # 大间隔，确保 stop 必须从 sleep 唤醒
        initial_delay_seconds=3600,
        run_on_startup=False,
        sweep_fn=lambda _s: 0,
    )

    assert scheduler.is_running is False
    await scheduler.start()
    assert scheduler.is_running is True
    await scheduler.start()  # 二次 start no-op
    assert scheduler.is_running is True

    await scheduler.stop()
    assert scheduler.is_running is False
    await scheduler.stop()  # 二次 stop no-op


@pytest.mark.asyncio
async def test_stop_wakes_from_long_sleep_quickly(tmp_path: Path) -> None:
    """stop 用 stop_event 唤醒 wait_for, 不等 interval 跑满。"""
    db = _make_db(_make_settings(tmp_path))
    scheduler = DeletionSweepScheduler(
        db,
        interval_seconds=3600,
        initial_delay_seconds=3600,
        run_on_startup=False,
        sweep_fn=lambda _s: 0,
    )
    await scheduler.start()
    # 给 task 一点时间进入 _wait_or_stop
    await asyncio.sleep(0.05)

    t0 = time.monotonic()
    await scheduler.stop()
    elapsed = time.monotonic() - t0

    # 1s 阈值远低于 3600s interval，确认 stop 真正唤醒了 sleep
    assert elapsed < 1.0, f"stop took {elapsed:.2f}s, expected < 1s"


# ─── run_on_startup 行为 ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_run_on_startup_true_fires_immediately(tmp_path: Path) -> None:
    db = _make_db(_make_settings(tmp_path))
    fired = asyncio.Event()
    call_count = 0

    def sweep(_s: Session) -> int:
        nonlocal call_count
        call_count += 1
        fired.set()
        return 0

    scheduler = DeletionSweepScheduler(
        db,
        interval_seconds=3600,  # 跑一次后睡很久；只验首次
        initial_delay_seconds=3600,  # 应该被 run_on_startup=True 跳过
        run_on_startup=True,
        sweep_fn=sweep,
    )
    await scheduler.start()
    try:
        await asyncio.wait_for(fired.wait(), timeout=2.0)
    finally:
        await scheduler.stop()

    assert call_count == 1


@pytest.mark.asyncio
async def test_run_on_startup_false_respects_initial_delay(
    tmp_path: Path,
) -> None:
    db = _make_db(_make_settings(tmp_path))
    fired = asyncio.Event()

    def sweep(_s: Session) -> int:
        fired.set()
        return 0

    scheduler = DeletionSweepScheduler(
        db,
        interval_seconds=3600,
        initial_delay_seconds=2.0,  # 必须等满 2s
        run_on_startup=False,
        sweep_fn=sweep,
    )
    await scheduler.start()
    try:
        # 100ms 远小于 2s initial_delay → 不应触发
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(fired.wait(), timeout=0.1)
        assert fired.is_set() is False
    finally:
        await scheduler.stop()


# ─── 周期触发 ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_periodic_execution_triggers_multiple_sweeps(
    tmp_path: Path,
) -> None:
    """interval=0.05s, run_on_startup=True → 短时间内多次触发。"""
    db = _make_db(_make_settings(tmp_path))
    counter = {"n": 0}
    target = 3
    reached = asyncio.Event()

    def sweep(_s: Session) -> int:
        counter["n"] += 1
        if counter["n"] >= target:
            reached.set()
        return 0

    scheduler = DeletionSweepScheduler(
        db,
        interval_seconds=0.05,
        initial_delay_seconds=0,
        run_on_startup=True,
        sweep_fn=sweep,
    )
    await scheduler.start()
    try:
        await asyncio.wait_for(reached.wait(), timeout=3.0)
    finally:
        await scheduler.stop()

    assert counter["n"] >= target


# ─── 异常隔离 (Del-7) ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_sweep_exception_swallowed_loop_continues(
    tmp_path: Path,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """sweep_fn 抛 → scheduler 吞 + log error → 下次还跑。Del-7 回归。"""
    db = _make_db(_make_settings(tmp_path))
    counter = {"n": 0}
    succeeded_after_failure = asyncio.Event()

    def flaky_sweep(_s: Session) -> int:
        counter["n"] += 1
        if counter["n"] == 1:
            raise RuntimeError("simulated worker explosion")
        succeeded_after_failure.set()
        return 1

    scheduler = DeletionSweepScheduler(
        db,
        interval_seconds=0.05,
        initial_delay_seconds=0,
        run_on_startup=True,
        sweep_fn=flaky_sweep,
    )

    import logging

    with caplog.at_level(logging.ERROR, logger="sikao_api.core.scheduler"):
        await scheduler.start()
        try:
            await asyncio.wait_for(succeeded_after_failure.wait(), timeout=3.0)
        finally:
            await scheduler.stop()

    assert counter["n"] >= 2
    # 异常被 log 记录而非冒到 loop
    assert any(
        "deletion_sweep.error" in r.message and r.levelname == "ERROR"
        for r in caplog.records
    )


# ─── trigger_now ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_trigger_now_returns_sweep_count(tmp_path: Path) -> None:
    db = _make_db(_make_settings(tmp_path))
    scheduler = DeletionSweepScheduler(
        db,
        interval_seconds=3600,
        initial_delay_seconds=3600,
        run_on_startup=False,
        sweep_fn=lambda _s: 7,
    )
    # 不需 start：trigger_now 是独立路径
    result = await scheduler.trigger_now()
    assert result == 7


@pytest.mark.asyncio
async def test_trigger_now_swallows_exception(tmp_path: Path) -> None:
    """trigger_now 跟 _run_loop 用同一安全包装，异常应被吞返回 0。"""
    db = _make_db(_make_settings(tmp_path))

    def boom(_s: Session) -> int:
        raise RuntimeError("manual trigger failure")

    scheduler = DeletionSweepScheduler(
        db,
        interval_seconds=3600,
        initial_delay_seconds=3600,
        run_on_startup=False,
        sweep_fn=boom,
    )
    result = await scheduler.trigger_now()
    assert result == 0


# ─── 端到端: scheduler + 真实 deletion_worker ──────────────────────────────


@pytest.mark.asyncio
async def test_scheduler_processes_real_due_job(tmp_path: Path) -> None:
    """run_on_startup=True + 真 worker → 已到期 job 被 hard-delete。

    冒烟整条链路: scheduler.to_thread → run_hard_delete_sweep → user 删除
    + job 标 completed (FK SET NULL 保留审计). 间接覆盖 v2-#1 + v2-#2 仍工作.
    """
    db = _make_db(_make_settings(tmp_path))

    # Seed: 一个已到期 pending job
    session = db.session_factory()
    try:
        user = UserV2(display_name="ToDelete")
        session.add(user)
        session.flush()
        now = datetime.now(UTC).replace(tzinfo=None)
        user.deleted_at = now - timedelta(days=8)
        user.is_active = False
        job = AccountDeletionJobV2(
            user_id=user.id,
            user_public_id=user.public_id,
            requested_at=now - timedelta(days=8),
            hard_delete_at=now - timedelta(hours=1),
            status="pending",
            reason="other",
        )
        session.add(job)
        session.commit()
        user_id = user.id
        job_id = job.id
        public_id = user.public_id
    finally:
        session.close()

    # Real factory - no sweep_fn override
    scheduler = build_deletion_sweep_scheduler(
        db,
        enabled=True,
        interval_seconds=3600,
        initial_delay_seconds=0,
        run_on_startup=True,
    )
    assert scheduler is not None

    await scheduler.start()
    try:
        # 等 worker 执行完毕 — 给到 1.5s 余量 (to_thread + sqlite + 提交).
        deadline = time.monotonic() + 1.5
        while time.monotonic() < deadline:
            verify = db.session_factory()
            try:
                surviving = verify.get(AccountDeletionJobV2, job_id)
                if surviving is not None and surviving.status == "completed":
                    break
            finally:
                verify.close()
            await asyncio.sleep(0.05)
    finally:
        await scheduler.stop()

    # 验证最终态: user 删 + job 保留为审计
    verify = db.session_factory()
    try:
        assert verify.get(UserV2, user_id) is None
        surviving = verify.get(AccountDeletionJobV2, job_id)
        assert surviving is not None
        assert surviving.status == "completed"
        assert surviving.user_id is None  # FK SET NULL
        assert surviving.user_public_id == public_id
    finally:
        verify.close()


# ─── Lifespan 接入 ──────────────────────────────────────────────────────────


def test_lifespan_default_disabled_no_scheduler(tmp_path: Path) -> None:
    """默认 deletion_sweep_enabled=False → app.state.deletion_scheduler is None.

    pytest 默认行为，确保已有 14 个 Profile 测试不会因 scheduler 启动而抖动.
    """
    from fastapi.testclient import TestClient

    from sikao_api.main import create_app

    settings = _make_settings(tmp_path)
    app = create_app(settings=settings)
    with TestClient(app):
        assert app.state.deletion_scheduler is None


def test_lifespan_enabled_starts_and_stops_scheduler(tmp_path: Path) -> None:
    """deletion_sweep_enabled=True → lifespan 启动 scheduler，shutdown 干净 stop."""
    from fastapi.testclient import TestClient

    from sikao_api.main import create_app

    settings = _make_settings(
        tmp_path,
        deletion_sweep_enabled=True,
        deletion_sweep_interval_seconds=3600,
        deletion_sweep_initial_delay_seconds=3600,  # 不让真触发
        deletion_sweep_run_on_startup=False,
    )
    app = create_app(settings=settings)
    with TestClient(app):
        scheduler = app.state.deletion_scheduler
        assert scheduler is not None
        assert scheduler.is_running is True

    # TestClient context 退出后 lifespan shutdown 已跑
    assert scheduler.is_running is False
