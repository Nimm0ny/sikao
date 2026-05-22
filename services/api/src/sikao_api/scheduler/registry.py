from __future__ import annotations

from collections.abc import Awaitable, Callable, Iterable
from dataclasses import dataclass
from typing import TYPE_CHECKING

from apscheduler.triggers.base import BaseTrigger

if TYPE_CHECKING:
    from sikao_api.core.config import Settings
    from sikao_api.db.session import DatabaseManager


@dataclass(frozen=True, slots=True)
class HomeSchedulerContext:
    settings: Settings
    db: DatabaseManager


JobCallable = Callable[[HomeSchedulerContext], Awaitable[object] | object]


@dataclass(frozen=True, slots=True)
class HomeSchedulerJob:
    job_id: str
    trigger: BaseTrigger
    func: JobCallable
    name: str
    coalesce: bool = True
    max_instances: int = 1
    misfire_grace_time: int = 60


class HomeSchedulerRegistry:
    def __init__(self, jobs: Iterable[HomeSchedulerJob] | None = None) -> None:
        self._jobs: dict[str, HomeSchedulerJob] = {}
        if jobs is None:
            return
        for job in jobs:
            self.register(job)

    def register(self, job: HomeSchedulerJob) -> None:
        if job.job_id in self._jobs:
            raise ValueError(f"duplicate home scheduler job id: {job.job_id}")
        self._jobs[job.job_id] = job

    def get(self, job_id: str) -> HomeSchedulerJob:
        try:
            return self._jobs[job_id]
        except KeyError as exc:
            raise LookupError(f"unknown home scheduler job id: {job_id}") from exc

    @property
    def job_ids(self) -> tuple[str, ...]:
        return tuple(self._jobs)

    def list_jobs(self) -> tuple[HomeSchedulerJob, ...]:
        return tuple(self._jobs.values())

    def __len__(self) -> int:
        return len(self._jobs)
