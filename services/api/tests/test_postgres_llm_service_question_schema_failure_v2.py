from __future__ import annotations

import asyncio
import os
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from _helpers.llm_service_practice_support import build_practice_llm_settings, practice_sources, seed_user
from _helpers.postgres_temp_db import build_postgres_engine
from sikao_api.db.models_v2 import LlmCallV2
from sikao_api.db.session import load_runtime_metadata
from sikao_api.modules.llm.application.llm.provider import ChatCompletionResult
from sikao_api.modules.llm.application.service import HomeLlmService


class InvalidQuestionGenerationProvider:
    async def chat_completion(self, **_kwargs: object) -> ChatCompletionResult:
        return ChatCompletionResult(
            content=(
                '{"questions": [{"source_question_id": 999, "type": "single_choice", '
                '"stem": "This stem is long enough to validate.", '
                '"options": {"A": "a", "B": "b", "C": "c", "D": "d"}, '
                '"correct_answer": "A", '
                '"explanation": "This explanation is deliberately long enough to pass length validation."}]}'
            ),
            prompt_tokens=12,
            prompt_cache_hit_tokens=0,
            prompt_cache_miss_tokens=12,
            completion_tokens=34,
            model="mock-model",
            finish_reason="stop",
        )


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_home_llm_service_keeps_question_schema_failure_context(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "sikao_api.modules.llm.application.question_generator.build_llm_provider",
        lambda *_args, **_kwargs: (InvalidQuestionGenerationProvider(), "mock"),
    )
    with build_postgres_engine("sikao_llm_practice_parse_fail") as engine:
        load_runtime_metadata().create_all(engine)
        session_factory: sessionmaker[Session] = sessionmaker(
            bind=engine, autoflush=False, autocommit=False, expire_on_commit=False
        )
        settings = build_practice_llm_settings(tmp_path, database_url=str(engine.url))
        with session_factory() as session:
            user = seed_user(session, name="Parse Fail User")
            session.commit()
            user_id = user.id
            service = HomeLlmService(session, settings)
            with pytest.raises(Exception):
                asyncio.run(
                    service.generate_questions(
                        user=user, sources=practice_sources(), target_difficulty=(0.2, 0.4), count=2
                    )
                )
            session.rollback()
        with session_factory() as verify_session:
            row = verify_session.scalar(
                select(LlmCallV2).where(LlmCallV2.user_id == user_id).order_by(LlmCallV2.id.desc())
            )
            assert row is not None
            assert row.purpose == "question_generation"
            assert row.parse_status == "schema_violation"
            assert row.request_payload["messages"]
            assert row.response_payload is not None
