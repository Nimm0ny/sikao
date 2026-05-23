from __future__ import annotations

import asyncio
import os
from pathlib import Path

import pytest
from sqlalchemy.orm import Session, sessionmaker

from _helpers.llm_service_practice_support import build_practice_llm_settings, seed_user
from _helpers.postgres_temp_db import build_postgres_engine
from sikao_api.db.models_v2 import LlmCallV2
from sikao_api.db.session import load_runtime_metadata
from sikao_api.modules.llm.application.service import HomeLlmService
from sikao_api.modules.system.application.errors import QuotaExceededError


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_home_llm_service_enforces_per_purpose_quota(tmp_path: Path) -> None:
    with build_postgres_engine("sikao_llm_practice_quota") as engine:
        load_runtime_metadata().create_all(engine)
        session_factory: sessionmaker[Session] = sessionmaker(
            bind=engine, autoflush=False, autocommit=False, expire_on_commit=False
        )
        settings = build_practice_llm_settings(tmp_path, database_url=str(engine.url))
        with session_factory() as session:
            user = seed_user(session, name="Quota User")
            for index in range(5):
                session.add(
                    LlmCallV2(
                        user_id=user.id,
                        purpose="essay_grading",
                        prompt_version=f"essay_grading@test-{index}",
                        provider="mock",
                        model="mock-model",
                        input_tokens=10,
                        output_tokens=20,
                        cost_cny=0.001,
                        latency_ms=1,
                        request_payload={},
                        response_payload={"content": "ok"},
                        parsed_output={"ok": True},
                        parse_status="ok",
                        error_class=None,
                        error_message=None,
                        retry_count=0,
                    )
                )
            session.commit()
            service = HomeLlmService(session, settings)
            with pytest.raises(QuotaExceededError) as excinfo:
                asyncio.run(
                    service.grade_essay(
                        user=user,
                        question_stem="请结合材料谈谈你的理解。",
                        materials=["材料一"],
                        user_answer="作答内容" * 100,
                        word_limit_min=800,
                        word_limit_max=1000,
                        full_score=40,
                    )
                )
            assert excinfo.value.code == "essay_grading_quota_exceeded"
