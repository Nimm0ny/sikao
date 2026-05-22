from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

import pytest
from apscheduler.triggers.interval import IntervalTrigger

from sikao_api.core.config import Settings
from sikao_api.db.session import DatabaseManager
from sikao_api.scheduler import (
    HomeScheduler,
    HomeSchedulerContext,
    HomeSchedulerJob,
    HomeSchedulerRegistry,
    build_home_scheduler,
    build_home_scheduler_registry,
)

EXPECTED_JOB_IDS = (
    "home.progress_snapshot",
    "home.event_status_tick",
    "home.plan_adjustor_daily",
    "home.cleanup_expired",
    "home.cleanup_soft_deleted",
)


def _make_settings(tmp_path: Path, **overrides: Any) -> Settings:
    base: dict[str, Any] = dict(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'home-scheduler.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="home-scheduler-secret",
        app_version="home-scheduler-test",
        git_sha="home-scheduler-sha",
        image_tag="home-scheduler-tag",
        build_time="2026-05-22T00:00:00Z",
        schema_version="home-scheduler-schema",
    )
    base.update(overrides)
    return Settings(**base)


def _make_db(settings: Settings) -> DatabaseManager:
    db = DatabaseManager(settings)
    db.create_all()
    return db


def _make_context(tmp_path: Path, **overrides: Any) -> HomeSchedulerContext:
    settings = _make_settings(tmp_path, **overrides)
    return HomeSchedulerContext(settings=settings, db=_make_db(settings))


def _make_minimal_registry(
    *, fired: asyncio.Event | None = None, contexts: list[HomeSchedulerContext] | None = None
) -> HomeSchedulerRegistry:
    registry = HomeSchedulerRegistry()

    async def sample_job(context: HomeSchedulerContext) -> None:
        if contexts is not None:
            contexts.append(context)
        if fired is not None:
            fired.set()

    registry.register(
        HomeSchedulerJob(
            job_id="home.sample",
            name="home.sample",
            trigger=IntervalTrigger(hours=1, timezone="UTC"),
            func=sample_job,
        )
    )
    return registry


def test_default_registry_registers_home_jobs(tmp_path: Path) -> None:
    registry = build_home_scheduler_registry(_make_settings(tmp_path))
    assert registry.job_ids == EXPECTED_JOB_IDS
    assert len(registry) == len(EXPECTED_JOB_IDS)


def test_factory_returns_none_when_disabled(tmp_path: Path) -> None:
    scheduler = build_home_scheduler(
        context=_make_context(tmp_path),
        enabled=False,
        timezone="Asia/Shanghai",
        run_on_startup=False,
        registry=HomeSchedulerRegistry(),
    )
    assert scheduler is None


def test_factory_returns_scheduler_when_enabled(tmp_path: Path) -> None:
    scheduler = build_home_scheduler(
        context=_make_context(tmp_path),
        enabled=True,
        timezone="Asia/Shanghai",
        run_on_startup=False,
        registry=HomeSchedulerRegistry(),
    )
    assert isinstance(scheduler, HomeScheduler)
    assert scheduler.is_running is False


@pytest.mark.asyncio
async def test_empty_registry_lifecycle_is_idempotent(tmp_path: Path) -> None:
    context = _make_context(tmp_path)
    scheduler = HomeScheduler(
        context=context,
        timezone="Asia/Shanghai",
        run_on_startup=False,
        registry=HomeSchedulerRegistry(),
    )

    await scheduler.start()
    await scheduler.start()
    running_snapshot = scheduler.snapshot()
    assert running_snapshot.is_running is True
    assert running_snapshot.scheduled_job_ids == ()
    assert running_snapshot.registered_job_ids == ()

    await scheduler.stop()
    await scheduler.stop()
    stopped_snapshot = scheduler.snapshot()
    assert stopped_snapshot.is_running is False
    assert stopped_snapshot.scheduled_job_ids == ()


@pytest.mark.asyncio
async def test_run_on_startup_executes_registered_job_once(tmp_path: Path) -> None:
    fired = asyncio.Event()
    contexts: list[HomeSchedulerContext] = []
    context = _make_context(tmp_path)
    scheduler = HomeScheduler(
        context=context,
        timezone="Asia/Shanghai",
        run_on_startup=True,
        registry=_make_minimal_registry(fired=fired, contexts=contexts),
    )

    await scheduler.start()
    try:
        await asyncio.wait_for(fired.wait(), timeout=2.0)
        snapshot = scheduler.snapshot()
        assert snapshot.registered_job_ids == ("home.sample",)
        assert snapshot.scheduled_job_ids == ("home.sample",)
        assert contexts == [context]
    finally:
        await scheduler.stop()


@pytest.mark.asyncio
async def test_run_on_startup_false_does_not_execute_immediately(tmp_path: Path) -> None:
    context = _make_context(tmp_path)
    fired = asyncio.Event()
    scheduler = HomeScheduler(
        context=context,
        timezone="Asia/Shanghai",
        run_on_startup=False,
        registry=_make_minimal_registry(fired=fired),
    )

    await scheduler.start()
    try:
        await asyncio.sleep(0.1)
        assert fired.is_set() is False
        assert scheduler.snapshot().scheduled_job_ids == ("home.sample",)
    finally:
        await scheduler.stop()


def test_lifespan_default_disabled_no_home_scheduler(tmp_path: Path) -> None:
    from fastapi.testclient import TestClient

    from sikao_api.main import create_app

    settings = _make_settings(tmp_path)
    app = create_app(settings=settings)

    with TestClient(app):
        assert app.state.home_scheduler is None
        assert app.state.home_scheduler_registry.job_ids == EXPECTED_JOB_IDS


def test_lifespan_enabled_starts_and_stops_home_scheduler(tmp_path: Path) -> None:
    from fastapi.testclient import TestClient

    from sikao_api.main import create_app

    settings = _make_settings(
        tmp_path,
        home_scheduler_enabled=True,
        home_scheduler_run_on_startup=False,
    )
    app = create_app(settings=settings)

    with TestClient(app):
        scheduler = app.state.home_scheduler
        assert scheduler is not None
        assert scheduler.is_running is True
        assert scheduler.snapshot().registered_job_ids == EXPECTED_JOB_IDS
        assert set(scheduler.snapshot().scheduled_job_ids) == set(EXPECTED_JOB_IDS)

    assert scheduler.is_running is False


@pytest.mark.asyncio
async def test_run_on_startup_failure_is_fail_fast_and_stop_stays_safe(tmp_path: Path) -> None:
    context = _make_context(tmp_path)
    registry = HomeSchedulerRegistry()

    async def failing_job(_context: HomeSchedulerContext) -> None:
        raise RuntimeError("boom")

    registry.register(
        HomeSchedulerJob(
            job_id="home.fail",
            name="home.fail",
            trigger=IntervalTrigger(hours=1, timezone="UTC"),
            func=failing_job,
        )
    )
    scheduler = HomeScheduler(
        context=context,
        timezone="Asia/Shanghai",
        run_on_startup=True,
        registry=registry,
    )

    with pytest.raises(RuntimeError, match="boom"):
        await scheduler.start()
    assert scheduler.is_running is False

    await scheduler.stop()
