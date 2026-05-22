from __future__ import annotations

from sqlalchemy.orm import Session

from sikao_api.modules.practice_stats.application.essay_facts import load_essay_facts
from sikao_api.modules.practice_stats.application.facts import PracticeStatFact
from sikao_api.modules.practice_stats.application.xingce_facts import load_xingce_facts


def load_practice_facts(
    session: Session,
    *,
    user_id: int,
    type_name: str,
) -> list[PracticeStatFact]:
    if type_name == "xingce":
        return load_xingce_facts(session, user_id=user_id)
    if type_name == "essay":
        return load_essay_facts(session, user_id=user_id)
    raise ValueError(f"unsupported practice stats type: {type_name}")
