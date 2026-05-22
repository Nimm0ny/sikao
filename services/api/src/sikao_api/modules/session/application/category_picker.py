from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import QuestionV2
from sikao_api.modules.session.application.custom_picker import pick_custom_questions
from sikao_api.modules.system.application.errors import ValidationError


def pick_category_questions(
    session: Session,
    *,
    user_id: int,
    track: str,
    config: dict[str, Any],
) -> tuple[list[QuestionV2], dict[str, Any]]:
    category_l1 = config.get("category_l1")
    if not isinstance(category_l1, str) or not category_l1:
        raise ValidationError("category mode requires category_l1", code="practice_session_category_required")
    questions, snapshot = pick_custom_questions(
        session,
        user_id=user_id,
        track=track,
        config={
            "category_l1": category_l1,
            "category_l2": config.get("category_l2"),
            "count": config.get("count", 10),
            "difficulty_range": config.get("difficulty_range", [0.0, 1.0]),
            "exclude_done": config.get("exclude_done", False),
            "only_wrong": config.get("only_wrong", False),
            "year_range": config.get("year_range", "all"),
        },
    )
    return questions, snapshot
