from __future__ import annotations

import os
from pathlib import Path
from typing import Any, cast

import pytest

from _ai_feedback_support import mark_ai_question_answered, seed_ai_question
from _helpers.practice_content_support import (
    build_postgres_client,
    register_user,
    seed_completed_session,
    seed_paper,
)
from sikao_api.cron.question_accuracy_cron import recompute_question_accuracy
from sikao_api.db.models_v2 import QuestionV2


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_question_accuracy_cron_recomputes_real_exam_metrics_only_for_answered_questions(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="XC-CRON-ACC-001",
            title="Cron Accuracy Source",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Q1",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
                {
                    "prompt": "Q2",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "reading",
                },
            ],
        )
        seed_completed_session(
            client,
            user_id=user_id,
            paper_code="XC-CRON-ACC-001",
            answer_outcomes=[True],
        )
        seed_completed_session(
            client,
            user_id=user_id,
            paper_code="XC-CRON-ACC-001",
            answer_outcomes=[False],
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            updated = recompute_question_accuracy(session)
            session.commit()
            q1 = session.get(QuestionV2, question_ids[0])
            q2 = session.get(QuestionV2, question_ids[1])
            assert q1 is not None
            assert q2 is not None
            assert updated == 1
            assert q1.answer_count == 2
            assert q1.historical_accuracy == pytest.approx(0.5)
            assert q2.answer_count == 0
            assert q2.historical_accuracy == pytest.approx(0.5)


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_question_accuracy_cron_refreshes_ai_question_quality_from_ground_truth(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        source_question_id = seed_paper(
            client,
            paper_code="XC-CRON-ACC-002",
            title="AI Accuracy Source",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Source",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )[0]
        ai_question_id = seed_ai_question(
            client,
            source_question_id=source_question_id,
            prompt="AI drift target",
            item_no=2,
            answer_count=99,
        )

        reporter_a = register_user(client, email="cron-a@example.com", display_name="Cron A")
        mark_ai_question_answered(client, user_id=reporter_a, question_id=ai_question_id)
        first_report = client.post(
            f"/api/v2/practice/ai-questions/{ai_question_id}/feedback",
            json={"action": "report"},
        )
        assert first_report.status_code == 200, first_report.text

        reporter_b = register_user(client, email="cron-b@example.com", display_name="Cron B")
        mark_ai_question_answered(client, user_id=reporter_b, question_id=ai_question_id)
        second_report = client.post(
            f"/api/v2/practice/ai-questions/{ai_question_id}/feedback",
            json={"action": "report"},
        )
        assert second_report.status_code == 200, second_report.text

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            question = session.get(QuestionV2, ai_question_id)
            assert question is not None
            question.answer_count = 999
            question.historical_accuracy = 1.0
            question.report_count = 0
            question.quality_score = 5.0
            session.add(question)
            session.commit()

        with factory() as session:
            updated = recompute_question_accuracy(session)
            session.commit()
            question = session.get(QuestionV2, ai_question_id)
            assert question is not None
            assert updated >= 1
            assert question.answer_count == 2
            assert question.historical_accuracy == pytest.approx(1.0)
            assert question.report_count == 2
            assert question.quality_score == pytest.approx(4.0)


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_question_accuracy_cron_sets_zero_accuracy_when_no_graded_answers_exist(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-CRON-ACC-003",
            title="Ungraded Accuracy Source",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Ungraded",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )[0]
        seed_completed_session(
            client,
            user_id=user_id,
            paper_code="XC-CRON-ACC-003",
            answer_outcomes=[None],
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            updated = recompute_question_accuracy(session)
            session.commit()
            question = session.get(QuestionV2, question_id)
            assert question is not None
            assert updated == 1
            assert question.answer_count == 1
            assert question.historical_accuracy == 0.0
