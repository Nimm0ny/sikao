from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from sqlalchemy.orm import Session

from sqlalchemy import select

from sikao_api.db.models_v2 import PracticeSessionAnswerV2, PracticeSessionV2, QuestionFlagV2, QuestionV2
from sikao_api.db.schemas_v2 import PracticeSessionItemV2


def serialize_answer_item(
    session: Session,
    *,
    practice_session: PracticeSessionV2,
    answer: PracticeSessionAnswerV2,
) -> PracticeSessionItemV2:
    question = session.get(QuestionV2, answer.question_id) if answer.question_id is not None else None
    prompt = question.prompt if question is not None else "Phase 1 skeleton session item"
    answer_kind = question.answer_kind if question is not None else "placeholder"
    has_persistent_flag = False
    if answer.question_id is not None:
        has_persistent_flag = bool(
            session.scalar(
                select(QuestionFlagV2.id).where(
                    QuestionFlagV2.user_id == practice_session.user_id,
                    QuestionFlagV2.question_id == answer.question_id,
                    QuestionFlagV2.resolved_at.is_(None),
                )
            )
        )
    return PracticeSessionItemV2(
        id=str(answer.id),
        question_key=answer.question_key,
        prompt=prompt,
        answer_kind=answer_kind,
        status="answered" if has_meaningful_answer(answer.response_json) else "pending",
        flagged=answer.flagged,
        viewed_solution=answer.viewed_solution,
        has_persistent_flag=has_persistent_flag,
    )


def has_meaningful_answer(payload: Any) -> bool:
    if payload is None:
        return False
    if isinstance(payload, str):
        return payload.strip() != ""
    if isinstance(payload, Mapping):
        return any(has_meaningful_answer(value) for value in payload.values())
    if isinstance(payload, Sequence) and not isinstance(payload, (str, bytes, bytearray)):
        return any(has_meaningful_answer(value) for value in payload)
    return True
