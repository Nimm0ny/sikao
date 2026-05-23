from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast

from sikao_api.db.content_hash import compute_question_content_hash
from sikao_api.db.models_v2 import PracticeSessionAnswerV2, PracticeSessionV2, QuestionV2


def seed_ai_question(
    client,
    *,
    source_question_id: int,
    prompt: str,
    item_no: int,
    source: str = "ai_generated",
    answer_count: int = 0,
) -> int:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        source_question = session.get(QuestionV2, source_question_id)
        assert source_question is not None
        content_json = {
            "stem": prompt,
            "options": {
                "A": "Option A",
                "B": "Option B",
                "C": "Option C",
                "D": "Option D",
            },
            "correct_answer": "A",
            "explanation": "Stub explanation for ai feedback coverage.",
        }
        question = QuestionV2(
            revision_id=source_question.revision_id,
            section_id=None,
            block_id=None,
            material_group_id=None,
            item_no=item_no,
            subject_kind=source_question.subject_kind,
            prompt=prompt,
            answer_kind="single_choice",
            status="published",
            content_json=content_json,
            source=source,
            year=source_question.year,
            region=source_question.region,
            exam_type=source_question.exam_type,
            category_l1=source_question.category_l1,
            category_l2=source_question.category_l2,
            historical_accuracy=0.4,
            answer_count=answer_count,
            quality_score=5.0,
            report_count=0,
            is_active=True,
            content_hash=compute_question_content_hash(prompt, content_json),
            ai_source_question_id=source_question.id,
            ai_self_audit_passed=True,
            ai_generated_at=datetime.now(UTC).replace(tzinfo=None),
        )
        session.add(question)
        session.commit()
        return question.id


def mark_ai_question_answered(client, *, user_id: int, question_id: int) -> None:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        practice_session = PracticeSessionV2(
            user_id=user_id,
            track="xingce",
            entry_kind="ai_questions",
            status="submitted",
            paper_id=None,
            revision_id=None,
            payload_json={},
            practice_mode="full_set",
            source_mode="ai_generated",
        )
        session.add(practice_session)
        session.flush()
        session.add(
            PracticeSessionAnswerV2(
                session_id=practice_session.id,
                question_id=question_id,
                question_key=str(question_id),
                display_order=1,
                response_json={"selected": ["A"]},
                is_correct=True,
                answered_at=datetime.now(UTC).replace(tzinfo=None),
            )
        )
        session.commit()

