from __future__ import annotations

from sikao_api.modules.practice_stats.application.facts import PracticeStatFact, normalize_category_key


def apply_category_filter(facts: list[PracticeStatFact], *, category: str | None) -> list[PracticeStatFact]:
    if category is None:
        return facts
    if ":" in category:
        return [
            fact
            for fact in facts
            if normalize_category_key(fact.category_l1, fact.category_l2) == category
        ]
    return [fact for fact in facts if fact.category_l1 == category]


def infer_cross_row_key(*, fact: PracticeStatFact, category: str | None) -> tuple[str, str]:
    if category is None:
        return fact.category_l1, fact.category_l1
    if ":" in category:
        key = normalize_category_key(fact.category_l1, fact.category_l2)
        return key, fact.category_l2 or "uncategorized"
    return normalize_category_key(fact.category_l1, fact.category_l2), fact.category_l2 or "uncategorized"
