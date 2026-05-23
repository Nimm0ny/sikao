from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast
from uuid import uuid4

from _helpers.practice_content_support import build_client, register_user, seed_paper
from sikao_api.db.content_hash import compute_question_content_hash
from sikao_api.db.models_v2 import AiGeneratedQuestionRequestV2, PaperRevisionV2, PracticeSessionAnswerV2, PracticeSessionV2, QuestionV2


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
            "explanation": "Stub explanation for ai generate route coverage.",
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


def _mark_ai_question_answered(client, *, user_id: int, question_id: int) -> None:
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


def test_ai_questions_generate_uses_pool_and_session_handoff(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        source_ids = seed_paper(
            client,
            paper_code="XC-AI-GEN-001",
            title="AI Generate Source",
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
        q1 = _seed_ai_question(client, source_question_id=source_ids[0], prompt="AI pool question 1", item_no=2)
        q2 = _seed_ai_question(client, source_question_id=source_ids[0], prompt="AI pool question 2", item_no=3)

        key = str(uuid4())
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
            headers={"Idempotency-Key": key},
        )
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["status"] == "partial_pool"
        assert sorted(payload["questionIds"]) == sorted([q1, q2])
        assert payload["poolCount"] == 2
        assert payload["llmGeneratedCount"] == 0

        replay = client.post(
            "/api/v2/practice/ai-questions/generate",
            json={
                "config": {
                    "type": "xingce",
                    "categoryL1": "verbal",
                    "difficultyRange": [0.0, 1.0],
                    "count": 2,
                }
            },
            headers={"Idempotency-Key": key},
        )
        assert replay.status_code == 200, replay.text
        assert replay.json() == payload

        detail = client.get(f"/api/v2/practice/ai-questions/requests/{payload['requestId']}")
        assert detail.status_code == 200, detail.text
        assert detail.json()["status"] == "partial_pool"
        assert sorted(detail.json()["poolQuestionIds"]) == sorted([q1, q2])
        assert detail.json()["llmCallId"] is None

        created_session = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": "ai_questions",
                "mode": "ai_generated",
                "config": {"aiRequestId": payload["requestId"]},
            },
        )
        assert created_session.status_code == 200, created_session.text
        session_payload = created_session.json()
        assert session_payload["sourceMode"] == "ai_generated"
        assert session_payload["configSnapshot"]["ai_request_id"] == payload["requestId"]
        assert len(session_payload["items"]) == 2


def test_ai_questions_generate_falls_back_to_llm_and_persists_questions(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        source_ids = seed_paper(
            client,
            paper_code="XC-AI-GEN-002",
            title="AI Generate LLM Source",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Source A",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
                {
                    "prompt": "Source B",
                    "year": 2023,
                    "region": "shanghai",
                    "exam_type": "municipal",
                    "category_l1": "verbal",
                    "category_l2": "reading",
                },
            ],
        )
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
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["status"] == "llm_generated"
        assert len(payload["questionIds"]) == 2
        assert payload["poolCount"] == 0
        assert payload["llmGeneratedCount"] == 2

        detail = client.get(f"/api/v2/practice/ai-questions/requests/{payload['requestId']}")
        assert detail.status_code == 200, detail.text
        assert detail.json()["llmCallId"] is not None
        assert detail.json()["llmSelfAuditPassedCount"] == 2

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            questions = list(
                session.query(QuestionV2)
                .filter(QuestionV2.id.in_(payload["questionIds"]))
                .order_by(QuestionV2.id.asc())
            )
            source_questions = list(
                session.query(QuestionV2)
                .filter(QuestionV2.id.in_(source_ids))
                .order_by(QuestionV2.id.asc())
            )
            request_row = session.get(AiGeneratedQuestionRequestV2, payload["requestId"])
            assert request_row is not None
            assert request_row.llm_call_id is not None
            assert len(questions) == 2
            assert {question.source for question in questions} == {"ai_generated"}
            assert all(question.content_hash is not None for question in questions)
            assert all(question.ai_self_audit_passed is True for question in questions)
            assert all(question.ai_source_question_id in source_ids for question in questions)
            assert all(question.revision_id not in {source.revision_id for source in source_questions} for question in questions)
            revisions = {
                revision.id: revision
                for revision in session.query(PaperRevisionV2)
                .filter(PaperRevisionV2.id.in_([question.revision_id for question in questions]))
                .all()
            }
            assert {revision.status for revision in revisions.values()} == {"draft"}

        papers = client.get("/api/v2/practice/xingce/papers")
        assert papers.status_code == 200, papers.text
        matching = [item for item in papers.json()["items"] if item["paperCode"] == "XC-AI-GEN-002"]
        assert len(matching) == 1
        assert matching[0]["questionCount"] == 2

        created_session = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": "ai_questions",
                "mode": "ai_generated",
                "config": {"aiRequestId": payload["requestId"]},
            },
        )
        assert created_session.status_code == 200, created_session.text
        assert created_session.json()["sourceMode"] == "ai_generated"
        assert len(created_session.json()["items"]) == 2


def test_ai_questions_generate_exclude_already_done_fails_instead_of_reusing_old_item(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        source_ids = seed_paper(
            client,
            paper_code="XC-AI-GEN-003",
            title="AI Generate Exclude Done",
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


def test_ai_questions_generate_rejects_essay_until_b22_2_lands(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        response = client.post(
            "/api/v2/practice/ai-questions/generate",
            json={
                "config": {
                    "type": "essay",
                    "difficultyRange": [0.0, 1.0],
                    "count": 2,
                }
            },
            headers={"Idempotency-Key": str(uuid4())},
        )
        assert response.status_code == 422, response.text
        assert response.json()["code"] == "ai_question_track_unsupported"
