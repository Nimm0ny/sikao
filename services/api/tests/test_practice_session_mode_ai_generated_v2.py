from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

from _helpers.practice_content_support import build_client, register_user, seed_paper
from sikao_api.db.models_v2 import AiGeneratedQuestionRequestV2, QuestionV2


def test_ai_generated_session_requires_existing_request(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        response = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": "ai_questions",
                "mode": "ai_generated",
                "config": {"aiRequestId": 9999},
            },
        )
        assert response.status_code == 404, response.text
        assert response.json()["code"] == "ai_question_request_not_found"


def test_ai_generated_session_rejects_pending_request(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            request_row = AiGeneratedQuestionRequestV2(
                user_id=user_id,
                request_params={"type": "xingce"},
                status="pending",
            )
            session.add(request_row)
            session.commit()
            request_id = request_row.id

        response = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": "ai_questions",
                "mode": "ai_generated",
                "config": {"aiRequestId": request_id},
            },
        )
        assert response.status_code == 409, response.text
        assert response.json()["code"] == "ai_question_request_not_ready"


def test_ai_generated_session_rejects_track_mismatch(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        source_ids = seed_paper(
            client,
            paper_code="XC-AI-MODE-001",
            title="AI Mode Source",
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

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            source = session.get(QuestionV2, source_ids[0])
            assert source is not None
            ai_question = QuestionV2(
                revision_id=source.revision_id,
                section_id=None,
                block_id=None,
                material_group_id=None,
                item_no=2,
                subject_kind="xingce",
                prompt="AI question mismatch",
                answer_kind="single_choice",
                status="published",
                content_json={},
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
                ai_source_question_id=source.id,
                ai_self_audit_passed=True,
                ai_generated_at=datetime.now(UTC).replace(tzinfo=None),
            )
            session.add(ai_question)
            session.flush()
            request_row = AiGeneratedQuestionRequestV2(
                user_id=user_id,
                request_params={"type": "xingce"},
                status="partial_pool",
                pool_question_ids=[ai_question.id],
                completed_at=datetime.now(UTC).replace(tzinfo=None),
                duration_ms=1,
            )
            session.add(request_row)
            session.commit()
            request_id = request_row.id

        response = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "essay",
                "entryKind": "ai_questions",
                "mode": "ai_generated",
                "config": {"aiRequestId": request_id},
            },
        )
        assert response.status_code == 422, response.text
        assert response.json()["code"] == "practice_session_ai_track_mismatch"

