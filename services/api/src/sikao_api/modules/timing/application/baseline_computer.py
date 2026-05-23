from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime, timedelta
from math import ceil, floor
from statistics import fmean

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeSessionAnswerV2, PracticeSessionV2, QuestionTimingBaselineV2
from sikao_api.modules.system.application.audit_v2 import add_audit_log

_MIN_SAMPLES = 30
_WINDOW_DAYS = 90
_MAX_VALID_TIME_SPENT_MS = 600_000


def recompute_question_timing_baseline(
    session: Session,
    *,
    now: datetime | None = None,
) -> int:
    current_time = now or datetime.now(UTC).replace(tzinfo=None)
    cutoff = current_time - timedelta(days=_WINDOW_DAYS)
    recent_question_ids = {
        question_id
        for question_id in session.scalars(
            select(PracticeSessionAnswerV2.question_id)
            .distinct()
            .join(PracticeSessionV2, PracticeSessionV2.id == PracticeSessionAnswerV2.session_id)
            .where(
                PracticeSessionV2.status == "submitted",
                PracticeSessionV2.submitted_at.is_not(None),
                PracticeSessionV2.submitted_at >= cutoff,
                PracticeSessionAnswerV2.question_id.is_not(None),
            )
        )
        if question_id is not None
    }
    existing_baseline_ids = set(session.scalars(select(QuestionTimingBaselineV2.question_id)))
    rows = list(
        session.execute(
            select(PracticeSessionAnswerV2.question_id, PracticeSessionAnswerV2.time_spent_ms)
            .join(PracticeSessionV2, PracticeSessionV2.id == PracticeSessionAnswerV2.session_id)
            .where(
                PracticeSessionV2.status == "submitted",
                PracticeSessionV2.submitted_at.is_not(None),
                PracticeSessionV2.submitted_at >= cutoff,
                PracticeSessionAnswerV2.question_id.is_not(None),
                PracticeSessionAnswerV2.time_spent_ms > 0,
                PracticeSessionAnswerV2.time_spent_ms < _MAX_VALID_TIME_SPENT_MS,
            )
        )
    )
    samples_by_question: dict[int, list[int]] = defaultdict(list)
    for question_id, time_spent_ms in rows:
        if question_id is None:
            continue
        samples_by_question[question_id].append(time_spent_ms)

    candidate_ids = existing_baseline_ids | recent_question_ids | set(samples_by_question)
    updated = 0
    skipped_insufficient = 0
    cleared_stale = 0
    for question_id in sorted(candidate_ids):
        samples = samples_by_question.get(question_id, [])
        baseline = session.get(QuestionTimingBaselineV2, question_id)
        if len(samples) < _MIN_SAMPLES:
            skipped_insufficient += 1
            if baseline is not None:
                session.delete(baseline)
                cleared_stale += 1
            continue
        ordered = sorted(samples)
        if baseline is None:
            baseline = QuestionTimingBaselineV2(question_id=question_id)
            session.add(baseline)
        baseline.p50_ms = _percentile_ms(ordered, 50)
        baseline.p90_ms = _percentile_ms(ordered, 90)
        baseline.p95_ms = _percentile_ms(ordered, 95)
        baseline.mean_ms = int(round(fmean(ordered)))
        baseline.sample_size = len(ordered)
        baseline.last_recomputed_at = current_time
        session.add(baseline)
        updated += 1

    add_audit_log(
        session,
        user_id=0,
        actor_type="system",
        actor_id="timing.baseline_computer",
        action="timing.baseline_recomputed",
        target_type="QuestionTimingBaselineV2",
        target_id=None,
        metadata={
            "updated_count": updated,
            "candidate_count": len(candidate_ids),
            "skipped_insufficient_count": skipped_insufficient,
            "cleared_stale_count": cleared_stale,
        },
        request_id=None,
        ip=None,
    )
    session.flush()
    return updated


def _percentile_ms(samples: list[int], percentile: int) -> int:
    if len(samples) == 1:
        return samples[0]
    position = (len(samples) - 1) * (percentile / 100)
    lower = floor(position)
    upper = ceil(position)
    if lower == upper:
        return samples[lower]
    weight = position - lower
    interpolated = samples[lower] + (samples[upper] - samples[lower]) * weight
    return int(round(interpolated))
