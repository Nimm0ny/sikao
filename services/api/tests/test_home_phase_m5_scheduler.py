from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from sikao_api.core.config import Settings
from sikao_api.core.home_scheduler import HomeScheduler, build_home_scheduler
from sikao_api.db.session import DatabaseManager
from sikao_api.main import create_app


def _make_settings(tmp_path: Path, **overrides: Any) -> Settings:
    base: dict[str, Any] = dict(
        app_env="test",
        home_scheduler_enabled=True,
        llm_provider="mock",
        database_url=f"sqlite:///{(tmp_path / 'home-m5-scheduler.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="home-m5-scheduler-secret",
        app_version="home-m5-scheduler-test",
        git_sha="home-m5-scheduler-sha",
        image_tag="home-m5-scheduler-tag",
        build_time="2026-05-22T00:00:00Z",
        schema_version="home-m5-scheduler-schema",
    )
    base.update(overrides)
    return Settings(**base)


def _make_db(settings: Settings) -> DatabaseManager:
    db = DatabaseManager(settings)
    db.create_all()
    return db


class _RecordingRuntime:
    def __init__(self) -> None:
        self.login_called = asyncio.Event()
        self.raise_login = False
        self.calls: list[tuple[str, int, str | None]] = []
        self.mock_exam_auto_submit_payloads: list[tuple[int, int]] = []

    async def run_daily_progress_snapshot(self) -> int:
        return 0

    async def run_weekly_weakness_snapshot(self) -> int:
        return 0

    async def run_event_status_tick(self) -> list[Any]:
        return []

    async def run_cleanup_expired(self) -> dict[str, int]:
        return {"adjustments": 0, "recommendations": 0}

    async def run_cleanup_soft_deleted_events(self) -> int:
        return 0

    async def run_daily_plan_adjust(self) -> int:
        return 0

    async def run_session_lifecycle_cleanup(self) -> dict[str, int]:
        return {"paused": 0, "abandoned": 0, "draft_abandoned": 0}

    async def run_daily_session_expire(self) -> int:
        return 0

    async def run_mock_exam_auto_submit(self) -> list[tuple[int, int]]:
        return list(self.mock_exam_auto_submit_payloads)

    async def run_login_adjustment_check(self, *, user_id: int, request_id: str | None) -> bool:
        self.calls.append(("login", user_id, request_id))
        self.login_called.set()
        if self.raise_login:
            raise RuntimeError("boom")
        return True

    async def run_submit_progress_hooks(self, *, user_id: int, session_id: int | None) -> None:
        del user_id, session_id

    async def run_skipped_adjustment_check(
        self,
        *,
        user_id: int,
        plan_id: int,
        event_id: int,
        occurrence_ref: str | None,
        request_id: str | None,
    ) -> bool:
        del plan_id, event_id, occurrence_ref
        self.calls.append(("skipped", user_id, request_id))
        return True

    async def run_submit_recommender_refresh(
        self,
        *,
        user_id: int,
        session_id: int,
        request_id: str | None,
    ) -> bool:
        self.calls.append(("submit", user_id, request_id))
        return True


def test_build_home_scheduler_returns_none_when_disabled(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path, home_scheduler_enabled=False)
    db = _make_db(settings)
    scheduler = build_home_scheduler(db, settings=settings)
    assert scheduler is None


@pytest.mark.asyncio
async def test_home_scheduler_one_shot_enqueue_executes_runtime(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    db = _make_db(settings)
    runtime = _RecordingRuntime()
    scheduler = HomeScheduler(db, settings=settings, runtime=runtime)

    await scheduler.start()
    try:
        assert scheduler.is_running is True
        assert scheduler.enqueue_login_adjustment_check(user_id=42, request_id="req-1") is True
        await asyncio.wait_for(runtime.login_called.wait(), timeout=2.0)
        await asyncio.sleep(0.1)
    finally:
        await scheduler.stop()

    assert ("login", 42, "req-1") in runtime.calls
    assert scheduler.stats.succeeded >= 1
    assert scheduler.stats.failed == 0


@pytest.mark.asyncio
async def test_home_scheduler_failure_records_stats(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    db = _make_db(settings)
    runtime = _RecordingRuntime()
    runtime.raise_login = True
    scheduler = HomeScheduler(db, settings=settings, runtime=runtime)

    await scheduler.start()
    try:
        assert scheduler.enqueue_login_adjustment_check(user_id=7, request_id="req-fail") is True
        await asyncio.wait_for(runtime.login_called.wait(), timeout=2.0)
        await asyncio.sleep(0.2)
    finally:
        await scheduler.stop()

    assert scheduler.stats.failed >= 1
    assert any(item["status"] == "failed" for item in scheduler.stats.recent_events)


def test_create_app_lifespan_starts_home_scheduler(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app):
        scheduler = app.state.home_scheduler
        assert scheduler is not None
        assert scheduler.is_running is True
    assert scheduler.is_running is False


def test_home_scheduler_registers_mock_exam_auto_submit_job(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    db = _make_db(settings)
    scheduler = HomeScheduler(db, settings=settings, runtime=_RecordingRuntime())

    scheduler.schedule_recurring_jobs()
    job_ids = {job.id for job in scheduler._scheduler.get_jobs()}
    assert "home.mock_exam.auto_submit" in job_ids


@pytest.mark.asyncio
async def test_mock_exam_auto_submit_job_enqueues_recommender_refresh(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    db = _make_db(settings)
    runtime = _RecordingRuntime()
    runtime.mock_exam_auto_submit_payloads = [(9, 42)]
    scheduler = HomeScheduler(db, settings=settings, runtime=runtime)
    recorded: list[tuple[int, int, str | None]] = []

    def _record_enqueue(*, user_id: int, session_id: int, request_id: str | None) -> bool:
        recorded.append((user_id, session_id, request_id))
        return True

    scheduler.enqueue_submit_recommender_refresh = _record_enqueue  # type: ignore[method-assign]

    result = await scheduler._job_mock_exam_auto_submit()

    assert result == 1
    assert recorded == [(9, 42, None)]
