from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Any, cast

import pytest
from sqlalchemy import select

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import PlanV2, PracticeSessionAnswerV2, PracticeSessionV2, ReviewItemV2, UserV2


def _seed_active_plan(client, *, display_name: str = "Content User") -> int:  # type: ignore[no-untyped-def]
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        user = session.scalar(select(UserV2).where(UserV2.display_name == display_name))
        assert user is not None
        session.add(
            PlanV2(
                user_id=user.id,
                name="Review cross-tab plan",
                target_exam_id="guokao-2027",
                target_exam_date=datetime(2027, 11, 26).date(),
                daily_minutes_target=180,
                style="balanced",
                baseline={},
                focus_subjects=["xingce"],
                status="active",
                source="user_manual",
                change_log=[],
            )
        )
        session.commit()
        return user.id


def _review_rows(client) -> list[ReviewItemV2]:  # type: ignore[no-untyped-def]
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        rows = list(session.query(ReviewItemV2).order_by(ReviewItemV2.id.asc()))
        for row in rows:
            session.expunge(row)
        return rows


def _answer_rows(client) -> list[PracticeSessionAnswerV2]:  # type: ignore[no-untyped-def]
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        rows = list(session.query(PracticeSessionAnswerV2).order_by(PracticeSessionAnswerV2.id.asc()))
        for row in rows:
            session.expunge(row)
        return rows


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_cross_tab_review_wrong_answer_probation_failure_and_add_to_plan_flow(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        _seed_active_plan(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-CROSS-001",
            title="Cross-tab review source",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Cross-tab question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                    "correct_answer": "B",
                    "options": ["A", "B", "C", "D"],
                }
            ],
        )[0]

        # 1. Practice wrong answer -> Review queue visible.
        created = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": "paper",
                "paperCode": "XC-REVIEW-CROSS-001",
                "practiceMode": "full_set",
            },
        )
        assert created.status_code == 200, created.text
        practice_session_id = created.json()["id"]
        answer_key = created.json()["items"][0]["questionKey"]

        saved = client.post(
            f"/api/v2/practice/sessions/{practice_session_id}/answers",
            json={"answers": [{"questionKey": answer_key, "answer": {"selected": ["A"]}}]},
        )
        assert saved.status_code == 200, saved.text
        submitted = client.post(f"/api/v2/practice/sessions/{practice_session_id}/submit")
        assert submitted.status_code == 200, submitted.text

        answers = _answer_rows(client)
        assert len(answers) == 1
        assert answers[0].is_correct is False

        review_rows = _review_rows(client)
        wrong_rows = [row for row in review_rows if row.source_kind == "wrong_answer"]
        assert len(wrong_rows) == 1
        assert wrong_rows[0].status == "pending"

        # 2. mark_resolved -> probationary, then fail again -> re_failed row created.
        graduated = client.patch(f"/api/v2/review/items/{wrong_rows[0].id}/graduate")
        assert graduated.status_code == 200, graduated.text

        retry_created = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": "paper",
                "paperCode": "XC-REVIEW-CROSS-001",
                "practiceMode": "full_set",
            },
        )
        assert retry_created.status_code == 200, retry_created.text
        retry_session_id = retry_created.json()["id"]
        retry_answer_key = retry_created.json()["items"][0]["questionKey"]
        retry_saved = client.post(
            f"/api/v2/practice/sessions/{retry_session_id}/answers",
            json={"answers": [{"questionKey": retry_answer_key, "answer": {"selected": ["A"]}}]},
        )
        assert retry_saved.status_code == 200, retry_saved.text
        retry_submitted = client.post(f"/api/v2/practice/sessions/{retry_session_id}/submit")
        assert retry_submitted.status_code == 200, retry_submitted.text

        review_rows = _review_rows(client)
        probationary_rows = [row for row in review_rows if row.status == "probationary"]
        re_failed_rows = [row for row in review_rows if row.source_kind == "re_failed" and row.status == "pending"]
        assert len(probationary_rows) == 1
        assert len(re_failed_rows) == 1
        assert re_failed_rows[0].metadata_json["originalReviewItemId"] == probationary_rows[0].id
        assert re_failed_rows[0].metadata_json["triggeredFromStatus"] == "probationary"

        # 3. Add to plan -> recommendation accept -> wrong_redo session.
        recommendation = client.post(f"/api/v2/review/items/{re_failed_rows[0].id}/add-to-plan")
        assert recommendation.status_code == 200, recommendation.text
        recommendation_id = recommendation.json()["id"]

        accepted = client.post(
            f"/api/v2/recommendations/{recommendation_id}/accept",
            json={"action": "session"},
        )
        assert accepted.status_code == 200, accepted.text
        body = accepted.json()
        assert body["sessionId"] is not None
        assert body["status"] == "accepted_session"

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            session_row = session.get(PracticeSessionV2, body["sessionId"])
            assert session_row is not None
            assert session_row.source_mode == "wrong_redo"
            assert session_row.practice_mode == "per_question"
            assert session_row.linked_recommendation_id == recommendation_id
            assert session_row.config_snapshot["review_item_ids"] == [re_failed_rows[0].id]
            answers = list(
                session.scalars(
                    select(PracticeSessionAnswerV2).where(PracticeSessionAnswerV2.session_id == body["sessionId"])
                )
            )
            assert len(answers) == 1
            assert answers[0].question_id == question_id
