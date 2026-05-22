from __future__ import annotations

from sikao_api.core.config import Settings
from sikao_api.scheduler.registry import HomeSchedulerRegistry


def register_home_scheduler_jobs(registry: HomeSchedulerRegistry, settings: Settings) -> None:
    _ = registry
    _ = settings
    return None
