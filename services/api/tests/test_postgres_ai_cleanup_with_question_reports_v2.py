from __future__ import annotations

import os
from pathlib import Path
from typing import Any, cast

import pytest

from _ai_feedback_support import seed_ai_question
from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.cron.ai_cleanup_cron import cleanup_low_quality_ai_questions
from sikao_api.db.models_v2 import AuditLogV2, QuestionV2


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_ai_cleanup_uses_question_report_aggregation(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        source_question_id, real_exam_question_id = seed_paper(
            client,
            paper_code="XC-AI-CLEAN-REPORT-01",
            title="AI Cleanup With Reports",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "AI source question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
                {
                    "prompt": "Real exam report target",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
            ],
        )
        ai_question_id = seed_ai_question(
            client,
            source_question_id=source_question_id,
            prompt="AI report target",
            item_no=3,
            answer_count=8,
        )

        for idx in range(5):
            register_user(
                client,
                email=f"ai-report-{idx}@example.com",
                display_name=f"AI Reporter {idx}",
            )
            response = client.post(
                f"/api/v2/practice/questions/{ai_question_id}/reports",
                json={
                    "category": "answer_disputed",
                    "description": f"AI issue report number {idx} is substantive enough.",
                },
            )
            assert response.status_code == 200, response.text

        register_user(
            client,
            email="real-report@example.com",
            display_name="Real Reporter",
        )
        real_report = client.post(
            f"/api/v2/practice/questions/{real_exam_question_id}/reports",
            json={
                "category": "explanation_wrong",
                "description": "The real-exam explanation should surface in admin backlog only.",
            },
        )
        assert real_report.status_code == 200, real_report.text

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            cleaned = cleanup_low_quality_ai_questions(session)
            session.commit()

            ai_question = session.get(QuestionV2, ai_question_id)
            real_question = session.get(QuestionV2, real_exam_question_id)
            audits = list(
                session.query(AuditLogV2)
                .filter_by(action="ai_question.auto_offline")
                .order_by(AuditLogV2.id.asc())
            )

            assert ai_question is not None
            assert real_question is not None
            assert cleaned == 1
            assert ai_question.report_count == 5
            assert ai_question.is_active is False
            assert real_question.report_count == 1
            assert real_question.is_active is True
            assert [audit.target_id for audit in audits] == [ai_question_id]
            assert audits[0].metadata_json["reason"] == "report_count>=5"
