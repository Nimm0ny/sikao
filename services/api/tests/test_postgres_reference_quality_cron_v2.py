from __future__ import annotations

import os
from pathlib import Path
from typing import Any, cast

import pytest

from _helpers.essay_grading_route_v2_support import seed_essay_question, seed_reference_answer
from _helpers.practice_content_support import build_postgres_client
from sikao_api.cron.reference_quality_cron import recompute_reference_quality
from sikao_api.db.models_v2 import AuditLogV2, EssayReferenceAnswerV2


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_reference_quality_cron_promotes_draft_when_feedback_threshold_met(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        question_id = seed_essay_question(client, paper_code="ESSAY-RQ-001")
        reference_id = seed_reference_answer(
            client,
            question_id=question_id,
            source="ai_generated",
            status="draft",
            quality_score=5.0,
            content="Draft AI reference",
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            reference = session.get(EssayReferenceAnswerV2, reference_id)
            assert reference is not None
            reference.likes_count = 3
            reference.favorites_count = 0
            reference.report_count = 0
            reference.ai_self_audit_passed = True
            session.add(reference)
            session.commit()

        with factory() as session:
            result = recompute_reference_quality(session)
            session.commit()
            reference = session.get(EssayReferenceAnswerV2, reference_id)
            audit = session.query(AuditLogV2).filter_by(
                action="reference.status_change",
                target_type="essay_reference_answer_v2",
                target_id=reference_id,
            ).one()
            assert result.published_count == 1
            assert reference is not None
            assert reference.status == "public"
            assert reference.published_at is not None
            assert reference.quality_score == pytest.approx(5.0)
            assert audit.metadata_json["reason"] == "quality_published"
            assert audit.before == {
                "status": "draft",
                "quality_score": 5.0,
                "report_count": 0,
            }
            assert audit.after == {
                "status": "public",
                "quality_score": 5.0,
            }


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_reference_quality_cron_promotes_draft_on_favorite_threshold(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        question_id = seed_essay_question(client, paper_code="ESSAY-RQ-001B")
        reference_id = seed_reference_answer(
            client,
            question_id=question_id,
            source="user_contributed",
            status="draft",
            quality_score=5.0,
            content="Draft user reference",
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            reference = session.get(EssayReferenceAnswerV2, reference_id)
            assert reference is not None
            reference.likes_count = 0
            reference.favorites_count = 2
            reference.report_count = 0
            session.add(reference)
            session.commit()

        with factory() as session:
            result = recompute_reference_quality(session)
            session.commit()
            reference = session.get(EssayReferenceAnswerV2, reference_id)
            assert result.published_count == 1
            assert reference is not None
            assert reference.status == "public"
            assert reference.published_at is not None


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_reference_quality_cron_archives_public_ai_reference_on_thresholds(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        question_id = seed_essay_question(client, paper_code="ESSAY-RQ-002")
        report_threshold_id = seed_reference_answer(
            client,
            question_id=question_id,
            source="ai_generated",
            status="public",
            quality_score=5.0,
            content="Report threshold",
        )
        low_quality_id = seed_reference_answer(
            client,
            question_id=question_id,
            source="ai_generated",
            status="public",
            quality_score=5.0,
            content="Low quality threshold",
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            report_threshold = session.get(EssayReferenceAnswerV2, report_threshold_id)
            low_quality = session.get(EssayReferenceAnswerV2, low_quality_id)
            assert report_threshold is not None
            assert low_quality is not None
            report_threshold.report_count = 5
            report_threshold.published_at = None
            low_quality.report_count = 6
            low_quality.published_at = None
            session.add(report_threshold)
            session.add(low_quality)
            session.commit()

        with factory() as session:
            result = recompute_reference_quality(session)
            session.commit()
            report_threshold = session.get(EssayReferenceAnswerV2, report_threshold_id)
            low_quality = session.get(EssayReferenceAnswerV2, low_quality_id)
            audits = list(
                session.query(AuditLogV2)
                .filter(
                    AuditLogV2.action == "reference.status_change",
                    AuditLogV2.target_id.in_([report_threshold_id, low_quality_id]),
                )
                .order_by(AuditLogV2.target_id.asc())
            )
            assert result.archived_count == 2
            assert report_threshold is not None
            assert low_quality is not None
            assert report_threshold.status == "archived"
            assert low_quality.status == "archived"
            assert report_threshold.quality_score == pytest.approx(2.5)
            assert low_quality.quality_score == pytest.approx(2.0)
            assert audits[0].metadata_json["reason"] == "report_count>=5"
            assert audits[1].metadata_json["reason"] == "quality_score<2.5"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_reference_quality_cron_archives_when_ai_self_audit_failed_and_preserves_published_at(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        question_id = seed_essay_question(client, paper_code="ESSAY-RQ-002B")
        reference_id = seed_reference_answer(
            client,
            question_id=question_id,
            source="ai_generated",
            status="public",
            quality_score=5.0,
            content="Audit failed public",
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            reference = session.get(EssayReferenceAnswerV2, reference_id)
            assert reference is not None
            reference.ai_self_audit_passed = False
            reference.published_at = reference.updated_at
            session.add(reference)
            session.commit()
            published_at = reference.published_at

        with factory() as session:
            result = recompute_reference_quality(session)
            session.commit()
            reference = session.get(EssayReferenceAnswerV2, reference_id)
            audit = session.query(AuditLogV2).filter_by(
                action="reference.status_change",
                target_type="essay_reference_answer_v2",
                target_id=reference_id,
            ).one()
            assert result.archived_count == 1
            assert reference is not None
            assert reference.status == "archived"
            assert reference.published_at == published_at
            assert audit.metadata_json["reason"] == "ai_self_audit_failed"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_reference_quality_cron_recomputes_official_score_without_status_change(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        question_id = seed_essay_question(client, paper_code="ESSAY-RQ-003")
        reference_id = seed_reference_answer(
            client,
            question_id=question_id,
            source="official",
            status="public",
            quality_score=1.0,
            content="Official reference",
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            reference = session.get(EssayReferenceAnswerV2, reference_id)
            assert reference is not None
            reference.likes_count = 2
            reference.favorites_count = 1
            reference.report_count = 1
            session.add(reference)
            session.commit()

        with factory() as session:
            result = recompute_reference_quality(session)
            session.commit()
            reference = session.get(EssayReferenceAnswerV2, reference_id)
            audits = list(
                session.query(AuditLogV2).filter_by(
                    action="reference.status_change",
                    target_type="essay_reference_answer_v2",
                    target_id=reference_id,
                )
            )
            assert result.updated_count == 1
            assert reference is not None
            assert reference.status == "public"
            assert reference.quality_score == pytest.approx(4.75)
            assert reference.published_at is None
            assert audits == []
