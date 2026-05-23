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
        jwt_secret="practice-cron-scheduler-secret",
        app_version="practice-cron-scheduler-test",
        git_sha="practice-cron-scheduler-sha",
        image_tag="practice-cron-scheduler-tag",
        build_time="2026-05-24T00:00:00Z",
        schema_version="practice-cron-scheduler-schema",
    )
    base.update(overrides)
    return Settings(**base)


class _RecordingRuntime:
    def __init__(self) -> None:
        self.question_accuracy_result = 0
        self.ai_cleanup_result = 0
        self.reference_quality_result: Any = {
            "updated_count": 0,
            "published_count": 0,
            "archived_count": 0,
        }

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

    async def run_question_accuracy_recompute(self) -> int:
        return self.question_accuracy_result

    async def run_ai_question_cleanup(self) -> int:
        return self.ai_cleanup_result

    async def run_reference_quality_recompute(self) -> Any:
        return self.reference_quality_result

    async def run_session_lifecycle_cleanup(self) -> dict[str, int]:
        return {"paused": 0, "abandoned": 0, "draft_abandoned": 0}

    async def run_daily_session_expire(self) -> int:
        return 0

    async def run_mock_exam_auto_submit(self) -> list[tuple[int, int]]:
        return []

    async def run_timing_baseline_recompute(self) -> int:
        return 0


def test_home_scheduler_registers_practice_b23_jobs(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    scheduler = HomeScheduler(
        cast(Any, object()),
        settings=settings,
        runtime=_RecordingRuntime(),
    )

    scheduler.schedule_recurring_jobs()
    jobs = {job.id: job for job in scheduler._scheduler.get_jobs()}

    assert "practice.question_accuracy.recompute" in jobs
    assert "practice.ai_questions.cleanup" in jobs
    assert "practice.reference_quality.recompute" in jobs
    assert str(jobs["practice.question_accuracy.recompute"].trigger.timezone) == "Asia/Shanghai"
    assert str(jobs["practice.question_accuracy.recompute"].trigger.fields[5]) == "4"
    assert str(jobs["practice.question_accuracy.recompute"].trigger.fields[6]) == "0"
    assert str(jobs["practice.ai_questions.cleanup"].trigger.timezone) == "Asia/Shanghai"
    assert str(jobs["practice.ai_questions.cleanup"].trigger.fields[5]) == "4"
    assert str(jobs["practice.ai_questions.cleanup"].trigger.fields[6]) == "30"
    assert str(jobs["practice.reference_quality.recompute"].trigger.timezone) == "Asia/Shanghai"
    assert str(jobs["practice.reference_quality.recompute"].trigger.fields[5]) == "5"
    assert str(jobs["practice.reference_quality.recompute"].trigger.fields[6]) == "0"


@pytest.mark.asyncio
async def test_home_scheduler_question_accuracy_job_calls_runtime(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    runtime = _RecordingRuntime()
    runtime.question_accuracy_result = 7
    scheduler = HomeScheduler(
        cast(Any, object()),
        settings=settings,
        runtime=runtime,
    )

    result = await scheduler._job_question_accuracy_recompute()

    assert result == 7


@pytest.mark.asyncio
async def test_home_scheduler_ai_cleanup_job_calls_runtime(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    runtime = _RecordingRuntime()
    runtime.ai_cleanup_result = 3
    scheduler = HomeScheduler(
        cast(Any, object()),
        settings=settings,
        runtime=runtime,
    )

    result = await scheduler._job_ai_question_cleanup()

    assert result == 3


@pytest.mark.asyncio
async def test_home_scheduler_reference_quality_job_calls_runtime(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    runtime = _RecordingRuntime()
    runtime.reference_quality_result = {
        "updated_count": 4,
        "published_count": 1,
        "archived_count": 2,
    }
    scheduler = HomeScheduler(
        cast(Any, object()),
        settings=settings,
        runtime=runtime,
    )

    result = await scheduler._job_reference_quality_recompute()

    assert result == {
        "updated_count": 4,
        "published_count": 1,
        "archived_count": 2,
    }
