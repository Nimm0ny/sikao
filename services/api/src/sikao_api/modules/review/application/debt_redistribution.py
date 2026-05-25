from __future__ import annotations

import math
from collections import Counter
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from sikao_api.db.enums_v2 import DebtSeverity, ReviewAttemptOutcome
from sikao_api.db.models_v2 import ReviewItemV2
from sikao_api.modules.review.application.queue_items import ACTIVE_REVIEW_ITEM_STATUSES, record_review_attempt
from sikao_api.modules.review.application.srs_core import get_today_end
from sikao_api.modules.review.application.srs_types import ensure_metadata


@dataclass(frozen=True)
class ReviewDebtSnapshot:
    overdue_count: int
    oldest_overdue_days: int
    debt_severity: DebtSeverity
    daily_limit: int
    recommended_today_count: int
    redistributed_count: int = 0


@dataclass(frozen=True)
class RedistributeResult:
    redistributed_count: int
    spread_days: int


def compute_debt_snapshot(
    session: Session,
    *,
    user_id: int,
    user_tz: str,
    daily_limit: int,
) -> ReviewDebtSnapshot:
    overdue_items = fetch_overdue_items(session, user_id=user_id, user_tz=user_tz)
    if not overdue_items:
        return ReviewDebtSnapshot(
            overdue_count=0,
            oldest_overdue_days=0,
            debt_severity=DebtSeverity.NONE,
            daily_limit=daily_limit,
            recommended_today_count=0,
            redistributed_count=0,
        )
    today_end = get_today_end(user_tz)
    oldest_overdue_days = max(
        max(0, (today_end - item.next_review_at).days)
        for item in overdue_items
        if item.next_review_at is not None
    )
    redistributed_count = sum(
        1
        for item in overdue_items
        if ensure_metadata(item).get("debt_status") == "redistributed"
    )
    severity = classify_severity(
        overdue_count=len(overdue_items),
        oldest_overdue_days=oldest_overdue_days,
        daily_limit=daily_limit,
    )
    return ReviewDebtSnapshot(
        overdue_count=len(overdue_items),
        oldest_overdue_days=oldest_overdue_days,
        debt_severity=severity,
        daily_limit=daily_limit,
        recommended_today_count=min(len(overdue_items), daily_limit),
        redistributed_count=redistributed_count,
    )


def classify_severity(*, overdue_count: int, oldest_overdue_days: int, daily_limit: int) -> DebtSeverity:
    if overdue_count <= 0:
        return DebtSeverity.NONE
    if overdue_count > daily_limit * 7 or oldest_overdue_days > 14:
        return DebtSeverity.CRITICAL
    if overdue_count <= daily_limit:
        return DebtSeverity.LIGHT
    if overdue_count <= daily_limit * 3:
        return DebtSeverity.MODERATE
    if overdue_count <= daily_limit * 7:
        return DebtSeverity.HEAVY
    return DebtSeverity.CRITICAL


def fetch_overdue_items(
    session: Session,
    *,
    user_id: int,
    user_tz: str,
) -> list[ReviewItemV2]:
    today_end = get_today_end(user_tz)
    return list(
        session.scalars(
            select(ReviewItemV2)
            .where(
                ReviewItemV2.user_id == user_id,
                ReviewItemV2.status.in_(ACTIVE_REVIEW_ITEM_STATUSES),
                ReviewItemV2.next_review_at.is_not(None),
                ReviewItemV2.next_review_at <= today_end,
            )
            .order_by(ReviewItemV2.next_review_at.asc(), ReviewItemV2.updated_at.asc(), ReviewItemV2.id.asc())
        )
    )


def redistribute_overdue_items(
    session: Session,
    *,
    items: list[ReviewItemV2],
    daily_limit: int,
    user_tz: str,
    outcome: ReviewAttemptOutcome = ReviewAttemptOutcome.DEBT_REDISTRIBUTED,
) -> RedistributeResult:
    if not items:
        return RedistributeResult(redistributed_count=0, spread_days=0)
    spread_days = min(14, math.ceil(len(items) / daily_limit))
    today_end = get_today_end(user_tz)
    assignment_date = today_end.date().isoformat()
    for idx, item in enumerate(sorted(items, key=lambda row: row.next_review_at or today_end)):
        target_day = min(idx // daily_limit, spread_days - 1)
        new_next = today_end + timedelta(days=target_day)
        metadata = dict(ensure_metadata(item))
        original_overdue_at = item.next_review_at.isoformat() if item.next_review_at is not None else None
        metadata["debt_status"] = "redistributed"
        metadata["debt_assigned_date"] = assignment_date
        metadata["debt_redistributed_to"] = new_next.date().isoformat()
        metadata["original_overdue_at"] = original_overdue_at
        metadata.pop("ramp_up_phase", None)
        metadata.pop("ramp_up_started_at", None)
        metadata.pop("ramp_up_unlock_at", None)
        item.metadata_json = metadata
        flag_modified(item, "metadata_json")
        item.next_review_at = new_next
        session.add(item)
        record_review_attempt(
            session,
            item_id=item.id,
            outcome=outcome.value,
            notes_json={
                "original_overdue_at": original_overdue_at,
                "redistributed_to": new_next.isoformat(),
                "spread_days": spread_days,
            },
        )
    return RedistributeResult(redistributed_count=len(items), spread_days=spread_days)


def build_redistribute_plan(
    session: Session,
    *,
    user_id: int,
    user_tz: str,
) -> tuple[list[tuple[date, int]], int]:
    items = list(
        session.scalars(
            select(ReviewItemV2).where(
                ReviewItemV2.user_id == user_id,
                ReviewItemV2.status.in_(ACTIVE_REVIEW_ITEM_STATUSES),
            )
        )
    )
    counter: Counter[date] = Counter()
    for item in items:
        metadata = ensure_metadata(item)
        if metadata.get("debt_status") != "redistributed":
            continue
        redistributed_to = metadata.get("debt_redistributed_to")
        if isinstance(redistributed_to, str):
            counter[date.fromisoformat(redistributed_to)] += 1
        elif item.next_review_at is not None:
            counter[item.next_review_at.date()] += 1
    buckets = sorted(counter.items(), key=lambda item: item[0])
    return buckets, sum(counter.values())
