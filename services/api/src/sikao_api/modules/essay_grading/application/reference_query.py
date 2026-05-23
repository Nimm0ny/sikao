from __future__ import annotations

from sqlalchemy import case, select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import EssayReferenceAnswerV2, QuestionV2
from sikao_api.db.schemas_v2 import EssayReferenceAnswerEnvelopeV2
from sikao_api.modules.system.application.errors import NotFoundError


def list_public_reference_answers(
    session: Session,
    *,
    question_id: int,
) -> list[EssayReferenceAnswerEnvelopeV2]:
    question = session.get(QuestionV2, question_id)
    if question is None:
        raise NotFoundError("question not found", code="question_not_found")

    rows = list(
        session.scalars(
            select(EssayReferenceAnswerV2)
            .where(
                EssayReferenceAnswerV2.question_id == question_id,
                EssayReferenceAnswerV2.status == "public",
            )
            .order_by(
                case(
                    (EssayReferenceAnswerV2.source == "official", 0),
                    (EssayReferenceAnswerV2.source == "user_contributed", 1),
                    else_=2,
                ),
                EssayReferenceAnswerV2.quality_score.desc(),
                EssayReferenceAnswerV2.id.asc(),
            )
        )
    )
    return [serialize_reference_answer(row) for row in rows]


def serialize_reference_answer(
    row: EssayReferenceAnswerV2,
) -> EssayReferenceAnswerEnvelopeV2:
    return EssayReferenceAnswerEnvelopeV2(
        id=row.id,
        question_id=row.question_id,
        content=row.content,
        source=row.source,
        likes_count=row.likes_count,
        favorites_count=row.favorites_count,
        report_count=row.report_count,
        quality_score=row.quality_score,
        status=row.status,
        published_at=row.published_at,
    )
