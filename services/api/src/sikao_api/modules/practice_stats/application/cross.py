from __future__ import annotations

from collections import defaultdict
from typing import Literal, cast

from sikao_api.modules.practice_stats.application.filters import apply_category_filter, infer_cross_row_key
from sikao_api.modules.practice_stats.application.loaders import load_practice_facts
from sikao_api.modules.practice_stats.interface.schemas import PracticeStatsCrossItemV2, PracticeStatsCrossResponseV2


def build_stats_cross(session, *, user, type_name: str, category: str | None, difficulty: str | None) -> PracticeStatsCrossResponseV2:
    buckets: dict[tuple[str, str, str], list] = defaultdict(list)
    for fact in apply_category_filter(load_practice_facts(session, user_id=user.id, type_name=type_name), category=category):
        if difficulty is not None and fact.difficulty != difficulty:
            continue
        key, label = infer_cross_row_key(fact=fact, category=category)
        buckets[(key, label, fact.difficulty)].append(fact)
    items = [
        PracticeStatsCrossItemV2(
            category_key=key,
            label=label,
            difficulty=cast(Literal["easy", "medium", "hard", "unknown"], bucket_difficulty),
            total_questions=sum(fact.total_questions for fact in facts),
            correct_count=sum(fact.correct_count for fact in facts),
            accuracy=round(sum(fact.correct_count for fact in facts) / sum(fact.graded_count for fact in facts), 4)
            if facts and facts[0].type == "xingce" and sum(fact.graded_count for fact in facts) > 0
            else round(sum(fact.score_value or 0.0 for fact in facts) / (len([fact for fact in facts if fact.score_value is not None]) * 100), 4)
            if any(fact.score_value is not None for fact in facts)
            else 0.0,
            total_sessions=len({fact.attempt_id for fact in facts}),
            total_minutes=int(round(sum(fact.total_minutes for fact in facts))),
            average_score=round(sum(fact.score_value or 0.0 for fact in facts) / len([fact for fact in facts if fact.score_value is not None]), 2)
            if any(fact.score_value is not None for fact in facts)
            else None,
        )
        for (key, label, bucket_difficulty), facts in sorted(buckets.items())
    ]
    return PracticeStatsCrossResponseV2(
        type=cast(Literal["xingce", "essay"], type_name),
        category=category,
        items=items,
    )
