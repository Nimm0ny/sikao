from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import AiCauseAnalysisV2, NoteV2, ReviewAttemptV2, ReviewItemV2, ReviewWeeklySnapshotV2
from sikao_api.db.schemas_v2 import (
    ReviewWeeklyConcernHighlightV2,
    ReviewWeeklyProgressHighlightV2,
    ReviewWeeklySummaryResponseV2,
)
from sikao_api.modules.review.application.effective_slug import get_effective_slug
from sikao_api.modules.review.application.time_windows import (
    iso_week_code_from_date,
    parse_iso_week_code,
    week_bounds_utc_from_cn_week_start,
)
from sikao_api.modules.system.application.errors import ValidationError

_SUCCESS_OUTCOMES = {"correct", "probation_entered", "graduated"}
_FAILURE_OUTCOMES = {"incorrect", "probation_failed"}
_ANSWER_OUTCOMES = _SUCCESS_OUTCOMES | _FAILURE_OUTCOMES
_GRADUATED_OUTCOMES = {"graduated"}
_QUEUE_SOURCE_KINDS = {"wrong_answer", "re_failed", "manual_add", "flagged_persistent"}
_CONFIDENCE_ORDER = {"guess": 0, "unsure": 1, "likely": 2, "certain": 3}


def build_weekly_summary(
    session: Session,
    *,
    user_id: int,
    week_start_date: date,
) -> ReviewWeeklySummaryResponseV2:
    week_code = iso_week_code_from_date(week_start_date)
    window_start, window_end = week_bounds_utc_from_cn_week_start(week_start_date)
    attempts = list(
        session.execute(
            select(
                ReviewAttemptV2.review_item_id,
                ReviewAttemptV2.outcome,
                ReviewAttemptV2.notes_json,
                ReviewAttemptV2.attempted_at,
                ReviewItemV2.question_id,
                ReviewItemV2.title,
            )
            .join(ReviewItemV2, ReviewItemV2.id == ReviewAttemptV2.review_item_id)
            .where(
                ReviewItemV2.user_id == user_id,
                ReviewAttemptV2.attempted_at >= window_start,
                ReviewAttemptV2.attempted_at < window_end,
                ReviewAttemptV2.outcome.in_(tuple(_ANSWER_OUTCOMES)),
            )
            .order_by(ReviewAttemptV2.attempted_at.asc(), ReviewAttemptV2.id.asc())
        )
    )
    review_question_ids = select(ReviewItemV2.question_id).where(
        ReviewItemV2.user_id == user_id,
        ReviewItemV2.question_id.is_not(None),
    )
    notes_count = int(
        session.scalar(
            select(func.count(NoteV2.id)).where(
                NoteV2.user_id == user_id,
                NoteV2.created_at >= window_start,
                NoteV2.created_at < window_end,
                NoteV2.linked_question_id.in_(review_question_ids),
            )
        )
        or 0
    )
    total_attempts = len(attempts)
    correct_count = sum(1 for row in attempts if row.outcome in _SUCCESS_OUTCOMES)
    items_reviewed = len({int(review_item_id) for review_item_id, *_rest in attempts})
    graduated_count = sum(1 for row in attempts if row.outcome in _GRADUATED_OUTCOMES)
    biggest_progress = _compute_biggest_progress(attempts)
    biggest_concern = _compute_biggest_concern(session, user_id=user_id, window_start=window_start, window_end=window_end)
    next_week_focus = _build_next_week_focus(biggest_concern=biggest_concern, biggest_progress=biggest_progress)
    return ReviewWeeklySummaryResponseV2(
        week=week_code,
        items_reviewed=items_reviewed,
        redo_accuracy_pct=_percent(correct_count, total_attempts),
        new_notes_count=notes_count,
        new_graduated_count=graduated_count,
        generated_note_id=None,
        biggest_progress=biggest_progress,
        biggest_concern=biggest_concern,
        next_week_focus=next_week_focus,
    )


def load_weekly_snapshot(
    session: Session,
    *,
    user_id: int,
    week_start_date: date,
) -> ReviewWeeklySnapshotV2 | None:
    return session.scalar(
        select(ReviewWeeklySnapshotV2).where(
            ReviewWeeklySnapshotV2.user_id == user_id,
            ReviewWeeklySnapshotV2.week_start_date == week_start_date,
        )
    )


def load_weekly_summary_or_fallback(
    session: Session,
    *,
    user_id: int,
    week: str,
) -> ReviewWeeklySummaryResponseV2:
    try:
        week_start_date = parse_iso_week_code(week)
    except ValueError as exc:
        raise ValidationError("week must use YYYY-WW format", code="review_week_invalid") from exc
    snapshot = load_weekly_snapshot(session, user_id=user_id, week_start_date=week_start_date)
    if snapshot is not None:
        return ReviewWeeklySummaryResponseV2.model_validate(snapshot.data_json)
    return build_weekly_summary(session, user_id=user_id, week_start_date=week_start_date)


