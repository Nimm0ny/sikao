from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeSessionAnswerV2, PracticeSessionV2, QuestionV2
from sikao_api.modules.ai_questions.domain.types import AiGenerateConfig
from sikao_api.modules.llm.application.question_generator import SourceQuestion


def _answered_question_ids_subquery(*, user_id: int) -> Select[tuple[int | None]]:
    return (
        select(PracticeSessionAnswerV2.question_id)
        .join(PracticeSessionV2, PracticeSessionV2.id == PracticeSessionAnswerV2.session_id)
        .where(
            PracticeSessionV2.user_id == user_id,
            PracticeSessionV2.status == "submitted",
            PracticeSessionAnswerV2.question_id.is_not(None),
        )
    )


def _wrong_question_ids_subquery(*, user_id: int) -> Select[tuple[int | None]]:
    return (
        select(PracticeSessionAnswerV2.question_id)
        .join(PracticeSessionV2, PracticeSessionV2.id == PracticeSessionAnswerV2.session_id)
        .where(
            PracticeSessionV2.user_id == user_id,
            PracticeSessionV2.status == "submitted",
            PracticeSessionAnswerV2.question_id.is_not(None),
            PracticeSessionAnswerV2.is_correct.is_(False),
        )
    )


def _apply_filters(
    stmt: Select[tuple[QuestionV2]],
    *,
    config: AiGenerateConfig,
    include_difficulty: bool = True,
) -> Select[tuple[QuestionV2]]:
    stmt = stmt.where(
        QuestionV2.subject_kind == config.type,
    )
    if include_difficulty:
        lower, upper = config.difficulty_range
        stmt = stmt.where(
            QuestionV2.historical_accuracy >= lower,
            QuestionV2.historical_accuracy <= upper,
        )
    if config.category_l1 is not None:
        stmt = stmt.where(QuestionV2.category_l1 == config.category_l1)
    if config.category_l2 is not None:
        stmt = stmt.where(QuestionV2.category_l2 == config.category_l2)
    current_year = datetime.now(UTC).year
    if config.year_range == "recent_3":
        stmt = stmt.where(QuestionV2.year.is_not(None), QuestionV2.year >= current_year - 2)
    elif config.year_range == "recent_5":
        stmt = stmt.where(QuestionV2.year.is_not(None), QuestionV2.year >= current_year - 4)
    elif config.year_range == "recent_10":
        stmt = stmt.where(QuestionV2.year.is_not(None), QuestionV2.year >= current_year - 9)
    return stmt


def load_answered_question_ids(
    session: Session,
    *,
    user_id: int,
    only_wrong: bool = False,
) -> set[int]:
    stmt = (
        _wrong_question_ids_subquery(user_id=user_id)
        if only_wrong
        else _answered_question_ids_subquery(user_id=user_id)
    )
    return {int(question_id) for question_id in session.scalars(stmt).all() if question_id is not None}


def query_pool_not_done(
    session: Session,
    *,
    config: AiGenerateConfig,
    limit: int,
) -> list[QuestionV2]:
    if config.only_wrong:
        return []
    done_ids = _answered_question_ids_subquery(user_id=config.user_id)
    stmt = (
        select(QuestionV2)
        .where(
            QuestionV2.source.in_(("ai_generated", "ai_modified")),
            QuestionV2.is_active.is_(True),
            QuestionV2.id.not_in(done_ids),
        )
        .order_by(func.random())
        .limit(limit)
    )
    stmt = _apply_filters(stmt, config=config)
    return list(session.scalars(stmt))


def query_pool_done(
    session: Session,
    *,
    config: AiGenerateConfig,
    limit: int,
    exclude_ids: list[int],
) -> list[QuestionV2]:
    done_ids = (
        _wrong_question_ids_subquery(user_id=config.user_id)
        if config.only_wrong
        else _answered_question_ids_subquery(user_id=config.user_id)
    )
    stmt = (
        select(QuestionV2)
        .where(
            QuestionV2.source.in_(("ai_generated", "ai_modified")),
            QuestionV2.is_active.is_(True),
            QuestionV2.id.in_(done_ids),
        )
        .order_by(func.random())
        .limit(limit)
    )
    if exclude_ids:
        stmt = stmt.where(QuestionV2.id.not_in(exclude_ids))
    stmt = _apply_filters(stmt, config=config)
    return list(session.scalars(stmt))


def pick_source_questions(
    session: Session,
    *,
    config: AiGenerateConfig,
    limit: int,
) -> list[SourceQuestion]:
    stmt = (
        select(QuestionV2)
        .where(
            QuestionV2.source == "real_exam",
            QuestionV2.is_active.is_(True),
            QuestionV2.subject_kind == config.type,
        )
        .order_by(func.random())
        .limit(limit)
    )
    stmt = _apply_filters(stmt, config=config, include_difficulty=False)
    questions = list(session.scalars(stmt))
    return [
        SourceQuestion(
            id=question.id,
            revision_id=question.revision_id,
            subject_kind=question.subject_kind,
            type=question.answer_kind,
            stem=question.prompt,
            options={
                "A": str(question.content_json.get("options", {}).get("A", "Option A")),
                "B": str(question.content_json.get("options", {}).get("B", "Option B")),
                "C": str(question.content_json.get("options", {}).get("C", "Option C")),
                "D": str(question.content_json.get("options", {}).get("D", "Option D")),
            },
            correct_answer=str(question.content_json.get("correct_answer", "A")),
            explanation=str(question.content_json.get("explanation", "")),
            category_l1=question.category_l1,
            category_l2=question.category_l2,
            year=question.year,
            region=question.region,
            exam_type=question.exam_type,
        )
        for question in questions
    ]
