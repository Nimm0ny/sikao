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
        jwt_secret="review-debt-scheduler-secret",
        app_version="review-debt-scheduler-test",
        git_sha="review-debt-scheduler-sha",
        image_tag="review-debt-scheduler-tag",
        build_time="2026-05-25T00:00:00Z",
        schema_version="review-debt-scheduler-schema",
    )
    base.update(overrides)
    return Settings(**base)


class _RecordingRuntime:
    async def run_daily_progress_snapshot(self) -> int:
        return 0

    async def run_weekly_weakness_snapshot(self) -> int:
        return 0

    async def run_review_weekly_summary_snapshot(self) -> int:
        return 0

    async def run_review_debt_severity_evaluator(self) -> int:
        return 12

    async def run_review_hard_question_detector(self) -> int:
        return 8

    async def run_review_rampup_phase_advancer(self) -> int:
        return 15

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


def test_home_scheduler_registers_review_debt_jobs(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    scheduler = HomeScheduler(cast(Any, object()), settings=settings, runtime=_RecordingRuntime())

    scheduler.schedule_recurring_jobs()
    jobs = {job.id: job for job in scheduler._scheduler.get_jobs()}

    assert "review.rampup.phase_advancer" in jobs
    assert "review.debt.severity_evaluator" in jobs
    assert "review.hard_question.detector" in jobs


@pytest.mark.asyncio
async def test_home_scheduler_review_debt_jobs_call_runtime(tmp_path: Path) -> None:
    settings = _make_settings(tmp_path)
    scheduler = HomeScheduler(cast(Any, object()), settings=settings, runtime=_RecordingRuntime())

    assert await scheduler._job_review_rampup_phase_advancer() == 15
    assert await scheduler._job_review_debt_severity_evaluator() == 12
    assert await scheduler._job_review_hard_question_detector() == 8
