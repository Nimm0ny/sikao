from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal, cast

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeSessionAnswerV2, PracticeSessionV2, QuestionTimingBaselineV2, QuestionV2, UserV2
from sikao_api.db.schemas_v2 import PracticeStatsTimingResponseV2, QuestionTimingItemV2, SessionTimingReportV2, TimingByCategory, TimingByDifficulty, TimingOverall, TimingOvertimeBucket, TimingSummaryV2
from sikao_api.modules.practice_stats.application.facts import difficulty_bucket_from_accuracy, normalize_category_key
from sikao_api.modules.system.application.errors import ConflictError, NotFoundError
from sikao_api.modules.timing.interface.schemas import TimingBaselineResponseV2

_MIN_SAMPLES = 30
_PERIOD_DAYS = {"7d": 7, "30d": 30, "90d": 90}


@dataclass(frozen=True)
class TimingFact:
    session_id: int
    answer_id: int
    question_id: int
    display_order: int
    practiced_at: datetime
    category_l1: str
    category_l2: str | None
    difficulty: str
    time_spent_ms: int
    is_overtime: bool
    baseline_mean_ms: int | None


def get_question_timing_baseline(session: Session, *, question_id: int) -> TimingBaselineResponseV2:
    row = session.get(QuestionTimingBaselineV2, question_id)
    if row is None or row.sample_size < _MIN_SAMPLES:
        raise NotFoundError("timing baseline is insufficient", code="BASELINE_INSUFFICIENT")
    return TimingBaselineResponseV2(
        p50_ms=row.p50_ms,
        p90_ms=row.p90_ms,
        p95_ms=row.p95_ms,
        mean_ms=row.mean_ms,
        sample_size=row.sample_size,
    )


def build_session_timing_report(
    session: Session,
    *,
    user: UserV2,
    session_id: int,
) -> SessionTimingReportV2:
    practice_session = session.scalar(
        select(PracticeSessionV2).where(
            PracticeSessionV2.id == session_id,
            PracticeSessionV2.user_id == user.id,
        )
    )
    if practice_session is None:
        raise NotFoundError("practice session not found", code="practice_session_not_found")
    if practice_session.status != "submitted" or practice_session.submitted_at is None:
        raise ConflictError(
            "practice session is not writable",
            code="SESSION_NOT_WRITABLE",
        )

    rows = list(
        session.execute(
            select(PracticeSessionAnswerV2, QuestionTimingBaselineV2)
            .outerjoin(
                QuestionTimingBaselineV2,
                QuestionTimingBaselineV2.question_id == PracticeSessionAnswerV2.question_id,
            )
            .where(PracticeSessionAnswerV2.session_id == practice_session.id)
            .order_by(PracticeSessionAnswerV2.display_order.asc(), PracticeSessionAnswerV2.id.asc())
        )
    )
    questions = [
        QuestionTimingItemV2(
            answer_id=answer.id,
            question_id=answer.question_id or 0,
            time_spent_ms=answer.time_spent_ms,
            baseline_p50_ms=baseline.p50_ms if baseline is not None and baseline.sample_size >= _MIN_SAMPLES else None,
            baseline_p95_ms=baseline.p95_ms if baseline is not None and baseline.sample_size >= _MIN_SAMPLES else None,
            is_overtime=answer.is_overtime,
            answer_change_count=answer.answer_change_count,
            visit_count=answer.visit_count,
        )
        for answer, baseline in rows
    ]
    total_wall_seconds = max(
        0,
        int(
            (
                (practice_session.submitted_at or datetime.now(UTC).replace(tzinfo=None))
                - practice_session.started_at
            ).total_seconds()
        ),
    )
    return SessionTimingReportV2(
        total_active_seconds=practice_session.total_active_seconds,
        total_wall_seconds=total_wall_seconds,
        paused_total_seconds=practice_session.paused_total_seconds,
        questions=questions,
        summary=TimingSummaryV2(
            overtime_count=sum(1 for item in questions if item.is_overtime),
            fastest_answer_id=_pick_answer_id(questions, mode="min", field="time_spent_ms"),
            slowest_answer_id=_pick_answer_id(questions, mode="max", field="time_spent_ms"),
            most_changed_answer_id=_pick_answer_id(questions, mode="max", field="answer_change_count"),
        ),
    )


