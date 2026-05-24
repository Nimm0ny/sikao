from __future__ import annotations

from datetime import UTC, datetime, timedelta
import os
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from _helpers.postgres_temp_db import build_postgres_engine
from _review_phase_r1_support import pg_index_names, render_url, run_alembic
from sikao_api.core.config import Settings
from sikao_api.db.enums_v2 import CauseAnalysisScope
from sikao_api.db.models_v2 import AiCauseAnalysisV2, LlmCallV2, ReviewItemV2
from sikao_api.main import create_app


def _build_settings(tmp_path: Path, database_url: str) -> Settings:
    return Settings(
        app_env="test",
        database_url=database_url,
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="review-r1-secret",
        app_version="review-r1-test",
        git_sha="review-r1-sha",
        image_tag="review-r1-tag",
        build_time="2026-05-24T00:00:00Z",
        schema_version="review-r1-schema",
    )


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_review_r1_postgres_head_schema_and_runtime_smoke(tmp_path: Path) -> None:
    with build_postgres_engine("sikao_review_r1_head") as engine:
        database_url = render_url(engine.url)
        upgrade = run_alembic(database_url, "upgrade", "head")
        assert upgrade.returncode == 0, upgrade.stderr or upgrade.stdout

        inspector = inspect(engine)
        assert "ai_cause_analysis_v2" in inspector.get_table_names()
        review_columns = {column["name"]: column for column in inspector.get_columns("review_items_v2")}
        assert {"correct_streak", "next_review_at", "version"} <= set(review_columns)
        assert review_columns["correct_streak"]["nullable"] is False
        assert review_columns["version"]["nullable"] is False

        ai_columns = {column["name"] for column in inspector.get_columns("ai_cause_analysis_v2")}
        assert {
            "user_id",
            "scope",
            "question_id",
            "question_ids_signature",
            "input_hash",
            "result_json",
            "llm_call_id",
            "expires_at",
        } <= ai_columns

        assert {
            "ix_review_items_v2_user_created",
            "ix_review_items_v2_user_status",
            "ix_review_items_v2_user_next_review",
            "ix_review_items_v2_user_source_kind",
            "ix_review_items_v2_question",
        } <= pg_index_names(engine, "review_items_v2")
        assert {
            "ix_ai_cause_v2_user_question_hash",
            "ix_ai_cause_v2_user_signature",
            "ix_ai_cause_v2_expires",
        } <= pg_index_names(engine, "ai_cause_analysis_v2")

        app = create_app(settings=_build_settings(tmp_path, database_url), initialize_schema=False)
        with TestClient(app) as client:
            response = client.get("/version")
            assert response.status_code == 200, response.text


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_review_r1_postgres_roundtrip_preserves_legacy_rows() -> None:
    with build_postgres_engine("sikao_review_r1_roundtrip") as engine:
        database_url = render_url(engine.url)
        base_upgrade = run_alembic(database_url, "upgrade", "1026_question_report")
        assert base_upgrade.returncode == 0, base_upgrade.stderr or base_upgrade.stdout

        with engine.begin() as connection:
            user_id = connection.execute(
                text(
                    """
                    INSERT INTO users_v2 (public_id, display_name, is_active, created_at, updated_at)
                    VALUES (:public_id, :display_name, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    RETURNING id
                    """
                ),
                {"public_id": str(uuid4()), "display_name": "legacy-review-user"},
            ).scalar_one()
            connection.execute(
                text(
                    """
                    INSERT INTO review_items_v2 (
                        user_id,
                        source_kind,
                        title,
                        status,
                        metadata_json,
                        created_at,
                        updated_at,
                        reason
                    )
                    VALUES (
                        :user_id,
                        'wrong_answer',
                        'legacy review item',
                        'pending',
                        '{}'::jsonb,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP,
                        NULL
                    )
                    """
                ),
                {"user_id": user_id},
            )

        head_upgrade = run_alembic(database_url, "upgrade", "head")
        assert head_upgrade.returncode == 0, head_upgrade.stderr or head_upgrade.stdout

        with Session(engine) as session:
            legacy_row = session.query(ReviewItemV2).filter_by(title="legacy review item").one()
            assert legacy_row.correct_streak == 0
            assert legacy_row.next_review_at is None
            assert legacy_row.version == 1

            llm_call = LlmCallV2(
                user_id=legacy_row.user_id,
                purpose="review_cause_analysis",
                prompt_version="cause_analysis_group@v1",
                provider="mock",
                model="mock-model",
                latency_ms=1,
                request_payload={"input": "legacy"},
                parse_status="ok",
            )
            session.add(llm_call)
            session.flush()
            session.add(
                AiCauseAnalysisV2(
                    user_id=legacy_row.user_id,
                    scope=CauseAnalysisScope.SINGLE.value,
                    input_hash="missing-question",
                    result_json={"summary": "invalid"},
                    llm_call_id=llm_call.id,
                    expires_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(days=30),
                )
            )
            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()

            llm_call = LlmCallV2(
                user_id=legacy_row.user_id,
                purpose="review_cause_analysis",
                prompt_version="cause_analysis_group@v1",
                provider="mock",
                model="mock-model",
                latency_ms=1,
                request_payload={"input": "legacy-retry"},
                parse_status="ok",
            )
            session.add(llm_call)
            session.flush()
            session.add(
                AiCauseAnalysisV2(
                    user_id=legacy_row.user_id,
                    scope=CauseAnalysisScope.GROUP.value,
                    question_ids_signature="legacy-signature",
                    input_hash="legacy-input-hash",
                    result_json={"summary": "legacy"},
                    llm_call_id=llm_call.id,
                    expires_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(days=30),
                )
            )
            session.commit()

        downgrade = run_alembic(database_url, "downgrade", "1026_question_report")
        assert downgrade.returncode == 0, downgrade.stderr or downgrade.stdout

        downgraded_columns = {column["name"] for column in inspect(engine).get_columns("review_items_v2")}
        assert "ai_cause_analysis_v2" not in inspect(engine).get_table_names()
        assert "correct_streak" not in downgraded_columns
        assert "next_review_at" not in downgraded_columns
        assert "version" not in downgraded_columns

        with engine.connect() as connection:
            remaining = connection.execute(
                text("SELECT title FROM review_items_v2 WHERE title = 'legacy review item'")
            ).scalar_one()
        assert remaining == "legacy review item"

        reupgrade = run_alembic(database_url, "upgrade", "head")
        assert reupgrade.returncode == 0, reupgrade.stderr or reupgrade.stdout
        assert "ai_cause_analysis_v2" in inspect(engine).get_table_names()
