from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED, JobExecutionEvent  # type: ignore[import-untyped]
from apscheduler.schedulers.asyncio import AsyncIOScheduler  # type: ignore[import-untyped]
from apscheduler.triggers.cron import CronTrigger  # type: ignore[import-untyped]
from apscheduler.triggers.date import DateTrigger  # type: ignore[import-untyped]
from opentelemetry import metrics

from sikao_api.core.config import Settings
from sikao_api.db.session import DatabaseManager
from sikao_api.modules.system.application.home_runtime import HomeRuntimeOrchestrator

_logger = logging.getLogger(__name__)
_meter = metrics.get_meter("sikao_api.home_scheduler")
_job_success_counter = _meter.create_counter(
    "home_scheduler_jobs_succeeded_total",
    description="Successful Home scheduler jobs",
)
_job_failure_counter = _meter.create_counter(
    "home_scheduler_jobs_failed_total",
    description="Failed Home scheduler jobs",
)
_job_duration_histogram = _meter.create_histogram(
    "home_scheduler_job_duration_ms",
    unit="ms",
    description="Home scheduler job duration",
)


@dataclass
class HomeSchedulerStats:
    succeeded: int = 0
    failed: int = 0
    recent_events: list[dict[str, Any]] = field(default_factory=list)

    def record(self, payload: dict[str, Any]) -> None:
        if payload["status"] == "success":
            self.succeeded += 1
        else:
            self.failed += 1
        self.recent_events.append(payload)
        if len(self.recent_events) > 50:
            self.recent_events = self.recent_events[-50:]


