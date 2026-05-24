from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import AiCauseAnalysisV2, ReviewAttemptV2, ReviewItemV2
from sikao_api.db.schemas_v2 import (
    ReviewCauseFrequencyV2,
    ReviewInsightsCausesResponseV2,
    ReviewInsightsDayPointV2,
    ReviewInsightsRedoAccuracyResponseV2,
    ReviewInsightsTrendsResponseV2,
    ReviewWeekAccuracyPointV2,
)
from sikao_api.modules.review.application.effective_slug import get_effective_slug
from sikao_api.modules.review.application.time_windows import (
    current_cn_date,
    iso_week_code_from_date,
    to_cn_date,
    trailing_90_day_start,
    week_bounds_utc_from_cn_week_start,
)

_QUEUE_SOURCE_KINDS = {"wrong_answer", "re_failed", "manual_add", "flagged_persistent"}
_SUCCESS_OUTCOMES = {"correct", "probation_entered", "graduated"}
_FAILURE_OUTCOMES = {"incorrect", "probation_failed"}
_ANSWER_OUTCOMES = _SUCCESS_OUTCOMES | _FAILURE_OUTCOMES
_GRADUATED_OUTCOMES = {"graduated"}
_BACKLOG_ADJUSTMENT_OUTCOMES = {"archived", "restored", "graduated"}


def build_review_trends(session: Session, *, user_id: int, anchor_day: date | None = None) -> ReviewInsightsTrendsResponseV2:
    end_day = anchor_day or current_cn_date()
    start_day = trailing_90_day_start(end_day)
    window_start, _ = week_bounds_utc_from_cn_week_start(start_day)
    base_backlog = _compute_backlog_before(session, user_id=user_id, before_dt=window_start)
    created_counter: Counter[date] = Counter()
    delta_counter: Counter[date] = Counter()
    graduated_counter: Counter[date] = Counter()

    rows = list(
        session.scalars(
            select(ReviewItemV2).where(
                ReviewItemV2.user_id == user_id,
                ReviewItemV2.source_kind.in_(tuple(_QUEUE_SOURCE_KINDS)),
                ReviewItemV2.created_at >= window_start,
            )
        )
    )
    for row in rows:
        day = to_cn_date(row.created_at)
        if day < start_day or day > end_day:
            continue
        created_counter[day] += 1
        delta_counter[day] += 1

    attempts = list(
        session.execute(
            select(ReviewAttemptV2.outcome, ReviewAttemptV2.attempted_at)
            .join(ReviewItemV2, ReviewItemV2.id == ReviewAttemptV2.review_item_id)
            .where(
                ReviewItemV2.user_id == user_id,
                ReviewItemV2.source_kind.in_(tuple(_QUEUE_SOURCE_KINDS)),
                ReviewAttemptV2.attempted_at >= window_start,
                ReviewAttemptV2.outcome.in_(tuple(_BACKLOG_ADJUSTMENT_OUTCOMES)),
            )
        )
    )
    for outcome, attempted_at in attempts:
        day = to_cn_date(attempted_at)
        if day < start_day or day > end_day:
            continue
        if outcome == "archived":
            delta_counter[day] -= 1
        elif outcome == "restored":
            delta_counter[day] += 1
        elif outcome in _GRADUATED_OUTCOMES:
            graduated_counter[day] += 1
            delta_counter[day] -= 1

    current = base_backlog
    days: list[ReviewInsightsDayPointV2] = []
    cursor = start_day
    while cursor <= end_day:
        current += delta_counter[cursor]
        days.append(
            ReviewInsightsDayPointV2(
                date=cursor,
                new_incorrect=created_counter[cursor],
                graduated=graduated_counter[cursor],
                net_accumulation=current,
            )
        )
        cursor += timedelta(days=1)
    return ReviewInsightsTrendsResponseV2(days=days)


