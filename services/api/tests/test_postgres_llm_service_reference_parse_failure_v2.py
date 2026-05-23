from __future__ import annotations

import asyncio
import os
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from _helpers.llm_service_practice_support import ReferenceAuditParseFailProvider, build_practice_llm_settings, seed_user
from _helpers.postgres_temp_db import build_postgres_engine
from sikao_api.db.models_v2 import LlmCallV2
from sikao_api.db.session import load_runtime_metadata
from sikao_api.modules.llm.application.service import HomeLlmService


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_home_llm_service_keeps_reference_audit_parse_context(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = ReferenceAuditParseFailProvider()
    monkeypatch.setattr(
        "sikao_api.modules.llm.application.reference_answer_generator.build_llm_provider",
        lambda *_args, **_kwargs: (provider, "mock"),
    )
    with build_postgres_engine("sikao_llm_practice_ref_parse") as engine:
        load_runtime_metadata().create_all(engine)
        session_factory: sessionmaker[Session] = sessionmaker(
            bind=engine, autoflush=False, autocommit=False, expire_on_commit=False
        )
        settings = build_practice_llm_settings(tmp_path, database_url=str(engine.url))
        with session_factory() as session:
            user = seed_user(session, name="Reference Parse User")
            session.commit()
            user_id = user.id
            service = HomeLlmService(session, settings)
            with pytest.raises(Exception):
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
            assert rows[1].parse_status != "failed_before_trace"
            assert rows[1].request_payload["messages"]
            assert rows[1].response_payload is not None
