from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeSessionAnswerV2, PracticeSessionV2, QuestionV2
from sikao_api.modules.system.application.errors import ValidationError

_YEAR_RANGE_MAP = {"recent_3": 3, "recent_5": 5, "recent_10": 10, "all": None}


def pick_custom_questions(
    session: Session,
    *,
    user_id: int,
    track: str,
    config: dict[str, Any],
) -> tuple[list[QuestionV2], dict[str, Any]]:
    count = _parse_count(config)
    stmt = select(QuestionV2).where(QuestionV2.subject_kind == track, QuestionV2.is_active.is_(True))
    year_range = str(config.get("year_range", "all"))
    if year_range not in _YEAR_RANGE_MAP:
        raise ValidationError("unsupported year_range", code="practice_session_bad_year_range")
    years = _YEAR_RANGE_MAP[year_range]
    if years is not None:
        cutoff = datetime.now(UTC).year - years + 1
        stmt = stmt.where(QuestionV2.year.is_not(None), QuestionV2.year >= cutoff)
    category_l1 = config.get("category_l1")
    if category_l1:
        stmt = stmt.where(QuestionV2.category_l1 == str(category_l1))
    category_l2 = config.get("category_l2")
    if category_l2:
        stmt = stmt.where(QuestionV2.category_l2 == str(category_l2))
    difficulty_range = _parse_difficulty_range(config)
    stmt = stmt.where(
        QuestionV2.historical_accuracy >= difficulty_range[0],
        QuestionV2.historical_accuracy <= difficulty_range[1],
    )
    candidates = list(session.scalars(stmt.order_by(QuestionV2.year.desc(), QuestionV2.id.asc())))
    answered_ids, wrong_ids = _load_user_answer_sets(session, user_id=user_id)
    if bool(config.get("exclude_done", False)):
        candidates = [question for question in candidates if question.id not in answered_ids]
    if bool(config.get("only_wrong", False)):
        candidates = [question for question in candidates if question.id in wrong_ids]
    selected = candidates[:count]
    if len(selected) != count:
        raise ValidationError("not enough questions for custom session", code="practice_session_insufficient_questions")
    snapshot = {
        "year_range": year_range,
        "difficulty_range": [difficulty_range[0], difficulty_range[1]],
        "count": count,
        "exclude_done": bool(config.get("exclude_done", False)),
        "only_wrong": bool(config.get("only_wrong", False)),
        "category_l1": category_l1,
        "category_l2": category_l2,
        "question_ids": [question.id for question in selected],
    }
    return selected, snapshot


def _parse_count(config: dict[str, Any]) -> int:
    count = int(config.get("count", 10))
    if count <= 0:
        raise ValidationError("count must be > 0", code="practice_session_bad_count")
    return count


def _parse_difficulty_range(config: dict[str, Any]) -> tuple[float, float]:
    raw = config.get("difficulty_range", [0.0, 1.0])
    if not isinstance(raw, list) or len(raw) != 2:
        raise ValidationError("difficulty_range must be [min, max]", code="practice_session_bad_difficulty_range")
    low = float(raw[0])
    high = float(raw[1])
    if low < 0.0 or high > 1.0 or low > high:
        raise ValidationError("difficulty_range must stay within [0.0, 1.0]", code="practice_session_bad_difficulty_range")
    return low, high


def _load_user_answer_sets(session: Session, *, user_id: int) -> tuple[set[int], set[int]]:
    rows = session.execute(
        select(PracticeSessionAnswerV2.question_id, PracticeSessionAnswerV2.response_json, PracticeSessionAnswerV2.is_correct)
        .join(PracticeSessionV2, PracticeSessionV2.id == PracticeSessionAnswerV2.session_id)
        .where(PracticeSessionV2.user_id == user_id, PracticeSessionV2.status == "submitted")
    ).all()
    answered_ids = {int(question_id) for question_id, response_json, _ in rows if question_id is not None and response_json not in ({}, None)}
    wrong_ids = {int(question_id) for question_id, _, is_correct in rows if question_id is not None and is_correct is False}
    return answered_ids, wrong_ids
