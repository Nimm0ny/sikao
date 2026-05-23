from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

import pytest

from _ai_feedback_support import mark_ai_question_answered, seed_ai_question
from _helpers.practice_content_support import build_client, register_user, seed_paper
from sikao_api.db.models_v2 import AiGeneratedQuestionRequestV2, PracticeSessionV2, QuestionV2


def test_ai_question_feedback_floor_recomputes_after_submit_without_scheduler(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        source_ids = seed_paper(
            client,
            paper_code="XC-AI-FB-005",
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
            prompt="AI floor unlock target",
            item_no=2,
            answer_count=4,
        )

        support_user = register_user(client, email="unlock-support@example.com", display_name="Unlock Support")
        mark_ai_question_answered(client, user_id=support_user, question_id=question_id)

        reporter_a = register_user(client, email="unlock-a@example.com", display_name="Unlock A")
        mark_ai_question_answered(client, user_id=reporter_a, question_id=question_id)
        client.post(f"/api/v2/practice/ai-questions/{question_id}/feedback", json={"action": "report"})

        reporter_b = register_user(client, email="unlock-b@example.com", display_name="Unlock B")
        mark_ai_question_answered(client, user_id=reporter_b, question_id=question_id)
        client.post(f"/api/v2/practice/ai-questions/{question_id}/feedback", json={"action": "report"})

        reporter_c = register_user(client, email="unlock-c@example.com", display_name="Unlock C")
        mark_ai_question_answered(client, user_id=reporter_c, question_id=question_id)
        client.post(f"/api/v2/practice/ai-questions/{question_id}/feedback", json={"action": "report"})

        user_target = register_user(client, email="target@example.com", display_name="Target User")
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            question = session.get(QuestionV2, question_id)
            assert question is not None
            assert question.quality_score == 4.0
            request_row = AiGeneratedQuestionRequestV2(
                user_id=user_target,
                request_params={"type": "xingce"},
                status="partial_pool",
                pool_question_ids=[question_id],
                completed_at=datetime.now(UTC).replace(tzinfo=None),
                duration_ms=1,
            )
            session.add(request_row)
            session.commit()
            request_id = request_row.id

        created = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": "ai_questions",
                "mode": "ai_generated",
                "config": {"aiRequestId": request_id},
            },
        )
        assert created.status_code == 200, created.text
        session_id = created.json()["id"]
        answer_key = created.json()["items"][0]["questionKey"]
        saved = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={"answers": [{"questionKey": answer_key, "answer": {"selected": ["A"]}}]},
        )
        assert saved.status_code == 200, saved.text
        submitted = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        assert submitted.status_code == 200, submitted.text

        with factory() as session:
            question = session.get(QuestionV2, question_id)
            assert question is not None
            assert question.answer_count == 5
            assert question.quality_score == 3.5


def test_submit_rolls_back_when_sync_progress_hooks_fail(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        source_ids = seed_paper(
            client,
            paper_code="XC-AI-FB-006",
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
            prompt="AI rollback target",
            item_no=2,
            answer_count=0,
        )
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            request_row = AiGeneratedQuestionRequestV2(
                user_id=user_id,
                request_params={"type": "xingce"},
                status="partial_pool",
                pool_question_ids=[question_id],
                completed_at=datetime.now(UTC).replace(tzinfo=None),
                duration_ms=1,
            )
            session.add(request_row)
            session.commit()
            request_id = request_row.id

        created = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": "ai_questions",
                "mode": "ai_generated",
                "config": {"aiRequestId": request_id},
            },
        )
        assert created.status_code == 200, created.text
        session_id = created.json()["id"]
        answer_key = created.json()["items"][0]["questionKey"]
        saved = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={"answers": [{"questionKey": answer_key, "answer": {"selected": ["A"]}}]},
        )
        assert saved.status_code == 200, saved.text

        def _raise_hooks(*_args: object, **_kwargs: object) -> None:
            raise RuntimeError("hook boom")

        monkeypatch.setattr(
            "sikao_api.modules.session.interface.routes.run_progress_submit_hooks",
            _raise_hooks,
        )

        with pytest.raises(RuntimeError, match="hook boom"):
            client.post(f"/api/v2/practice/sessions/{session_id}/submit")

        with factory() as session:
            practice_session = session.get(PracticeSessionV2, session_id)
            assert practice_session is not None
            assert practice_session.status != "submitted"