def build_review_causes(session: Session, *, user_id: int, anchor_day: date | None = None) -> ReviewInsightsCausesResponseV2:
    end_day = anchor_day or current_cn_date()
    start_day = trailing_90_day_start(end_day)
    window_start, _ = week_bounds_utc_from_cn_week_start(start_day)
    rows = list(
        session.scalars(
            select(AiCauseAnalysisV2).where(
                AiCauseAnalysisV2.user_id == user_id,
                AiCauseAnalysisV2.scope == "single",
                AiCauseAnalysisV2.created_at >= window_start,
            )
        )
    )
    counts: Counter[str] = Counter()
    labels: dict[str, str] = {}
    severities: dict[str, Counter[str]] = defaultdict(Counter)
    for row in rows:
        result = row.result_json if isinstance(row.result_json, dict) else {}
        dimensions = result.get("dimensions", [])
        if not isinstance(dimensions, list):
            continue
        for dimension in dimensions:
            if not isinstance(dimension, dict):
                continue
            slug = get_effective_slug(dimension)
            severity = str(dimension.get("severity") or "medium")
            counts[slug] += 1
            labels.setdefault(slug, str(dimension.get("name_display") or slug))
            severities[slug][severity] += 1
    causes = [
        ReviewCauseFrequencyV2(
            slug=slug,
            name=labels.get(slug, slug),
            count=count,
            severity_distribution=dict(severities[slug]),
        )
        for slug, count in counts.most_common()
    ]
    return ReviewInsightsCausesResponseV2(causes=causes)


def build_review_redo_accuracy(session: Session, *, user_id: int, anchor_day: date | None = None) -> ReviewInsightsRedoAccuracyResponseV2:
    end_day = anchor_day or current_cn_date()
    start_day = trailing_90_day_start(end_day)
    window_start, _ = week_bounds_utc_from_cn_week_start(start_day)
    rows = list(
        session.execute(
            select(ReviewAttemptV2.outcome, ReviewAttemptV2.attempted_at)
            .join(ReviewItemV2, ReviewItemV2.id == ReviewAttemptV2.review_item_id)
            .where(
                ReviewItemV2.user_id == user_id,
                ReviewAttemptV2.attempted_at >= window_start,
                ReviewAttemptV2.outcome.in_(tuple(_ANSWER_OUTCOMES)),
            )
        )
    )
    totals: Counter[str] = Counter()
    corrects: Counter[str] = Counter()
    for outcome, attempted_at in rows:
        day = to_cn_date(attempted_at)
        if day < start_day or day > end_day:
            continue
        week_code = iso_week_code_from_date(day - timedelta(days=day.weekday()))
        totals[week_code] += 1
        if outcome in _SUCCESS_OUTCOMES:
            corrects[week_code] += 1
    weeks = sorted(totals.keys())
    return ReviewInsightsRedoAccuracyResponseV2(
        weeks=[
            ReviewWeekAccuracyPointV2(
                week=week,
                total_attempts=totals[week],
                correct_count=corrects[week],
                accuracy_pct=_percent(corrects[week], totals[week]),
            )
            for week in weeks
        ]
    )


def _compute_backlog_before(session: Session, *, user_id: int, before_dt: datetime) -> int:
    created_before = int(
        session.scalar(
            select(func.count(ReviewItemV2.id)).where(
                ReviewItemV2.user_id == user_id,
                ReviewItemV2.source_kind.in_(tuple(_QUEUE_SOURCE_KINDS)),
                ReviewItemV2.created_at < before_dt,
            )
        )
        or 0
    )
    adjustments = list(
        session.execute(
            select(ReviewAttemptV2.outcome)
            .join(ReviewItemV2, ReviewItemV2.id == ReviewAttemptV2.review_item_id)
            .where(
                ReviewItemV2.user_id == user_id,
                ReviewItemV2.source_kind.in_(tuple(_QUEUE_SOURCE_KINDS)),
                ReviewAttemptV2.attempted_at < before_dt,
                ReviewAttemptV2.outcome.in_(tuple(_BACKLOG_ADJUSTMENT_OUTCOMES)),
            )
        )
    )
    delta = 0
    for (outcome,) in adjustments:
        if outcome == "archived":
            delta -= 1
        elif outcome == "restored":
            delta += 1
        elif outcome in _GRADUATED_OUTCOMES:
            delta -= 1
    return created_before + delta


def _percent(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return float((Decimal(numerator) * Decimal("100") / Decimal(denominator)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
