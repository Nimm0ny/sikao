from __future__ import annotations

import os
import threading
import time
from datetime import UTC, datetime
from typing import Any, cast

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.content_hash import compute_question_content_hash
from sikao_api.db.models_v2 import AuditLogV2, PracticeSessionAnswerV2, PracticeSessionV2, QuestionV2, UserV2
from sikao_api.modules.ai_questions.application.feedback import submit_feedback
from sikao_api.modules.ai_questions.interface.schemas import AiQuestionFeedbackRequestV2


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
            "explanation": "Stub explanation for ai feedback PG coverage.",
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
            source="ai_generated",
            year=source_question.year,
            region=source_question.region,
            exam_type=source_question.exam_type,
            category_l1=source_question.category_l1,
            category_l2=source_question.category_l2,
            historical_accuracy=0.4,
            answer_count=8,
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


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_ai_question_feedback_updates_quality_and_audit(tmp_path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        source_ids = seed_paper(
            client,
            paper_code="XC-AI-FB-PG-001",
            title="AI Feedback PG Source",
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
        question_id = _seed_ai_question(
            client,
            source_question_id=source_ids[0],
            prompt="AI feedback PG target",
            item_no=2,
        )
        _mark_ai_question_answered(client, user_id=user_id, question_id=question_id)
        report = client.post(
            f"/api/v2/practice/ai-questions/{question_id}/feedback",
            json={"action": "report", "note": "bad distractor"},
        )
        assert report.status_code == 200, report.text
        assert report.json()["reportCount"] == 1

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            question = session.get(QuestionV2, question_id)
            assert question is not None
            assert question.report_count == 1
            assert question.quality_score == 4.5
            audit = session.query(AuditLogV2).filter_by(
                user_id=user_id,
                action="ai_question.feedback.report",
                target_type="question_v2",
                target_id=question_id,
            ).one()
            assert audit.metadata_json["note"] == "bad distractor"


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_ai_question_feedback_report_is_serialized(tmp_path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        source_ids = seed_paper(
            client,
            paper_code="XC-AI-FB-PG-002",
            title="AI Feedback PG Source",
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
        question_id = _seed_ai_question(
            client,
            source_question_id=source_ids[0],
            prompt="AI feedback PG race target",
            item_no=2,
        )
        _mark_ai_question_answered(client, user_id=user_id, question_id=question_id)

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        started = threading.Event()
        allow_commit = threading.Event()
        second_done = threading.Event()

        def worker_one() -> None:
            with factory() as session:
                user = session.get(UserV2, user_id)
                assert user is not None
                submit_feedback(
                    session,
                    user=user,
                    question_id=question_id,
                    payload=AiQuestionFeedbackRequestV2(action="report", note="race"),
                    request_id=None,
                )
                started.set()
                allow_commit.wait(5)
                session.commit()

        def worker_two() -> None:
            started.wait(5)
            with factory() as session:
                user = session.get(UserV2, user_id)
                assert user is not None
                submit_feedback(
                    session,
                    user=user,
                    question_id=question_id,
                    payload=AiQuestionFeedbackRequestV2(action="report", note="race"),
                    request_id=None,
                )
                session.commit()
                second_done.set()

        thread_one = threading.Thread(target=worker_one)
        thread_two = threading.Thread(target=worker_two)
        thread_one.start()
        started.wait(5)
        thread_two.start()
        time.sleep(0.5)
        assert second_done.is_set() is False
        allow_commit.set()
        thread_one.join(timeout=5)
        thread_two.join(timeout=5)
        assert second_done.is_set() is True

        with factory() as session:
            question = session.get(QuestionV2, question_id)
            assert question is not None
            assert question.report_count == 1
            audits = (
                session.query(AuditLogV2)
                .filter_by(
                    user_id=user_id,
                    action="ai_question.feedback.report",
                    target_type="question_v2",
                    target_id=question_id,
                )
                .all()
            )
            assert len(audits) == 1