def build_timing_stats(
    session: Session,
    *,
    user: UserV2,
    type_name: str,
    period: str,
    category: str | None,
) -> PracticeStatsTimingResponseV2:
    facts = _load_timing_facts(session, user_id=user.id, type_name=type_name, period=period, category=category)
    grouped_l1: dict[str, list[TimingFact]] = defaultdict(list)
    grouped_difficulty: dict[str, list[TimingFact]] = defaultdict(list)
    overtime_counts: dict[int, int] = defaultdict(int)
    for fact in facts:
        grouped_l1[fact.category_l1].append(fact)
        grouped_difficulty[fact.difficulty].append(fact)
        if fact.is_overtime:
            overtime_counts[fact.question_id] += 1

    return PracticeStatsTimingResponseV2(
        overall=_build_overall(facts),
        by_category_l1=[
            TimingByCategory(
                category=category_key,
                avg_seconds=_avg_seconds(rows),
                vs_baseline_ratio=_baseline_ratio(rows),
                sample_count=len(rows),
            )
            for category_key, rows in sorted(grouped_l1.items())
        ],
        by_difficulty=[
            TimingByDifficulty(
                difficulty_bucket=cast(Literal["easy", "medium", "hard", "unknown"], bucket),
                avg_seconds=_avg_seconds(rows),
                vs_baseline_ratio=_baseline_ratio(rows),
            )
            for bucket, rows in sorted(grouped_difficulty.items())
        ],
        overtime_questions=TimingOvertimeBucket(
            count=sum(overtime_counts.values()),
            top_5_question_ids=[
                question_id
                for question_id, _count in sorted(
                    overtime_counts.items(),
                    key=lambda item: (-item[1], item[0]),
                )[:5]
            ],
        ),
        pacing_pattern=_infer_pacing_pattern(facts),
    )


def _load_timing_facts(
    session: Session,
    *,
    user_id: int,
    type_name: str,
    period: str,
    category: str | None,
) -> list[TimingFact]:
    cutoff = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=_PERIOD_DAYS[period])
    rows = list(
        session.execute(
            select(PracticeSessionV2, PracticeSessionAnswerV2, QuestionV2, QuestionTimingBaselineV2)
            .join(PracticeSessionAnswerV2, PracticeSessionAnswerV2.session_id == PracticeSessionV2.id)
            .join(QuestionV2, QuestionV2.id == PracticeSessionAnswerV2.question_id)
            .outerjoin(QuestionTimingBaselineV2, QuestionTimingBaselineV2.question_id == QuestionV2.id)
            .where(
                PracticeSessionV2.user_id == user_id,
                PracticeSessionV2.track == type_name,
                PracticeSessionV2.status == "submitted",
                PracticeSessionV2.submitted_at.is_not(None),
                PracticeSessionV2.submitted_at >= cutoff,
                PracticeSessionAnswerV2.time_spent_ms > 0,
                PracticeSessionV2.source_mode != "daily",
            )
            .order_by(PracticeSessionV2.submitted_at.desc(), PracticeSessionAnswerV2.display_order.asc())
        )
    )
    facts = [
        TimingFact(
            session_id=practice_session.id,
            answer_id=answer.id,
            question_id=question.id,
            display_order=answer.display_order,
            practiced_at=practice_session.submitted_at or practice_session.started_at,
            category_l1=question.category_l1,
            category_l2=question.category_l2,
            difficulty=difficulty_bucket_from_accuracy(question.historical_accuracy),
            time_spent_ms=answer.time_spent_ms,
            is_overtime=answer.is_overtime,
            baseline_mean_ms=baseline.mean_ms if baseline is not None and baseline.sample_size >= _MIN_SAMPLES else None,
        )
        for practice_session, answer, question, baseline in rows
        if _matches_category(question.category_l1, question.category_l2, category)
    ]
    return facts


