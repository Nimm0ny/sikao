from __future__ import annotations

import hashlib
import json
from datetime import UTC, date, datetime, time as daytime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PlanEventV2
from sikao_api.modules.plans.application.helpers import serialize_event


def build_recommendation_cache_key(
    *,
    user_id: int,
    payload: dict[str, Any],
    today: date,
) -> str:
    body = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(body.encode("utf-8")).hexdigest()
    return f"recommend_today:{user_id}:{today.isoformat()}:{digest}"


def load_window_events(
    session: Session,
    *,
    user_id: int,
    plan_id: int,
    from_date: date,
    to_date: date,
    timezone: str,
) -> list[dict[str, Any]]:
    tz = ZoneInfo(timezone)
    start_at = datetime.combine(from_date, daytime.min, tzinfo=tz).astimezone(UTC).replace(tzinfo=None)
    end_at = datetime.combine(to_date + timedelta(days=1), daytime.min, tzinfo=tz).astimezone(UTC).replace(tzinfo=None)
    rows = list(
        session.scalars(
            select(PlanEventV2).where(
                PlanEventV2.user_id == user_id,
                PlanEventV2.plan_id == plan_id,
                PlanEventV2.deleted_at.is_(None),
                PlanEventV2.start_at < end_at,
                PlanEventV2.end_at >= start_at,
            )
        )
    )
    return [serialize_event(row) for row in rows]
