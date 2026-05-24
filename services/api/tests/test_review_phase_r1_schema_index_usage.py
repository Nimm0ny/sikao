from __future__ import annotations

from datetime import UTC, datetime, timedelta
import os

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from _helpers.postgres_temp_db import build_postgres_engine
from _review_phase_r1_support import explain_uses_index, render_url, run_alembic
from sikao_api.db.enums_v2 import CauseAnalysisScope, ReviewItemStatus, ReviewSourceKind
from sikao_api.db.models_v2 import (
    AiCauseAnalysisV2,
    LlmCallV2,
    PaperRevisionV2,
    PaperV2,
    QuestionV2,
    ReviewItemV2,
    UserV2,
)


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_review_r1_postgres_indexes_are_usable_on_populated_tables() -> None:
    with build_postgres_engine("sikao_review_r1_indexes") as engine:
        database_url = render_url(engine.url)
        upgrade = run_alembic(database_url, "upgrade", "head")
        assert upgrade.returncode == 0, upgrade.stderr or upgrade.stdout

        now = datetime.now(UTC).replace(tzinfo=None)
        with Session(engine) as session:
            user = UserV2(display_name="review-r1-index-user")
            session.add(user)
            session.flush()

            paper = PaperV2(paper_code="R1-PG-INDEX-01", title="Review R1 PG", subject_kind="xingce")
            session.add(paper)
            session.flush()
            revision = PaperRevisionV2(paper_id=paper.id, revision_number=1, status="published")
            session.add(revision)
            session.flush()
            question = QuestionV2(
                revision_id=revision.id,
                item_no=1,
                subject_kind="xingce",
                prompt="Index question",
                answer_kind="single_choice",
                status="published",
                content_json={"stem": "Index question"},
                source="real_exam",
                year=2026,
                region="beijing",
                exam_type="national",
                category_l1="verbal",
                category_l2="reading",
            )
            session.add(question)
            session.flush()

            session.add(
                ReviewItemV2(
                    user_id=user.id,
                    source_kind=ReviewSourceKind.WRONG_ANSWER.value,
                    title="Pending indexed item",
                    status=ReviewItemStatus.PENDING.value,
                    question_id=question.id,
                    correct_streak=1,
                    next_review_at=now + timedelta(days=1),
                    version=1,
                    metadata_json={"algorithm_version": "simple_v1"},
                )
            )
            session.add(
                ReviewItemV2(
                    user_id=user.id,
                    source_kind=ReviewSourceKind.WRONG_ANSWER.value,
                    title="Probationary indexed item",
                    status=ReviewItemStatus.PROBATIONARY.value,
                    question_id=question.id,
                    correct_streak=4,
                    next_review_at=now + timedelta(days=30),
                    version=1,
                    metadata_json={"algorithm_version": "simple_v1"},
                )
            )
            session.add(
                ReviewItemV2(
                    user_id=user.id,
                    source_kind=ReviewSourceKind.MANUAL_ADD.value,
                    title="Manual indexed item",
                    status=ReviewItemStatus.IN_PROGRESS.value,
                    question_id=question.id,
                    correct_streak=2,
                    next_review_at=now + timedelta(days=7),
                    version=1,
                    metadata_json={"algorithm_version": "simple_v1"},
                )
            )

            llm_call = LlmCallV2(
                user_id=user.id,
                purpose="review_cause_analysis",
                prompt_version="cause_analysis_single@v1",
                provider="mock",
                model="mock-model",
                latency_ms=1,
                request_payload={"questionId": question.id},
                parse_status="ok",
            )
            session.add(llm_call)
            session.flush()

            session.add(
                AiCauseAnalysisV2(
                    user_id=user.id,
                    scope=CauseAnalysisScope.SINGLE.value,
                    question_id=question.id,
                    input_hash="single-hash",
                    result_json={"summary": "single"},
                    llm_call_id=llm_call.id,
                    expires_at=now + timedelta(days=30),
                )
            )
            session.add(
                AiCauseAnalysisV2(
                    user_id=user.id,
                    scope=CauseAnalysisScope.GROUP.value,
                    question_ids_signature="group-signature",
                    input_hash="group-hash",
                    result_json={"summary": "group"},
                    llm_call_id=llm_call.id,
                    expires_at=now + timedelta(days=30),
                )
            )
            session.commit()
            user_id = int(user.id)
            question_id = int(question.id)

        with engine.begin() as connection:
            connection.execute(text("ANALYZE review_items_v2"))
            connection.execute(text("ANALYZE ai_cause_analysis_v2"))

        explain_uses_index(
            engine,
            "SELECT * FROM review_items_v2 WHERE user_id = :user_id AND status = 'probationary'",
            {"user_id": user_id},
            expected_index="ix_review_items_v2_user_status",
        )
        explain_uses_index(
            engine,
            "SELECT * FROM review_items_v2 WHERE user_id = :user_id AND next_review_at <= :deadline",
            {"user_id": user_id, "deadline": now + timedelta(days=2)},
            expected_index="ix_review_items_v2_user_next_review",
        )
        explain_uses_index(
            engine,
            "SELECT * FROM review_items_v2 WHERE user_id = :user_id AND source_kind = 'manual_add'",
            {"user_id": user_id},
            expected_index="ix_review_items_v2_user_source_kind",
        )
        explain_uses_index(
            engine,
            "SELECT * FROM review_items_v2 WHERE question_id = :question_id",
            {"question_id": question_id},
            expected_index="ix_review_items_v2_question",
        )
        explain_uses_index(
            engine,
            "SELECT * FROM ai_cause_analysis_v2 WHERE user_id = :user_id AND question_id = :question_id AND input_hash = 'single-hash'",
            {"user_id": user_id, "question_id": question_id},
            expected_index="ix_ai_cause_v2_user_question_hash",
        )
        explain_uses_index(
            engine,
            "SELECT * FROM ai_cause_analysis_v2 WHERE user_id = :user_id AND question_ids_signature = 'group-signature'",
            {"user_id": user_id},
            expected_index="ix_ai_cause_v2_user_signature",
        )
