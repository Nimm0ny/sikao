from __future__ import annotations

from sikao_api.core.config import Settings
from sikao_api.scheduler.registry import HomeSchedulerRegistry
from sikao_api.scheduler.jobs.event_status_tick import build_event_status_tick_job
from sikao_api.scheduler.jobs.progress_snapshot import build_progress_snapshot_job


def register_home_scheduler_jobs(registry: HomeSchedulerRegistry, settings: Settings) -> None:
    registry.register(build_progress_snapshot_job(settings))
    registry.register(build_event_status_tick_job(settings))