def write_weekly_snapshot(
    session: Session,
    *,
    user_id: int,
    week_start_date: date,
) -> tuple[ReviewWeeklySnapshotV2, bool]:
    summary = build_weekly_summary(session, user_id=user_id, week_start_date=week_start_date)
    row = load_weekly_snapshot(session, user_id=user_id, week_start_date=week_start_date)
    payload = summary.model_dump(mode="python", by_alias=True)
    created = row is None
    if row is None:
        row = ReviewWeeklySnapshotV2(
            user_id=user_id,
            week_start_date=week_start_date,
            data_json=payload,
        )
    else:
        row.data_json = payload
    session.add(row)
    session.flush()
    return row, created


def _compute_biggest_progress(
    attempts: list[Any],
) -> ReviewWeeklyProgressHighlightV2 | None:
    grouped: dict[int, list[tuple[str, dict[str, Any], int | None, str]]] = defaultdict(list)
    for review_item_id, outcome, notes_json, _attempted_at, question_id, title in attempts:
        grouped[int(review_item_id)].append((outcome, notes_json, question_id, title))
    best: tuple[int, ReviewWeeklyProgressHighlightV2] | None = None
    for rows in grouped.values():
        had_failure = any(outcome in _FAILURE_OUTCOMES for outcome, *_rest in rows)
        had_success = any(outcome in _SUCCESS_OUTCOMES for outcome, *_rest in rows)
        first_conf = next(
            (
                str(notes_json.get("effectiveConfidence"))
                for _outcome, notes_json, *_rest in rows
                if notes_json.get("effectiveConfidence") is not None
            ),
            None,
        )
        last_conf = next(
            (
                str(notes_json.get("effectiveConfidence"))
                for _outcome, notes_json, *_rest in reversed(rows)
                if notes_json.get("effectiveConfidence") is not None
            ),
            None,
        )
        score = 0
        if had_failure and had_success:
            score += 2
        if first_conf is not None and last_conf is not None:
            score += max(_CONFIDENCE_ORDER.get(last_conf, 0) - _CONFIDENCE_ORDER.get(first_conf, 0), 0)
        if score <= 0:
            continue
        question_id = rows[-1][2]
        title = rows[-1][3]
        highlight = ReviewWeeklyProgressHighlightV2(
            question_id=question_id,
            title=title,
            summary="Moved from unstable attempts toward a successful mastery step this week.",
            from_confidence=first_conf,
            to_confidence=last_conf,
        )
        if best is None or score > best[0]:
            best = (score, highlight)
    return best[1] if best is not None else None


def _compute_biggest_concern(
    session: Session,
    *,
    user_id: int,
    window_start: datetime,
    window_end: datetime,
) -> ReviewWeeklyConcernHighlightV2 | None:
    rows = list(
        session.scalars(
            select(AiCauseAnalysisV2).where(
                AiCauseAnalysisV2.user_id == user_id,
                AiCauseAnalysisV2.scope == "single",
                AiCauseAnalysisV2.created_at >= window_start,
                AiCauseAnalysisV2.created_at < window_end,
            )
        )
    )
    counter: Counter[str] = Counter()
    label_by_slug: dict[str, str] = {}
    for row in rows:
        result = row.result_json if isinstance(row.result_json, dict) else {}
        dimensions = result.get("dimensions", [])
        if not isinstance(dimensions, list):
            continue
        for dimension in dimensions:
            if not isinstance(dimension, dict):
                continue
            slug = get_effective_slug(dimension)
            counter[slug] += 1
            label_by_slug.setdefault(slug, str(dimension.get("name_display") or slug))
    if not counter:
        return None
    slug, count = counter.most_common(1)[0]
    label = label_by_slug.get(slug, slug)
    return ReviewWeeklyConcernHighlightV2(
        slug=slug,
        label=label,
        summary=f"Most frequent cause this week: {label} ({count} analyses).",
    )


def _build_next_week_focus(
    *,
    biggest_concern: ReviewWeeklyConcernHighlightV2 | None,
    biggest_progress: ReviewWeeklyProgressHighlightV2 | None,
) -> str | None:
    if biggest_concern is not None:
        return f"Focus next week on stabilizing {biggest_concern.label} with targeted redo and note review."
    if biggest_progress is not None:
        return f"Keep reinforcing the gains on {biggest_progress.title} before they decay."
    return None


def _percent(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return float((Decimal(numerator) * Decimal("100") / Decimal(denominator)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
