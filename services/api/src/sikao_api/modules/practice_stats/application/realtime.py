from __future__ import annotations

from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import UserV2
from sikao_api.modules.practice_stats.application.cells import build_stats_response
from sikao_api.modules.practice_stats.application.filters import apply_category_filter
from sikao_api.modules.practice_stats.application.loaders import load_practice_facts
from sikao_api.modules.practice_stats.interface.schemas import PracticeStatsResponseV2


def build_realtime_stats(
    session: Session,
    *,
    user: UserV2,
    type_name: str,
    category: str | None,
) -> PracticeStatsResponseV2:
    facts = load_practice_facts(session, user_id=user.id, type_name=type_name)
    return build_stats_response(
        type_name=type_name,
        facts=apply_category_filter(facts, category=category),
    )
