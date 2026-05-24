from __future__ import annotations

from pathlib import Path
from typing import Any, cast

import pytest

from sikao_api.core.config import Settings
from sikao_api.core.home_scheduler import HomeScheduler


def _make_settings(tmp_path: Path, **overrides: Any) -> Settings:
    base: dict[str, Any] = dict(
        app_env="test",
        home_scheduler_enabled=True,
        llm_provider="mock",
        database_url="postgresql+psycopg://postgres@127.0.0.1:15433/postgres",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="review-cron-scheduler-secret",
        app_version="review-cron-scheduler-test",
        git_sha="review-cron-scheduler-sha",
        image_tag="review-cron-scheduler-tag",
        build_time="2026-05-24T00:00:00Z",
        schema_version="review-cron-scheduler-schema",
    )
    base.update(overrides)
    return Settings(**base)


class _RecordingRuntime:
    def __init__(self) -> None:
        self.review_weekly_summary_result = 0

    async def run_daily_progress_snapshot(self) -> int:
        return 0

    async def run_weekly_weakness_snapshot(self) -> int:
        return 0

    async def run_review_weekly_summary_snapshot(self) -> int:
        return self.review_weekly_summary_result

    async def run_event_status_tick(self) -> list[Any]:
        return []

    async def run_cleanup_expired(self) -> dict[str, int]:
        return {"adjustments": 0, "recommendations": 0}

    async def run_cleanup_soft_deleted_events(self) -> int:
        return 0

    async def run_daily_plan_adjust(self) -> int:
        return 0

    async def run_question_accuracy_recompute(self) -> int:
        return 0

    async def run_ai_question_cleanup(self) -> int:
        return 0

    async def run_reference_quality_recompute(self) -> Any:
        return {}

    async def run_daily_practice_generate(self) -> Any:
        return {}

    async def run_session_lifecycle_cleanup(self) -> dict[str, int]:
        return {"paused": 0, "abandoned": 0, "draft_abandoned": 0}

    async def run_daily_session_expire(self) -> int:
        return 0

    async def run_mock_exam_auto_submit(self) -> list[tuple[int, int]]:
        return []

    async def run_timing_baseline_recompute(self) -> int:
        return 0


def test_home_scheduler_registers_review_weekly_snapshot_job(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    scheduler = HomeScheduler(
        cast(Any, object()),
        settings=settings,
        runtime=_RecordingRuntime(),
    )

    scheduler.schedule_recurring_jobs()
    jobs = {job.id: job for job in scheduler._scheduler.get_jobs()}

    assert "review.weekly_summary.snapshot" in jobs
    assert str(jobs["review.weekly_summary.snapshot"].trigger.timezone) == "Asia/Shanghai"
    assert str(jobs["review.weekly_summary.snapshot"].trigger.fields[4]) == "mon"
    assert str(jobs["review.weekly_summary.snapshot"].trigger.fields[5]) == "2"
    assert str(jobs["review.weekly_summary.snapshot"].trigger.fields[6]) == "0"


@pytest.mark.asyncio
async def test_home_scheduler_review_weekly_snapshot_job_calls_runtime(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    runtime = _RecordingRuntime()
    runtime.review_weekly_summary_result = 6
    scheduler = HomeScheduler(
        cast(Any, object()),
        settings=settings,
        runtime=runtime,
    )

    result = await scheduler._job_review_weekly_summary_snapshot()

    assert result == 6

