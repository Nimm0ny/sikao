from __future__ import annotations

import inspect
import logging
import time
from dataclasses import dataclass

from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from sikao_api.core.config import Settings
from sikao_api.scheduler.jobs import register_home_scheduler_jobs
from sikao_api.scheduler.registry import HomeSchedulerContext, HomeSchedulerJob, HomeSchedulerRegistry

_logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class HomeSchedulerSnapshot:
    timezone: str
    run_on_startup: bool
    is_running: bool
    registered_job_ids: tuple[str, ...]
    scheduled_job_ids: tuple[str, ...]


class HomeScheduler:
    def __init__(
        self,
        *,
        context: HomeSchedulerContext,
        timezone: str,
        run_on_startup: bool,
        registry: HomeSchedulerRegistry,
    ) -> None:
        self._context = context
        self._timezone = timezone
        self._run_on_startup = run_on_startup
        self._registry = registry
        self._scheduler: AsyncIOScheduler | None = None

    @property
    def is_running(self) -> bool:
        return self._scheduler is not None

    def snapshot(self) -> HomeSchedulerSnapshot:
        scheduler = self._scheduler
        scheduled_job_ids = (
            tuple(job.id for job in scheduler.get_jobs()) if scheduler is not None else ()
        )
        return HomeSchedulerSnapshot(
            timezone=self._timezone,
            run_on_startup=self._run_on_startup,
            is_running=self.is_running,
            registered_job_ids=self._registry.job_ids,
            scheduled_job_ids=scheduled_job_ids,
        )

    async def start(self) -> None:
        if self.is_running:
            _logger.warning("home_scheduler.start_skipped reason=already_running")
            return

        scheduler = AsyncIOScheduler(
            timezone=self._timezone,
            jobstores={"default": MemoryJobStore()},
        )
        for job in self._registry.list_jobs():
            scheduler.add_job(
                self._execute_registered_job,
                trigger=job.trigger,
                id=job.job_id,
                name=job.name,
                kwargs={"job_id": job.job_id, "source": "schedule"},
                coalesce=job.coalesce,
                max_instances=job.max_instances,
                misfire_grace_time=job.misfire_grace_time,
            )

        scheduler.start()
        self._scheduler = scheduler
        _logger.info(
            "home_scheduler.started timezone=%s jobs=%d run_on_startup=%s jobstore=memory",
            self._timezone,
            len(self._registry),
            self._run_on_startup,
        )

        if self._run_on_startup and len(self._registry) > 0:
            try:
                await self._run_startup_jobs_once()
            except Exception:
                scheduler.shutdown(wait=False)
                self._scheduler = None
                raise

    async def stop(self) -> None:
        scheduler = self._scheduler
        if scheduler is None:
            return

        scheduler.shutdown(wait=False)
        self._scheduler = None
        _logger.info("home_scheduler.stopped")

    async def _run_startup_jobs_once(self) -> None:
        for job in self._registry.list_jobs():
            await self._execute_job(job, source="startup")

    async def _execute_registered_job(self, job_id: str, source: str) -> None:
        await self._execute_job(self._registry.get(job_id), source=source)

    async def _execute_job(self, job: HomeSchedulerJob, *, source: str) -> None:
        started_at = time.monotonic()
        _logger.info("home_scheduler.job_started job_id=%s source=%s", job.job_id, source)
        try:
            result = job.func(self._context)
            if inspect.isawaitable(result):
                await result
        except Exception:
            _logger.exception("home_scheduler.job_failed job_id=%s source=%s", job.job_id, source)
            raise
        duration_ms = int((time.monotonic() - started_at) * 1000)
        _logger.info(
            "home_scheduler.job_completed job_id=%s source=%s duration_ms=%d",
            job.job_id,
            source,
            duration_ms,
        )


def build_home_scheduler_registry(settings: Settings) -> HomeSchedulerRegistry:
    registry = HomeSchedulerRegistry()
    register_home_scheduler_jobs(registry, settings)
    return registry


def build_home_scheduler(
    *,
    context: HomeSchedulerContext,
    enabled: bool,
    timezone: str,
    run_on_startup: bool,
    registry: HomeSchedulerRegistry,
) -> HomeScheduler | None:
    if not enabled:
        _logger.info("home_scheduler.disabled reason=settings_flag_off")
        return None
    return HomeScheduler(
        context=context,
        timezone=timezone,
        run_on_startup=run_on_startup,
        registry=registry,
    )
