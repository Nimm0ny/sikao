from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

from sikao_api.db.models_v2 import PlanEventV2, PlanV2


def now_utc() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def to_naive_utc(value: datetime) -> datetime:
    return value.astimezone(UTC).replace(tzinfo=None) if value.tzinfo is not None else value


def today_cn() -> date:
    return (datetime.now(UTC) + timedelta(hours=8)).date()


def append_change_log(
    change_log: list[dict[str, Any]],
    *,
    change_type: str,
    before: dict[str, Any] | None,
    after: dict[str, Any] | None,
    reason: str,
    actor: str = "user",
) -> list[dict[str, Any]]:
    return [
        *change_log,
        {
            "at": now_utc().replace(tzinfo=UTC).isoformat().replace("+00:00", "Z"),
            "actor": actor,
            "type": change_type,
            "before": before,
            "after": after,
            "reason": reason,
        },
    ]


def serialize_plan(plan: PlanV2) -> dict[str, Any]:
    return {
        "id": plan.id,
        "name": plan.name,
        "target_exam_id": plan.target_exam_id,
        "target_exam_date": plan.target_exam_date.isoformat(),
        "daily_minutes_target": plan.daily_minutes_target,
        "style": plan.style,
        "baseline": plan.baseline,
        "focus_subjects": list(plan.focus_subjects),
        "status": plan.status,
        "source": plan.source,
        "deleted_at": plan.deleted_at.isoformat() if plan.deleted_at else None,
        "archived_at": plan.archived_at.isoformat() if plan.archived_at else None,
    }


def serialize_event(event: PlanEventV2) -> dict[str, Any]:
    return {
        "id": event.id,
        "plan_id": event.plan_id,
        "title": event.title,
        "category": event.category,
        "notes": event.notes,
        "start_at": event.start_at.replace(tzinfo=UTC).isoformat().replace("+00:00", "Z"),
        "end_at": event.end_at.replace(tzinfo=UTC).isoformat().replace("+00:00", "Z"),
        "timezone": event.timezone,
        "status": event.status,
        "source": event.source,
        "recurring_rule": event.recurring_rule,
        "recurring_parent_id": event.recurring_parent_id,
        "recurring_exception_dates": list(event.recurring_exception_dates),
        "linked_session_id": event.linked_session_id,
        "target_id": event.target_id,
        "deleted_at": event.deleted_at.replace(tzinfo=UTC).isoformat().replace("+00:00", "Z")
        if event.deleted_at
        else None,
    }
