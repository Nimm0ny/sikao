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
def test_postgres_home_llm_service_call_quota_stays_global_across_purposes(tmp_path: Path) -> None:
    with build_postgres_engine("sikao_llm_practice_call_cap") as engine:
        load_runtime_metadata().create_all(engine)
        session_factory: sessionmaker[Session] = sessionmaker(
            bind=engine, autoflush=False, autocommit=False, expire_on_commit=False
        )
        settings = build_practice_llm_settings(tmp_path, database_url=str(engine.url))
        settings.llm_quota_per_user_per_day = 2
        with session_factory() as session:
            user = seed_user(session, name="Call Cap User")
            for purpose in ("question_generation", "recommend_today"):
                session.add(
                    LlmCallV2(
                        user_id=user.id,
                        purpose=purpose,
                        prompt_version=f"{purpose}@test",
                        provider="mock",
                        model="mock-model",
                        input_tokens=10,
                        output_tokens=20,
                        cost_cny=0.0001,
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
                    service.generate_reference_answer(
                        user=user,
                        question_stem="请结合材料谈谈基层治理现代化的关键抓手。",
                        materials=["材料一", "材料二"],
                        word_limit=1000,
                    )
                )
            assert excinfo.value.code == "llm_daily_call_quota_exceeded"
