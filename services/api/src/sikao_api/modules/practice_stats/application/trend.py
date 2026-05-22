from __future__ import annotations

from datetime import timedelta
from typing import Literal, cast

from sikao_api.modules.practice_stats.application.cells import build_trend_points
from sikao_api.modules.practice_stats.application.filters import apply_category_filter
from sikao_api.modules.practice_stats.application.facts import utc_now_naive
from sikao_api.modules.practice_stats.application.loaders import load_practice_facts
from sikao_api.modules.practice_stats.interface.schemas import PracticeStatsTrendResponseV2

_PERIOD_DAYS = {"7d": 7, "30d": 30, "90d": 90}


def build_stats_trend(session, *, user, type_name: str, category: str | None, period: str) -> PracticeStatsTrendResponseV2:
    cutoff = utc_now_naive() - timedelta(days=_PERIOD_DAYS[period])
    facts = [
        fact
        for fact in apply_category_filter(
            load_practice_facts(session, user_id=user.id, type_name=type_name),
            category=category,
        )
        if fact.practiced_at >= cutoff
    ]
    return PracticeStatsTrendResponseV2(
        type=cast(Literal["xingce", "essay"], type_name),
        category=category,
        period=cast(Literal["7d", "30d", "90d"], period),
        points=build_trend_points(facts=facts, limit=None),
    )
