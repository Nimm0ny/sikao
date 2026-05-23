from __future__ import annotations

import asyncio
import os
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from _helpers.llm_service_practice_support import ReferenceAuditFailProvider, build_practice_llm_settings, seed_user
from _helpers.postgres_temp_db import build_postgres_engine
from sikao_api.db.models_v2 import LlmCallV2
from sikao_api.db.session import load_runtime_metadata
from sikao_api.modules.llm.application.service import HomeLlmService
from sikao_api.modules.system.application.errors import LLMServiceError


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_home_llm_service_records_reference_generation_before_audit_failure(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = ReferenceAuditFailProvider()
    monkeypatch.setattr(
        "sikao_api.modules.llm.application.reference_answer_generator.build_llm_provider",
        lambda *_args, **_kwargs: (provider, "mock"),
    )
    with build_postgres_engine("sikao_llm_practice_ref_fail") as engine:
        load_runtime_metadata().create_all(engine)
        session_factory: sessionmaker[Session] = sessionmaker(
            bind=engine, autoflush=False, autocommit=False, expire_on_commit=False
        )
        settings = build_practice_llm_settings(tmp_path, database_url=str(engine.url))
        with session_factory() as session:
            user = seed_user(session, name="Reference Fail User")
            session.commit()
            user_id = user.id
            service = HomeLlmService(session, settings)
            with pytest.raises(LLMServiceError):
                asyncio.run(
                    service.generate_reference_answer(
                        user=user,
                        question_stem="请结合材料谈谈基层治理现代化的关键抓手。",
                        materials=["材料一", "材料二"],
                        word_limit=1000,
                    )
                )
            session.rollback()
        with session_factory() as verify_session:
            rows = list(
                verify_session.scalars(
                    select(LlmCallV2).where(LlmCallV2.user_id == user_id).order_by(LlmCallV2.id.asc())
                )
            )
            assert [row.purpose for row in rows] == ["reference_generation", "reference_audit"]
            assert rows[0].parse_status == "ok"
            assert rows[0].response_payload is not None
            assert rows[1].parse_status == "failed_before_trace"
            assert rows[1].error_class == "LLMServiceError"
