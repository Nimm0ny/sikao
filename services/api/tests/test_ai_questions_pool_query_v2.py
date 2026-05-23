from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

from _helpers.practice_content_support import build_client, register_user, seed_paper
from sikao_api.db.content_hash import compute_question_content_hash
from sikao_api.db.models_v2 import PracticeSessionAnswerV2, PracticeSessionV2, QuestionV2
from sikao_api.modules.ai_questions.application.pool_query import query_pool_done, query_pool_not_done
from sikao_api.modules.ai_questions.domain.types import AiGenerateConfig


def _seed_ai_question(
    client,
    *,
    source_question_id: int,
    prompt: str,
    item_no: int,
) -> int:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        source = session.get(QuestionV2, source_question_id)
        assert source is not None
        content_json = {
            "stem": prompt,
            "options": {
                "A": "Option A",
                "B": "Option B",
                "C": "Option C",
                "D": "Option D",
            },
            "correct_answer": "A",
            "explanation": "Stub explanation for ai pool query coverage.",
        }
        question = QuestionV2(
            revision_id=source.revision_id,
            section_id=None,
            block_id=None,
            material_group_id=None,
            item_no=item_no,
            subject_kind=source.subject_kind,
            prompt=prompt,
            answer_kind="single_choice",
            status="published",
            content_json=content_json,
            source="ai_generated",
            year=source.year,
            region=source.region,
            exam_type=source.exam_type,
            category_l1=source.category_l1,
            category_l2=source.category_l2,
            historical_accuracy=0.4,
            answer_count=0,
            quality_score=5.0,
            report_count=0,
            is_active=True,
            content_hash=compute_question_content_hash(prompt, content_json),
            ai_source_question_id=source.id,
            ai_self_audit_passed=True,
            ai_generated_at=datetime.now(UTC).replace(tzinfo=None),
        )
        session.add(question)
        session.commit()
        return question.id


def _seed_ai_answer(client, *, user_id: int, question_id: int, is_correct: bool) -> None:
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
                is_correct=is_correct,
                answered_at=datetime.now(UTC).replace(tzinfo=None),
            )
        )
        session.commit()


def test_ai_questions_pool_query_respects_done_and_only_wrong(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        source_ids = seed_paper(
            client,
            paper_code="XC-AI-POOL-001",
            title="AI Pool Source",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Source A",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )
        q1 = _seed_ai_question(client, source_question_id=source_ids[0], prompt="AI question 1", item_no=2)
        q2 = _seed_ai_question(client, source_question_id=source_ids[0], prompt="AI question 2", item_no=3)
        q3 = _seed_ai_question(client, source_question_id=source_ids[0], prompt="AI question 3", item_no=4)

        _seed_ai_answer(client, user_id=user_id, question_id=q1, is_correct=True)
        _seed_ai_answer(client, user_id=user_id, question_id=q2, is_correct=False)

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            config = AiGenerateConfig(
                user_id=user_id,
                type="xingce",
                category_l1="verbal",
                category_l2=None,
                year_range="all",
                difficulty_range=(0.0, 1.0),
                count=3,
            )
            not_done = query_pool_not_done(session, config=config, limit=3)
            done = query_pool_done(session, config=config, limit=3, exclude_ids=[])
            wrong_only = query_pool_done(
                session,
                config=AiGenerateConfig(
                    user_id=user_id,
                    type="xingce",
                    category_l1="verbal",
                    category_l2=None,
                    year_range="all",
                    difficulty_range=(0.0, 1.0),
                    count=3,
                    only_wrong=True,
                ),
                limit=3,
                exclude_ids=[],
            )

        assert [question.id for question in not_done] == [q3]
        assert sorted(question.id for question in done) == sorted([q1, q2])
        assert [question.id for question in wrong_only] == [q2]

