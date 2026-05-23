from __future__ import annotations

from pathlib import Path
from typing import Any, cast

from _ai_feedback_support import mark_ai_question_answered, seed_ai_question
from _helpers.practice_content_support import build_client, register_user, seed_paper
from sikao_api.db.models_v2 import AuditLogV2, QuestionV2


def test_ai_question_feedback_rejects_real_exam_questions(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        source_ids = seed_paper(
            client,
            paper_code="XC-AI-FB-001",
            title="AI Feedback Source",
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
        response = client.post(
            f"/api/v2/practice/ai-questions/{source_ids[0]}/feedback",
            json={"action": "like"},
        )
        assert response.status_code == 422, response.text
        assert response.json()["code"] == "ai_question_feedback_invalid_source"


def test_ai_question_feedback_report_and_like_are_idempotent(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        source_ids = seed_paper(
            client,
            paper_code="XC-AI-FB-002",
            title="AI Feedback Source",
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
        question_id = seed_ai_question(
            client,
            source_question_id=source_ids[0],
            prompt="AI feedback target",
            item_no=2,
            answer_count=8,
        )
        mark_ai_question_answered(client, user_id=user_id, question_id=question_id)
        first_report = client.post(
            f"/api/v2/practice/ai-questions/{question_id}/feedback",
            json={"action": "report", "note": "bad distractor"},
        )
        assert first_report.status_code == 200, first_report.text
        assert first_report.json()["reportCount"] == 1
        assert first_report.json()["qualityScore"] == 4.5

        duplicate_report = client.post(
            f"/api/v2/practice/ai-questions/{question_id}/feedback",
            json={"action": "report", "note": "bad distractor"},
        )
        assert duplicate_report.status_code == 200, duplicate_report.text
        assert duplicate_report.json()["reportCount"] == 1
        assert duplicate_report.json()["qualityScore"] == 4.5

        like = client.post(
            f"/api/v2/practice/ai-questions/{question_id}/feedback",
            json={"action": "like"},
        )
        assert like.status_code == 200, like.text
        assert like.json()["reportCount"] == 1
        assert like.json()["qualityScore"] == 4.55

        duplicate_like = client.post(
            f"/api/v2/practice/ai-questions/{question_id}/feedback",
            json={"action": "like"},
        )
        assert duplicate_like.status_code == 200, duplicate_like.text
        assert duplicate_like.json()["qualityScore"] == 4.55

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            question = session.get(QuestionV2, question_id)
            assert question is not None
            assert question.report_count == 1
            assert question.quality_score == 4.55
            audits = list(
                session.query(AuditLogV2)
                .filter(
                    AuditLogV2.user_id == user_id,
                    AuditLogV2.target_type == "question_v2",
                    AuditLogV2.target_id == question_id,
                )
                .order_by(AuditLogV2.id.asc())
            )
            actions = [audit.action for audit in audits]
            assert actions.count("ai_question.feedback.report") == 1
            assert actions.count("ai_question.feedback.like") == 1


def test_ai_question_feedback_requires_answer_history(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        source_ids = seed_paper(
            client,
            paper_code="XC-AI-FB-004",
            title="AI Feedback Source",
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
        question_id = seed_ai_question(
            client,
            source_question_id=source_ids[0],
            prompt="AI feedback answer gate target",
            item_no=2,
            answer_count=8,
        )
        response = client.post(
            f"/api/v2/practice/ai-questions/{question_id}/feedback",
            json={"action": "report"},
        )
        assert response.status_code == 404, response.text
        assert response.json()["code"] == "ai_question_feedback_not_allowed"


def test_ai_question_feedback_low_sample_count_floors_quality(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_a = register_user(client, email="reporter-a@example.com", display_name="Reporter A")
        source_ids = seed_paper(
            client,
            paper_code="XC-AI-FB-003",
            title="AI Feedback Source",
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
        question_id = seed_ai_question(
            client,
            source_question_id=source_ids[0],
            prompt="AI low sample feedback target",
            item_no=2,
            answer_count=0,
        )
        mark_ai_question_answered(client, user_id=user_a, question_id=question_id)
        client.post(
            f"/api/v2/practice/ai-questions/{question_id}/feedback",
            json={"action": "report"},
        )
        user_b = register_user(client, email="reporter-b@example.com", display_name="Reporter B")
        mark_ai_question_answered(client, user_id=user_b, question_id=question_id)
        client.post(
            f"/api/v2/practice/ai-questions/{question_id}/feedback",
            json={"action": "report"},
        )
        user_c = register_user(client, email="reporter-c@example.com", display_name="Reporter C")
        mark_ai_question_answered(client, user_id=user_c, question_id=question_id)
        client.post(
            f"/api/v2/practice/ai-questions/{question_id}/feedback",
            json={"action": "report"},
        )
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            question = session.get(QuestionV2, question_id)
            assert question is not None
            assert question.quality_score == 4.0

