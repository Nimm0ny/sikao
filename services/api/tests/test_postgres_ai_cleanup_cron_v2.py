from __future__ import annotations

import os
from pathlib import Path
from typing import Any, cast

import pytest

from _ai_feedback_support import mark_ai_question_answered, seed_ai_question
from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.cron.ai_cleanup_cron import cleanup_low_quality_ai_questions
from sikao_api.db.models_v2 import AuditLogV2, QuestionV2


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_ai_cleanup_cron_deactivates_low_quality_ai_questions_and_writes_audit(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        source_question_id = seed_paper(
            client,
            paper_code="XC-AI-CLEAN-001",
            title="AI Cleanup Source",
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
        auto_offline_id = seed_ai_question(
            client,
            source_question_id=source_question_id,
            prompt="AI auto offline target",
            item_no=2,
            answer_count=8,
        )
        safe_id = seed_ai_question(
            client,
            source_question_id=source_question_id,
            prompt="AI safe target",
            item_no=3,
            answer_count=8,
        )
        audit_fail_id = seed_ai_question(
            client,
            source_question_id=source_question_id,
            prompt="AI audit fail target",
            item_no=4,
            answer_count=0,
        )

        for idx in range(5):
            user_id = register_user(
                client,
                email=f"cleanup-{idx}@example.com",
                display_name=f"Cleanup {idx}",
            )
            mark_ai_question_answered(client, user_id=user_id, question_id=auto_offline_id)
            response = client.post(
                f"/api/v2/practice/ai-questions/{auto_offline_id}/feedback",
                json={"action": "report"},
            )
            assert response.status_code == 200, response.text

        supporter_id = register_user(
            client,
            email="cleanup-safe@example.com",
            display_name="Cleanup Safe",
        )
        mark_ai_question_answered(client, user_id=supporter_id, question_id=safe_id)
        like = client.post(
            f"/api/v2/practice/ai-questions/{safe_id}/feedback",
            json={"action": "like"},
        )
        assert like.status_code == 200, like.text

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            audit_fail = session.get(QuestionV2, audit_fail_id)
            assert audit_fail is not None
            audit_fail.ai_self_audit_passed = False
            session.add(audit_fail)
            session.commit()

        with factory() as session:
            cleaned = cleanup_low_quality_ai_questions(session)
            session.commit()
            auto_offline = session.get(QuestionV2, auto_offline_id)
            safe = session.get(QuestionV2, safe_id)
            audit_fail = session.get(QuestionV2, audit_fail_id)
            audits = list(
                session.query(AuditLogV2)
                .filter(AuditLogV2.action == "ai_question.auto_offline")
                .order_by(AuditLogV2.target_id.asc(), AuditLogV2.id.asc())
            )
            assert auto_offline is not None
            assert safe is not None
            assert audit_fail is not None
            assert cleaned == 2
            assert auto_offline.is_active is False
            assert auto_offline.report_count == 5
            assert safe.is_active is True
            assert audit_fail.is_active is False
            assert [audit.target_id for audit in audits] == [auto_offline_id, audit_fail_id]
            first_audit = audits[0]
            second_audit = audits[1]
            assert first_audit.before == {
                "is_active": True,
                "quality_score": pytest.approx(2.5),
                "report_count": 5,
                "ai_self_audit_passed": True,
            }
            assert first_audit.after == {"is_active": False}
            assert first_audit.metadata_json["reason"] == "report_count>=5"
            assert second_audit.metadata_json["reason"] == "ai_self_audit_failed"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_ai_cleanup_cron_ignores_real_exam_questions(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        real_exam_id = seed_paper(
            client,
            paper_code="XC-AI-CLEAN-002",
            title="Real Exam Source",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Real exam question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )[0]

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            question = session.get(QuestionV2, real_exam_id)
            assert question is not None
            question.quality_score = 0.0
            question.report_count = 99
            session.add(question)
            session.commit()

        with factory() as session:
            cleaned = cleanup_low_quality_ai_questions(session)
            session.commit()
            question = session.get(QuestionV2, real_exam_id)
            assert question is not None
            assert cleaned == 0
            assert question.is_active is True
