from __future__ import annotations

from collections import defaultdict
from typing import Literal, cast

from sikao_api.modules.practice_stats.application.facts import PracticeStatFact, normalize_category_key
from sikao_api.modules.practice_stats.interface.schemas import (
    PracticeStatsCellV2,
    PracticeStatsResponseV2,
    PracticeStatsTrendPointV2,
)


def build_stats_response(*, type_name: str, facts: list[PracticeStatFact]) -> PracticeStatsResponseV2:
    return PracticeStatsResponseV2(
        type=cast(Literal["xingce", "essay"], type_name),
        overall=_build_cell(label="overall", category_key=None, facts=facts),
        by_category_l1=_build_group(scope="category_l1", facts=facts),
        by_category_l2=_build_group(scope="category_l2", facts=facts),
    )


def _build_group(*, scope: str, facts: list[PracticeStatFact]) -> list[PracticeStatsCellV2]:
    buckets: dict[tuple[str, str], list[PracticeStatFact]] = defaultdict(list)
    for fact in facts:
        if scope == "category_l1":
            buckets[(fact.category_l1, fact.category_l1)].append(fact)
        else:
            key = normalize_category_key(fact.category_l1, fact.category_l2)
            buckets[(key, fact.category_l2 or "uncategorized")].append(fact)
    return [
        _build_cell(label=label, category_key=key, facts=bucket_facts)
        for key, label in sorted(buckets, key=lambda item: item[0][0])
        for bucket_facts in [buckets[(key, label)]]
    ]


def _build_cell(*, label: str, category_key: str | None, facts: list[PracticeStatFact]) -> PracticeStatsCellV2:
    attempts = {fact.attempt_id for fact in facts}
    graded_total = sum(fact.graded_count for fact in facts)
    score_values = [fact.score_value for fact in facts if fact.score_value is not None]
    trend_points = build_trend_points(facts=facts, limit=10)
    accuracy = (
        round(sum(fact.correct_count for fact in facts) / graded_total, 4)
        if facts and facts[0].type == "xingce" and graded_total > 0
        else round(sum(score_values) / (len(score_values) * 100), 4) if score_values else 0.0
    )
    return PracticeStatsCellV2(
        category_key=category_key,
        label=label,
        total_questions=sum(fact.total_questions for fact in facts),
        correct_count=sum(fact.correct_count for fact in facts),
        accuracy=accuracy,
        total_sessions=len(attempts),
        total_minutes=int(round(sum(fact.total_minutes for fact in facts))),
        recent_trend=trend_points,
        percentile_rank=None,
        last_practiced_at=max((fact.practiced_at for fact in facts), default=None),
        average_score=round(sum(score_values) / len(score_values), 2) if score_values else None,
    )


def build_trend_points(*, facts: list[PracticeStatFact], limit: int | None) -> list[PracticeStatsTrendPointV2]:
    by_attempt: dict[int, list[PracticeStatFact]] = defaultdict(list)
    for fact in facts:
        by_attempt[fact.attempt_id].append(fact)
    latest_attempts = sorted(by_attempt.values(), key=lambda rows: max(item.practiced_at for item in rows), reverse=True)
    if limit is not None:
        latest_attempts = latest_attempts[:limit]
    return [
        PracticeStatsTrendPointV2(
            date=max(item.practiced_at for item in rows).date(),
            session_id=rows[0].attempt_id,
            accuracy=round(sum(item.correct_count for item in rows) / sum(item.graded_count for item in rows), 4)
            if rows[0].type == "xingce" and sum(item.graded_count for item in rows) > 0
            else round(sum(item.score_value or 0.0 for item in rows) / (len([item for item in rows if item.score_value is not None]) * 100), 4)
            if any(item.score_value is not None for item in rows)
            else 0.0,
            count=sum(item.total_questions for item in rows),
            average_score=round(sum(item.score_value or 0.0 for item in rows) / len([item for item in rows if item.score_value is not None]), 2)
            if any(item.score_value is not None for item in rows)
            else None,
        )
        for rows in reversed(latest_attempts)
    ]