def _matches_category(category_l1: str, category_l2: str | None, category: str | None) -> bool:
    if category is None:
        return True
    if ":" in category:
        return normalize_category_key(category_l1, category_l2) == category
    return category_l1 == category


def _build_overall(facts: list[TimingFact]) -> TimingOverall:
    total_minutes = int(round(sum(fact.time_spent_ms for fact in facts) / 1000 / 60)) if facts else 0
    avg_seconds_per_question = round(sum(fact.time_spent_ms for fact in facts) / len(facts) / 1000, 2) if facts else 0.0
    return TimingOverall(
        total_minutes=total_minutes,
        avg_seconds_per_question=avg_seconds_per_question,
        vs_baseline_ratio=_baseline_ratio(facts),
    )


def _avg_seconds(facts: list[TimingFact]) -> float:
    if not facts:
        return 0.0
    return round(sum(fact.time_spent_ms for fact in facts) / len(facts) / 1000, 2)


def _baseline_ratio(facts: list[TimingFact]) -> float:
    baseline_rows = [fact for fact in facts if fact.baseline_mean_ms is not None and fact.baseline_mean_ms > 0]
    if not baseline_rows:
        return 1.0
    actual = sum(fact.time_spent_ms for fact in baseline_rows) / len(baseline_rows)
    baseline = sum(fact.baseline_mean_ms or 0 for fact in baseline_rows) / len(baseline_rows)
    if baseline == 0:
        return 1.0
    return round(actual / baseline, 4)


def _infer_pacing_pattern(facts: list[TimingFact]) -> Literal["steady", "fast_start_slow_end", "slow_start_fast_end", "irregular"]:
    by_session: dict[int, list[TimingFact]] = defaultdict(list)
    for fact in facts:
        by_session[fact.session_id].append(fact)
    segment_values: dict[str, list[float]] = {"first": [], "middle": [], "last": []}
    for rows in by_session.values():
        ordered = sorted(rows, key=lambda item: (item.display_order, item.answer_id))
        if not ordered:
            continue
        size = max(1, len(ordered) // 3)
        segments = {
            "first": ordered[:size],
            "middle": ordered[size:size * 2] or ordered[:size],
            "last": ordered[size * 2:] or ordered[-size:],
        }
        for key, segment in segments.items():
            segment_values[key].append(sum(item.time_spent_ms for item in segment) / len(segment))
    if not segment_values["first"] or not segment_values["last"]:
        return "steady"
    first_avg = sum(segment_values["first"]) / len(segment_values["first"])
    last_avg = sum(segment_values["last"]) / len(segment_values["last"])
    middle_avg = sum(segment_values["middle"]) / len(segment_values["middle"]) if segment_values["middle"] else first_avg
    if first_avg == 0 and middle_avg == 0 and last_avg == 0:
        return "steady"
    tolerance = max(first_avg, middle_avg, last_avg) * 0.1
    if abs(first_avg - last_avg) <= tolerance and abs(first_avg - middle_avg) <= tolerance:
        return "steady"
    if first_avg + tolerance < last_avg:
        return "fast_start_slow_end"
    if last_avg + tolerance < first_avg:
        return "slow_start_fast_end"
    return "irregular"


def _pick_answer_id(
    items: list[QuestionTimingItemV2],
    *,
    mode: Literal["min", "max"],
    field: Literal["time_spent_ms", "answer_change_count"],
) -> int | None:
    if not items:
        return None
    reverse = mode == "max"
    sorted_items = sorted(
        items,
        key=lambda item: (getattr(item, field), item.answer_id),
        reverse=reverse,
    )
    return sorted_items[0].answer_id
