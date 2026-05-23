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
from sikao_api.modules.llm.application.service import HomeLlmService


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_home_llm_service_records_practice_capabilities(tmp_path: Path) -> None:
    with build_postgres_engine("sikao_llm_practice_service") as engine:
        load_runtime_metadata().create_all(engine)
        session_factory: sessionmaker[Session] = sessionmaker(
            bind=engine, autoflush=False, autocommit=False, expire_on_commit=False
        )
        settings = build_practice_llm_settings(tmp_path, database_url=str(engine.url))
        with session_factory() as session:
            user = seed_user(session)
            session.commit()
            service = HomeLlmService(session, settings)

            question_trace = asyncio.run(
                service.generate_questions(
                    user=user, sources=practice_sources(), target_difficulty=(0.2, 0.4), count=2
                )
            )
            essay_trace = asyncio.run(
                service.grade_essay(
                    user=user,
                    question_stem="请结合材料谈谈你的理解。",
                    materials=["材料一", "材料二"],
                    user_answer="作答内容" * 100,
                    word_limit_min=800,
                    word_limit_max=1000,
                    full_score=40,
                )
            )
            reference_trace = asyncio.run(
                service.generate_reference_answer(
                    user=user,
                    question_stem="请结合材料谈谈基层治理现代化的关键抓手。",
                    materials=["材料一：基层治理需要协同。", "材料二：数字化不是目的而是手段。"],
                    word_limit=1000,
                )
            )
            session.commit()

            rows = list(
                session.scalars(select(LlmCallV2).where(LlmCallV2.user_id == user.id).order_by(LlmCallV2.id.asc()))
            )
            assert [row.purpose for row in rows] == [
                "question_generation",
                "essay_grading",
                "reference_generation",
                "reference_audit",
            ]
            assert all(row.cost_cny is not None for row in rows)
            assert len(question_trace.questions) == 2
            assert len(essay_trace.payload.evaluation.dimensions) == 5
            assert reference_trace.result.ai_self_audit_passed is True
