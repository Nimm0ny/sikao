from __future__ import annotations

import asyncio
import hashlib
import json
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime, time as daytime, timedelta
from typing import Any, TypeVar
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from sikao_api.modules.plans.application.helpers import now_utc
from sikao_api.scheduler.registry import HomeSchedulerContext

T = TypeVar("T")

HOME_SCHEDULER_ACTOR_TYPE = "system"
HOME_SCHEDULER_ACTOR_ID = "home_scheduler"


@dataclass(frozen=True, slots=True)
class SchedulerRunSummary:
    processed: int = 0
    skipped: int = 0


def build_request_id(job_id: str) -> str:
    return f"home-scheduler:{job_id}:{now_utc().isoformat()}"


def stable_json_hash(value: Any) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def local_day_bounds(*, instant: datetime, timezone: str) -> tuple[datetime, datetime]:
    zone = ZoneInfo(timezone)
    localized = instant.replace(tzinfo=UTC).astimezone(zone)
    day_start = datetime.combine(localized.date(), daytime.min, tzinfo=zone).astimezone(UTC)
    next_start = day_start + timedelta(days=1)
    return day_start.replace(tzinfo=None), next_start.replace(tzinfo=None)


def next_n_days_window(*, anchor_day: date, timezone: str, days: int) -> tuple[date, date]:
    if days < 1:
        raise ValueError("days must be >= 1")
    return anchor_day, anchor_day + timedelta(days=days - 1)


def run_with_session(context: HomeSchedulerContext, fn: Callable[[Session], T]) -> T:
    session = context.db.session_factory()
    try:
        result = fn(session)
        session.commit()
        return result
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


async def run_sync_job(context: HomeSchedulerContext, fn: Callable[[HomeSchedulerContext], T]) -> T:
    return await asyncio.to_thread(fn, context)
