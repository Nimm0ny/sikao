from __future__ import annotations

import asyncio
import os
from pathlib import Path

import pytest
from sqlalchemy.orm import Session, sessionmaker

from _helpers.llm_stubs import (
    StubLlmProvider,
    well_formed_reference_answer_payload,
    well_formed_reference_audit_payload,
)
from _helpers.postgres_temp_db import build_postgres_engine
from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import EssayReferenceAnswerV2, PaperRevisionV2, PaperV2, QuestionV2
from sikao_api.db.session import load_runtime_metadata
from sikao_api.modules.llm.application.llm.provider import ChatCompletionResult
from sikao_api.modules.llm.application.reference_answer_generator import generate_reference_answer_with_trace


class _SequenceProvider:
    def __init__(self, responses: list[str]) -> None:
        self._responses = list(responses)

    async def chat_completion(self, **_kwargs: object) -> ChatCompletionResult:
        if not self._responses:
            raise AssertionError("provider exhausted")
        return await StubLlmProvider(self._responses.pop(0)).chat_completion()


def _build_settings(tmp_path: Path, *, database_url: str) -> Settings:
    return Settings(
        app_env="test",
        database_url=database_url,
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="reference-answer-pg-secret",
        app_version="reference-answer-pg",
        git_sha="reference-answer-pg",
        image_tag="reference-answer-pg",
        build_time="2026-05-23T00:00:00Z",
        schema_version="reference-answer-pg",
    )


def _seed_question(session: Session) -> QuestionV2:
    paper = PaperV2(
        paper_code="ESSAY-REF-PG-001",
        title="Reference Answer PG",
        subject_kind="essay",
    )
    session.add(paper)
    session.flush()
    revision = PaperRevisionV2(
        paper_id=paper.id,
        revision_number=1,
        status="published",
    )
    session.add(revision)
    session.flush()
    question = QuestionV2(
        revision_id=revision.id,
        item_no=1,
        subject_kind="essay",
        prompt="请结合材料谈谈基层治理现代化的关键抓手。",
        answer_kind="essay",
        status="published",
        content_json={"stem": "请结合材料谈谈基层治理现代化的关键抓手。"},
        source="real_exam",
        year=2024,
        region="beijing",
        exam_type="provincial",
        category_l1="essay",
        category_l2="policy_analysis",
    )
    session.add(question)
    session.flush()
    return question


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_reference_answer_output_can_persist_to_reference_row(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = _SequenceProvider(
        [
            well_formed_reference_answer_payload(),
            well_formed_reference_audit_payload(),
        ]
    )
    monkeypatch.setattr(
        "sikao_api.modules.llm.application.reference_answer_generator.build_llm_provider",
        lambda *_args, **_kwargs: (provider, "mock"),
    )

    with build_postgres_engine("sikao_reference_answer") as engine:
        load_runtime_metadata().create_all(engine)
        session_factory: sessionmaker[Session] = sessionmaker(
            bind=engine,
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,
        )
        settings = _build_settings(tmp_path, database_url=str(engine.url))
        with session_factory() as session:
            question = _seed_question(session)
            session.commit()
            trace = asyncio.run(
                generate_reference_answer_with_trace(
                    settings=settings,
                    question_stem=question.prompt,
                    materials=["材料一：基层治理需要协同。", "材料二：数字化不是目的而是手段。"],
                    word_limit=1000,
                    db=session,
                )
            )
            row = EssayReferenceAnswerV2(
                question_id=question.id,
                content=trace.result.content,
                source="ai_generated",
                status="draft",
                ai_self_audit_passed=trace.result.ai_self_audit_passed,
            )
            session.add(row)
            session.commit()
            session.refresh(row)
            assert row.id is not None
            assert row.source == "ai_generated"
            assert row.status == "draft"
            assert row.ai_self_audit_passed is True
            assert row.content == trace.result.content
