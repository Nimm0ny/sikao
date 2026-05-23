from __future__ import annotations

import asyncio
import os
from pathlib import Path

import pytest
from sqlalchemy.orm import Session, sessionmaker

from _helpers.essay_grading_support import seed_essay_question
from _helpers.postgres_temp_db import build_postgres_engine
from sikao_api.core.config import Settings
from sikao_api.db.models import EssayGradingRecord
from sikao_api.db.session import load_runtime_metadata
from sikao_api.modules.essay.application.essay_grading import EssayGradingService, grade_essay_record_async


def _build_settings(tmp_path: Path, *, database_url: str) -> Settings:
    return Settings(
        app_env="test",
        database_url=database_url,
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="essay-grading-pg-secret",
        app_version="essay-grading-pg",
        git_sha="essay-grading-pg",
        image_tag="essay-grading-pg",
        build_time="2026-05-23T00:00:00Z",
        schema_version="essay-grading-pg",
    )


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_essay_grading_service_uses_llm_entrypoint(tmp_path: Path) -> None:
    with build_postgres_engine("sikao_essay_grading") as engine:
        load_runtime_metadata().create_all(engine)
        session_factory: sessionmaker[Session] = sessionmaker(
            bind=engine,
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,
        )
        settings = _build_settings(tmp_path, database_url=str(engine.url))
        with session_factory() as session:
            user, question = seed_essay_question(session)
            record = EssayGradingService(session).submit(
                user_id=user.id,
                question_id=question.id,
                answer_text="作答内容" * 100,
            )
            session.commit()
            record_id = int(record.id)

        asyncio.run(grade_essay_record_async(session_factory, settings, record_id))

        with session_factory() as session:
            fresh = session.get(EssayGradingRecord, record_id)
            assert fresh is not None
            assert fresh.status == "completed"
            assert fresh.score is not None
            assert float(fresh.score) == pytest.approx(77.0)
            assert fresh.feedback_json is not None
            assert fresh.feedback_json["overallScore"] == pytest.approx(77.0)
            assert fresh.feedback_json["sampleAnswer"] == "x" * 950
            assert fresh.feedback_json["suspicious"] is False
            assert fresh.token_usage_id is not None
