from __future__ import annotations

import os
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from _helpers.postgres_temp_db import build_postgres_engine
from test_import_real_exams import (
    API_SRC,
    REPO_ROOT,
    _MODULE,
    _MAPPER,
    _PARSER,
    _alembic,
    _write_json_input,
)
from sikao_api.db.models_v2 import PaperRevisionV2, PaperV2, QuestionV2


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_dry_run_apply_and_skip_cycle(tmp_path: Path) -> None:
    with build_postgres_engine("sikao_import_real") as engine:
        env = os.environ.copy()
        env["DATABASE_URL"] = engine.url.render_as_string(hide_password=False)
        env["PYTHONPATH"] = os.pathsep.join([str(API_SRC), str(REPO_ROOT)])
        _alembic(env, "upgrade", "head")

        json_path = tmp_path / "paper-postgres.json"
        _write_json_input(json_path)
        raw_papers = _PARSER.load_raw_papers(json_path)
        import_papers = _MAPPER.map_raw_papers(raw_papers)

        manifest = _MODULE._build_manifest(engine, import_papers, dry_run=True)
        assert manifest["planned"][0]["action"] == "create_paper"
        assert manifest["applied"] == []

        applied_manifest = _MODULE._build_manifest(engine, import_papers, dry_run=False)
        assert applied_manifest["applied"][0]["paper_code"] == "GX-2024-01"

        second_dry_run = _MODULE._build_manifest(engine, import_papers, dry_run=True)
        assert second_dry_run["planned"][0]["action"] == "skip"

        with Session(engine) as session:
            paper = session.scalar(select(PaperV2).where(PaperV2.paper_code == "GX-2024-01"))
            assert paper is not None
            revision = session.scalar(
                select(PaperRevisionV2).where(PaperRevisionV2.paper_id == paper.id)
            )
            assert revision is not None
            questions = list(
                session.scalars(
                    select(QuestionV2)
                    .where(QuestionV2.revision_id == revision.id)
                    .order_by(QuestionV2.item_no.asc())
                )
            )
            assert len(questions) == 2
            assert questions[0].category_l1 == "verbal"
            assert questions[1].category_l2 == "reading"
            assert questions[0].ability_dimensions == []
            assert questions[0].knowledge_tags == []
            assert questions[0].discrimination_index is None
            assert questions[0].heat_score == 0.0
            assert questions[0].complexity_level is None
            assert questions[0].content_hash


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_partial_overlap_fails_fast(tmp_path: Path) -> None:
    with build_postgres_engine("sikao_import_overlap") as engine:
        env = os.environ.copy()
        env["DATABASE_URL"] = engine.url.render_as_string(hide_password=False)
        env["PYTHONPATH"] = os.pathsep.join([str(API_SRC), str(REPO_ROOT)])
        _alembic(env, "upgrade", "head")

        base_path = tmp_path / "base-postgres.json"
        overlap_path = tmp_path / "overlap-postgres.json"
        _write_json_input(base_path)
        _write_json_input(overlap_path, prompt_2="Question 2 changed")

        base_manifest = _MODULE._build_manifest(
            engine,
            _MAPPER.map_raw_papers(_PARSER.load_raw_papers(base_path)),
            dry_run=False,
        )
        assert base_manifest["applied"][0]["question_count"] == 2

        with pytest.raises(ValueError, match="partial overlap"):
            _MODULE._build_manifest(
                engine,
                _MAPPER.map_raw_papers(_PARSER.load_raw_papers(overlap_path)),
                dry_run=True,
            )
