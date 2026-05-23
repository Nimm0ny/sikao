from __future__ import annotations

import os
from pathlib import Path
from typing import Any, cast
from uuid import uuid4

import pytest

from _helpers.essay_grading_route_v2_support import (
    create_and_submit_essay_session,
    fake_grade_success,
    fake_reference_success,
    seed_essay_question,
    seed_reference_answer,
)
from _helpers.practice_content_support import build_postgres_client, register_user
from sikao_api.db.models_v2 import AuditLogV2, EssayReferenceFeedbackV2, EssaySubmissionV2
from sikao_api.modules.llm.application.essay_grader import EssayGradingTrace
from sikao_api.modules.llm.application.reference_answer_generator import ReferenceAnswerTrace


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_reference_list_orders_public_sources_and_quality(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_id = seed_essay_question(client, paper_code="ESSAY-REF-001")
        seed_reference_answer(
            client,
            question_id=question_id,
            source="ai_generated",
            status="public",
            quality_score=4.2,
            content="AI public",
        )
        seed_reference_answer(
            client,
            question_id=question_id,
            source="official",
            status="public",
            quality_score=1.0,
            content="Official public",
        )
        seed_reference_answer(
            client,
            question_id=question_id,
            source="user_contributed",
            status="public",
            quality_score=4.8,
            content="User public",
        )
        seed_reference_answer(
            client,
            question_id=question_id,
            source="ai_generated",
            status="archived",
            quality_score=5.0,
            content="AI archived",
        )

        response = client.get(
            f"/api/v2/practice/essay/questions/{question_id}/reference-answers"
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert [item["source"] for item in body] == [
            "official",
            "user_contributed",
            "ai_generated",
        ]
        assert [item["content"] for item in body] == [
            "Official public",
            "User public",
            "AI public",
        ]


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_reference_feedback_routes_update_counts(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        question_id = seed_essay_question(client, paper_code="ESSAY-REF-002")
        reference_id = seed_reference_answer(
            client,
            question_id=question_id,
            source="official",
            status="public",
            quality_score=5.0,
            content="Official public",
        )

        like = client.post(f"/api/v2/practice/essay/reference-answers/{reference_id}/like")
        assert like.status_code == 200, like.text
        assert like.json()["likesCount"] == 1

        like_again = client.post(
            f"/api/v2/practice/essay/reference-answers/{reference_id}/like"
        )
        assert like_again.status_code == 200, like_again.text
        assert like_again.json()["likesCount"] == 1

        unlike = client.delete(
            f"/api/v2/practice/essay/reference-answers/{reference_id}/like"
        )
        assert unlike.status_code == 200, unlike.text
        assert unlike.json()["likesCount"] == 0

        favorite = client.post(
            f"/api/v2/practice/essay/reference-answers/{reference_id}/favorite"
        )
        assert favorite.status_code == 200, favorite.text
        assert favorite.json()["favoritesCount"] == 1

        report = client.post(
            f"/api/v2/practice/essay/reference-answers/{reference_id}/report",
            json={"note": "引用不准确"},
        )
        assert report.status_code == 200, report.text
        assert report.json()["reportCount"] == 1

        report_again = client.post(
            f"/api/v2/practice/essay/reference-answers/{reference_id}/report",
            json={"note": "第二次举报不应改写原始备注"},
        )
        assert report_again.status_code == 200, report_again.text
        assert report_again.json()["reportCount"] == 1

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            rows = list(
                session.query(EssayReferenceFeedbackV2)
                .filter_by(reference_id=reference_id, user_id=user_id)
                .order_by(EssayReferenceFeedbackV2.action.asc())
            )
            assert [row.action for row in rows] == ["favorite", "report"]
            report_row = next(row for row in rows if row.action == "report")
            assert report_row.note == "引用不准确"
            audits = list(
                session.query(AuditLogV2)
                .filter(
                    AuditLogV2.target_type == "essay_reference_answer_v2",
                    AuditLogV2.target_id == reference_id,
                )
                .order_by(AuditLogV2.id.asc())
            )
            assert [audit.action for audit in audits] == [
                "reference.feedback.like",
                "reference.feedback.like",
                "reference.feedback.favorite",
                "reference.feedback.report",
            ]
            assert [audit.metadata_json.get("operation") for audit in audits] == [
                "create",
                "delete",
                "create",
                "create",
            ]


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_reference_generate_route_and_auto_hook(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with build_postgres_client(tmp_path) as client:
        async def grade_success(*args: Any, **kwargs: Any) -> EssayGradingTrace:
            return await fake_grade_success(*args, **kwargs)

        async def reference_success(*args: Any, **kwargs: Any) -> ReferenceAnswerTrace:
            return await fake_reference_success(*args, **kwargs)

        register_user(client)
        question_id = seed_essay_question(client, paper_code="ESSAY-REF-003")
        monkeypatch.setattr(
            "sikao_api.modules.essay_grading.application.background_grader.HomeLlmService.generate_reference_answer",
            reference_success,
        )

        queued = client.post(
            "/api/v2/practice/essay/reference-answers/generate",
            headers={"Idempotency-Key": str(uuid4())},
            json={"questionId": question_id},
        )
        assert queued.status_code == 200, queued.text
        assert queued.json()["status"] == "queued"

        listed = client.get(
            f"/api/v2/practice/essay/questions/{question_id}/reference-answers"
        )
        assert listed.status_code == 200, listed.text
        assert len(listed.json()) == 1
        assert listed.json()[0]["source"] == "ai_generated"
        assert listed.json()[0]["status"] == "public"

        exists = client.post(
            "/api/v2/practice/essay/reference-answers/generate",
            headers={"Idempotency-Key": str(uuid4())},
            json={"questionId": question_id},
        )
        assert exists.status_code == 200, exists.text
        assert exists.json()["status"] == "exists"

        session_id = create_and_submit_essay_session(
            client,
            paper_code="ESSAY-REF-003",
            answer_text="这是申论作答正文。" * 80,
        )
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            audits = list(
                session.query(AuditLogV2)
                .filter(AuditLogV2.action.like("reference.generate.%"))
                .order_by(AuditLogV2.id.asc())
            )
            assert [audit.action for audit in audits] == ["reference.generate.manual"]

            submission = session.query(EssaySubmissionV2).filter_by(
                practice_session_id=session_id
            ).one()
            submission_id = int(submission.id)

        monkeypatch.setattr(
            "sikao_api.modules.essay_grading.application.background_grader.HomeLlmService.grade_essay",
            grade_success,
        )
        trigger = client.post(
            f"/api/v2/practice/essay/submissions/{submission_id}/grade",
            headers={"Idempotency-Key": str(uuid4())},
        )
        assert trigger.status_code == 200, trigger.text

        result = client.get(
            f"/api/v2/practice/essay/submissions/{submission_id}/result"
        )
        assert result.status_code == 200, result.text
        assert result.json()["status"] == "graded"
        assert len(result.json()["referenceAnswers"]) == 1


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_reference_generate_allows_ai_reference_alongside_official(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with build_postgres_client(tmp_path) as client:
        async def reference_success(*args: Any, **kwargs: Any) -> ReferenceAnswerTrace:
            return await fake_reference_success(*args, **kwargs)

        register_user(client)
        question_id = seed_essay_question(client, paper_code="ESSAY-REF-007")
        seed_reference_answer(
            client,
            question_id=question_id,
            source="official",
            status="public",
            quality_score=5.0,
            content="Official public",
        )
        monkeypatch.setattr(
            "sikao_api.modules.essay_grading.application.reference_generator_runner.HomeLlmService.generate_reference_answer",
            reference_success,
        )

        queued = client.post(
            "/api/v2/practice/essay/reference-answers/generate",
            headers={"Idempotency-Key": str(uuid4())},
            json={"questionId": question_id},
        )
        assert queued.status_code == 200, queued.text
        assert queued.json()["status"] == "queued"

        listed = client.get(
            f"/api/v2/practice/essay/questions/{question_id}/reference-answers"
        )
        assert listed.status_code == 200, listed.text
        body = listed.json()
        assert [item["source"] for item in body] == ["official", "ai_generated"]