class HomeScheduler:
    def __init__(
        self,
        db: DatabaseManager,
        *,
        settings: Settings,
        runtime: HomeRuntimeOrchestrator | Any | None = None,
    ) -> None:
        self._db = db
        self._settings = settings
        self._runtime = runtime or HomeRuntimeOrchestrator(db, settings)
        self._scheduler = AsyncIOScheduler(timezone=settings.home_scheduler_timezone)
        self._scheduler.add_listener(
            self._handle_job_event,
            EVENT_JOB_EXECUTED | EVENT_JOB_ERROR,
        )
        self._scheduled = False
        self._loop: asyncio.AbstractEventLoop | None = None
        self._started_at: dict[str, float] = {}
        self.stats = HomeSchedulerStats()

    @property
    def is_running(self) -> bool:
        return bool(self._scheduler.running)

    async def start(self) -> None:
        if self.is_running:
            _logger.warning("home_scheduler.start_skipped reason=already_running")
            return
        self._loop = asyncio.get_running_loop()
        self.schedule_recurring_jobs()
        self._scheduler.start()
        _logger.info(
            "home_scheduler.started timezone=%s",
            self._settings.home_scheduler_timezone,
        )

    async def stop(self) -> None:
        if not self.is_running:
            return
        self._scheduler.shutdown(wait=False)
        self._loop = None
        self._started_at.clear()
        _logger.info("home_scheduler.stopped")

    def schedule_recurring_jobs(self) -> None:
        if self._scheduled:
            return
        self._scheduler.add_job(
            self._job_daily_progress_snapshot,
            trigger=CronTrigger(hour=0, minute=30, timezone=self._settings.home_scheduler_timezone),
            id="home.progress_snapshot.daily",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        self._scheduler.add_job(
            self._job_weekly_weakness_snapshot,
            trigger=CronTrigger(day_of_week="mon", hour=1, minute=0, timezone=self._settings.home_scheduler_timezone),
            id="home.weakness_snapshot.weekly",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        self._scheduler.add_job(
            self._job_event_status_tick,
            trigger=CronTrigger(minute="*/15", timezone=self._settings.home_scheduler_timezone),
            id="home.event_status.tick",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        self._scheduler.add_job(
            self._job_cleanup_expired,
            trigger=CronTrigger(hour=2, minute=0, timezone=self._settings.home_scheduler_timezone),
            id="home.cleanup.expired",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        self._scheduler.add_job(
            self._job_cleanup_soft_deleted_events,
            trigger=CronTrigger(hour=3, minute=0, timezone=self._settings.home_scheduler_timezone),
            id="home.cleanup.soft_deleted_events",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        self._scheduler.add_job(
            self._job_daily_plan_adjust,
            trigger=CronTrigger(hour=6, minute=0, timezone=self._settings.home_scheduler_timezone),
            id="home.plan_adjust.daily",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        self._scheduled = True

    def enqueue_login_adjustment_check(self, *, user_id: int, request_id: str | None) -> bool:
        return self._enqueue_one_shot(
            job_id=f"home.hook.login_adjustment:{uuid4().hex}",
            func=self._job_login_adjustment_check,
            kwargs={"user_id": user_id, "request_id": request_id},
        )

    def enqueue_submit_recommender_refresh(
        self,
        *,
        user_id: int,
        session_id: int,
        request_id: str | None,
    ) -> bool:
        return self._enqueue_one_shot(
            job_id=f"home.hook.submit_recommender_refresh:{uuid4().hex}",
            func=self._job_submit_recommender_refresh,
            kwargs={
                "user_id": user_id,
                "session_id": session_id,
                "request_id": request_id,
            },
        )

    def enqueue_submit_progress_refresh(self, *, user_id: int, request_id: str | None) -> bool:
        return self._enqueue_one_shot(
            job_id=f"home.hook.submit_progress_refresh:{uuid4().hex}",
            func=self._job_submit_progress_refresh,
            kwargs={"user_id": user_id, "request_id": request_id},
        )

    def enqueue_event_skipped_adjustment_check(
        self,
        *,
        user_id: int,
        plan_id: int,
        event_id: int,
        occurrence_ref: str | None,
        request_id: str | None,
    ) -> bool:
        return self._enqueue_one_shot(
            job_id=f"home.hook.skipped_adjustment:{uuid4().hex}",
            func=self._job_skipped_adjustment_check,
            kwargs={
                "user_id": user_id,
                "plan_id": plan_id,
                "event_id": event_id,
                "occurrence_ref": occurrence_ref,
                "request_id": request_id,
            },
        )

    async def _job_daily_progress_snapshot(self) -> int:
        job_id = "home.progress_snapshot.daily"
        self._mark_started(job_id)
        return await self._runtime.run_daily_progress_snapshot()

    async def _job_weekly_weakness_snapshot(self) -> int:
        job_id = "home.weakness_snapshot.weekly"
        self._mark_started(job_id)
        return await self._runtime.run_weekly_weakness_snapshot()

    async def _job_event_status_tick(self) -> int:
        job_id = "home.event_status.tick"
        self._mark_started(job_id)
        skipped = await self._runtime.run_event_status_tick()
        for item in skipped:
            self.enqueue_event_skipped_adjustment_check(
                user_id=item.user_id,
                plan_id=item.plan_id,
                event_id=item.event_id,
                occurrence_ref=item.occurrence_ref,
                request_id=None,
            )
        return len(skipped)

    async def _job_cleanup_expired(self) -> dict[str, int]:
        job_id = "home.cleanup.expired"
        self._mark_started(job_id)
        return await self._runtime.run_cleanup_expired()

    async def _job_cleanup_soft_deleted_events(self) -> int:
        job_id = "home.cleanup.soft_deleted_events"
        self._mark_started(job_id)
        return await self._runtime.run_cleanup_soft_deleted_events()

    async def _job_daily_plan_adjust(self) -> int:
        job_id = "home.plan_adjust.daily"
        self._mark_started(job_id)
        return await self._runtime.run_daily_plan_adjust()

    async def _job_login_adjustment_check(
        self,
        *,
        user_id: int,
        request_id: str | None,
        scheduled_job_id: str | None = None,
    ) -> bool:
        job_id = scheduled_job_id or f"home.hook.login_adjustment:{user_id}"
        self._mark_started(job_id)
        return await self._runtime.run_login_adjustment_check(
            user_id=user_id,
            request_id=request_id,
        )

    async def _job_submit_recommender_refresh(
        self,
        *,
        user_id: int,
        session_id: int,
        request_id: str | None,
        scheduled_job_id: str | None = None,
    ) -> bool:
        job_id = scheduled_job_id or f"home.hook.submit_recommender_refresh:{session_id}"
        self._mark_started(job_id)
        return await self._runtime.run_submit_recommender_refresh(
            user_id=user_id,
            session_id=session_id,
            request_id=request_id,
        )

    async def _job_submit_progress_refresh(
        self,
        *,
        user_id: int,
        request_id: str | None,
        scheduled_job_id: str | None = None,
    ) -> None:
        del request_id
        job_id = scheduled_job_id or f"home.hook.submit_progress_refresh:{user_id}"
        self._mark_started(job_id)
        await self._runtime.run_submit_progress_hooks(user_id=user_id)

    async def _job_skipped_adjustment_check(
        self,
        *,
        user_id: int,
        plan_id: int,
        event_id: int,
        occurrence_ref: str | None,
        request_id: str | None,
        scheduled_job_id: str | None = None,
    ) -> bool:
        job_id = scheduled_job_id or f"home.hook.skipped_adjustment:{event_id}"
        self._mark_started(job_id)
        return await self._runtime.run_skipped_adjustment_check(
            user_id=user_id,
            plan_id=plan_id,
            event_id=event_id,
            occurrence_ref=occurrence_ref,
            request_id=request_id,
        )

    def _enqueue_one_shot(
        self,
        *,
        job_id: str,
        func,
        kwargs: dict[str, Any],
    ) -> bool:
        if not self.is_running or self._loop is None:
            _logger.warning("home_scheduler.enqueue_skipped job_id=%s reason=not_running", job_id)
            return False

        def add_job() -> None:
            try:
                self._scheduler.add_job(
                    func,
                    trigger=DateTrigger(run_date=datetime.now(UTC)),
                    id=job_id,
                    replace_existing=False,
                    kwargs={**kwargs, "scheduled_job_id": job_id},
                    misfire_grace_time=30,
                )
            except Exception:
                _logger.exception("home_scheduler.enqueue_failed job_id=%s", job_id)

        self._loop.call_soon_threadsafe(add_job)
        return True

    def _mark_started(self, job_id: str) -> None:
        self._started_at[job_id] = time.monotonic()
        _logger.info("home_scheduler.job_started job_id=%s", job_id)

    def _handle_job_event(self, event: JobExecutionEvent) -> None:
        job_id = event.job_id
        started_at = self._started_at.pop(job_id, None)
        duration_ms = int((time.monotonic() - started_at) * 1000) if started_at is not None else None
        job_name = job_id.split(":", 1)[0]
        if event.exception is None:
            payload = {
                "job_id": job_id,
                "job_name": job_name,
                "status": "success",
                "duration_ms": duration_ms,
            }
            self.stats.record(payload)
            _logger.info(
                "home_scheduler.job_succeeded job_id=%s duration_ms=%s",
                job_id,
                duration_ms,
            )
            self._record_metrics(job_name=job_name, success=True, duration_ms=duration_ms)
            return
        payload = {
            "job_id": job_id,
            "job_name": job_name,
            "status": "failed",
            "duration_ms": duration_ms,
            "error": str(event.exception),
        }
        self.stats.record(payload)
        _logger.error(
            "home_scheduler.job_failed job_id=%s duration_ms=%s error=%s",
            job_id,
            duration_ms,
            event.exception,
        )
        self._record_metrics(job_name=job_name, success=False, duration_ms=duration_ms)

    def _record_metrics(self, *, job_name: str, success: bool, duration_ms: int | None) -> None:
        if not self._settings.home_scheduler_metrics_enabled:
            return
        attributes = {"job_name": job_name}
        if success:
            _job_success_counter.add(1, attributes=attributes)
        else:
            _job_failure_counter.add(1, attributes=attributes)
        if duration_ms is not None:
            _job_duration_histogram.record(duration_ms, attributes=attributes)


def build_home_scheduler(
    db: DatabaseManager,
    *,
    settings: Settings,
    runtime: HomeRuntimeOrchestrator | Any | None = None,
) -> HomeScheduler | None:
    if not settings.home_scheduler_enabled:
        _logger.info("home_scheduler.disabled reason=settings_flag_off")
        return None
    return HomeScheduler(db, settings=settings, runtime=runtime)
