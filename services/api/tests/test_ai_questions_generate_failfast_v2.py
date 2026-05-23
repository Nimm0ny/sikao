from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from typing import Any, cast
from uuid import uuid4

from _helpers.practice_content_support import build_client, register_user, seed_paper
from sikao_api.db.content_hash import compute_question_content_hash
from sikao_api.db.models_v2 import QuestionV2
from sikao_api.modules.system.application.errors import LLMServiceError


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
            "explanation": "Stub explanation for ai fail-fast route coverage.",
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
        )
        session.add(question)
        session.commit()
        return question.id


def _mark_ai_question_answered(client, *, user_id: int, question_id: int) -> None:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        from sikao_api.db.models_v2 import PracticeSessionAnswerV2, PracticeSessionV2

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
            )
        )
        session.commit()


def test_ai_questions_generate_exclude_done_insufficient_unseen_returns_503(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        source_ids = seed_paper(
            client,
            paper_code="XC-AI-GEN-FAIL-001",
            title="AI Generate Fail-Fast",
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
        old_ai_question = _seed_ai_question(
            client,
            source_question_id=source_ids[0],
            prompt="AI done question",
            item_no=2,
        )
        _mark_ai_question_answered(client, user_id=user_id, question_id=old_ai_question)

        from sikao_api.modules.ai_questions.application import service as ai_service_module

        original_generate_with_audit = ai_service_module.generate_with_audit
        original_save_with_dedupe = ai_service_module.save_with_dedupe
        ai_service_module.generate_with_audit = lambda *args, **kwargs: SimpleNamespace(  # type: ignore[assignment]
            questions=[object()],
            llm_call_id=123,
            self_audit_passed_count=1,
        )
        ai_service_module.save_with_dedupe = lambda *args, **kwargs: []  # type: ignore[assignment]

        try:
            response = client.post(
                "/api/v2/practice/ai-questions/generate",
                json={
                    "config": {
                        "type": "xingce",
                        "categoryL1": "verbal",
                        "difficultyRange": [0.0, 1.0],
                        "count": 2,
                        "excludeAlreadyDone": True,
                    }
                },
                headers={"Idempotency-Key": str(uuid4())},
            )
            assert response.status_code == 503, response.text
            assert response.json()["code"] == "AI_AUDIT_FAILED"
        finally:
            ai_service_module.generate_with_audit = original_generate_with_audit
            ai_service_module.save_with_dedupe = original_save_with_dedupe


def test_ai_questions_generate_audit_fail_returns_503(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        seed_paper(
            client,
            paper_code="XC-AI-GEN-FAIL-002",
            title="AI Generate Audit Fail",
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

        from sikao_api.modules.ai_questions.application import service as ai_service_module

        original_generate_with_audit = ai_service_module.generate_with_audit
        ai_service_module.generate_with_audit = lambda *args, **kwargs: (_ for _ in ()).throw(  # type: ignore[assignment]
            LLMServiceError(
                "question generation audit failed",
                code="AI_AUDIT_FAILED",
            )
        )
        try:
            response = client.post(
                "/api/v2/practice/ai-questions/generate",
                json={
                    "config": {
                        "type": "xingce",
                        "categoryL1": "verbal",
                        "difficultyRange": [0.0, 1.0],
                        "count": 2,
                    }
                },
                headers={"Idempotency-Key": str(uuid4())},
            )
            assert response.status_code == 503, response.text
            assert response.json()["code"] == "AI_AUDIT_FAILED"
        finally:
            ai_service_module.generate_with_audit = original_generate_with_audit
