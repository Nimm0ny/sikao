from __future__ import annotations

import importlib
import json
import os
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PaperRevisionV2, PaperV2, QuestionV2


REPO_ROOT = Path(__file__).resolve().parents[3]
ALEMBIC_INI = REPO_ROOT / "database" / "migrations" / "alembic.ini"
API_SRC = REPO_ROOT / "services" / "api" / "src"
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
if str(API_SRC) not in sys.path:
    sys.path.insert(0, str(API_SRC))

_MODULE = importlib.import_module("scripts.import.import_real_exams")
_PARSER = importlib.import_module("scripts.import.importers.parser")
_MAPPER = importlib.import_module("scripts.import.importers.mapper")


def _make_database(tmp_dir: Path) -> tuple[dict[str, str], str]:
    db_file = tmp_dir / f"import-real-exams-{uuid4().hex}.db"
    env = os.environ.copy()
    db_url = f"sqlite:///{db_file.as_posix()}"
    env["DATABASE_URL"] = db_url
    env["PYTHONPATH"] = str(API_SRC)
    return env, db_url


def _alembic(env: dict[str, str], *args: str) -> None:
    subprocess.run(
        [sys.executable, "-m", "alembic", "-c", str(ALEMBIC_INI), *args],
        check=True,
        cwd=REPO_ROOT,
        env=env,
    )


def _write_json_input(path: Path, *, prompt_2: str = "Question 2") -> None:
    payload = {
        "paper_code": "GX-2024-01",
        "title": "2024 国省考样例",
        "subject_kind": "xingce",
        "questions": [
            {
                "item_no": 1,
                "prompt": "Question 1",
                "answer_kind": "single_choice",
                "status": "published",
                "source": "real_exam",
                "year": 2024,
                "region": "guangxi",
                "exam_type": "provincial",
                "category_l1": "verbal",
                "category_l2": "logic_fill",
                "content_json": {
                    "stem": "Question 1",
                    "options": ["A", "B", "C", "D"],
                    "correct_answer": "A",
                    "explanation": "Because A",
                },
                "ability_dimensions": ["reasoning"],
                "knowledge_tags": ["logic_fill"],
            },
            {
                "item_no": 2,
                "prompt": prompt_2,
                "answer_kind": "single_choice",
                "status": "published",
                "source": "real_exam",
                "year": 2024,
                "region": "guangxi",
                "exam_type": "provincial",
                "classification": {"l1": "verbal", "l2": "reading"},
                "content_json": {
                    "stem": prompt_2,
                    "options": ["A", "B"],
                    "correct_answer": "B",
                    "explanation": "Because B",
                },
            },
        ],
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _write_csv_input(path: Path) -> None:
    path.write_text(
        "\n".join(
            [
                "paper_code,title,subject_kind,item_no,prompt,answer_kind,status,source,year,region,exam_type,category_l1,category_l2,content_json",
                'CSV-2024-01,CSV Sample,xingce,1,"CSV Question 1",single_choice,published,real_exam,2024,beijing,provincial,verbal,logic_fill,"{""stem"":""CSV Question 1"",""options"":[""A"",""B""],""correct_answer"":""A""}"',
                'CSV-2024-01,CSV Sample,xingce,2,"CSV Question 2",single_choice,published,real_exam,2024,beijing,provincial,verbal,reading,"{""stem"":""CSV Question 2"",""options"":[""A"",""B""],""correct_answer"":""B""}"',
            ]
        ),
        encoding="utf-8",
    )


def test_load_raw_papers_supports_json_and_csv(tmp_path: Path) -> None:
    json_path = tmp_path / "paper.json"
    csv_path = tmp_path / "paper.csv"
    _write_json_input(json_path)
    _write_csv_input(csv_path)

    json_papers = _PARSER.load_raw_papers(json_path)
    csv_papers = _PARSER.load_raw_papers(csv_path)

    assert len(json_papers) == 1
    assert json_papers[0].paper_code == "GX-2024-01"
    assert len(json_papers[0].questions) == 2

    assert len(csv_papers) == 1
    assert csv_papers[0].paper_code == "CSV-2024-01"
    assert len(csv_papers[0].questions) == 2


def test_dry_run_apply_and_skip_cycle(tmp_path: Path) -> None:
    env, db_url = _make_database(tmp_path)
    _alembic(env, "upgrade", "head")
    json_path = tmp_path / "paper.json"
    _write_json_input(json_path)

    raw_papers = _PARSER.load_raw_papers(json_path)
    import_papers = _MAPPER.map_raw_papers(raw_papers)

    engine = create_engine(db_url, future=True)
    try:
        manifest = _MODULE._build_manifest(engine, import_papers, dry_run=True)
        assert manifest["planned"][0]["action"] == "create_paper"
        assert manifest["applied"] == []

        applied_manifest = _MODULE._build_manifest(engine, import_papers, dry_run=False)
        assert applied_manifest["applied"][0]["paper_code"] == "GX-2024-01"

        second_dry_run = _MODULE._build_manifest(engine, import_papers, dry_run=True)
        assert second_dry_run["planned"][0]["action"] == "skip"
    finally:
        engine.dispose()

    engine = create_engine(db_url, future=True)
    try:
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
    finally:
        engine.dispose()


def test_partial_overlap_fails_fast(tmp_path: Path) -> None:
    env, db_url = _make_database(tmp_path)
    _alembic(env, "upgrade", "head")
    base_path = tmp_path / "base.json"
    overlap_path = tmp_path / "overlap.json"
    _write_json_input(base_path)
    _write_json_input(overlap_path, prompt_2="Question 2 changed")

    engine = create_engine(db_url, future=True)
    try:
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
    finally:
        engine.dispose()


def test_metadata_only_change_creates_new_revision_plan(tmp_path: Path) -> None:
    env, db_url = _make_database(tmp_path)
    _alembic(env, "upgrade", "head")
    base_path = tmp_path / "base.json"
    updated_path = tmp_path / "updated.json"
    _write_json_input(base_path)
    _write_json_input(updated_path)

    updated_payload = json.loads(updated_path.read_text(encoding="utf-8"))
    updated_payload["questions"][0]["category_l2"] = "critical_reading"
    updated_path.write_text(json.dumps(updated_payload, ensure_ascii=False), encoding="utf-8")

    engine = create_engine(db_url, future=True)
    try:
        _MODULE._build_manifest(
            engine,
            _MAPPER.map_raw_papers(_PARSER.load_raw_papers(base_path)),
            dry_run=False,
        )
        with pytest.raises(ValueError, match="partial overlap"):
            _MODULE._build_manifest(
                engine,
                _MAPPER.map_raw_papers(_PARSER.load_raw_papers(updated_path)),
                dry_run=True,
            )
    finally:
        engine.dispose()


def test_phase1_import_ignores_question_metadata_fields(tmp_path: Path) -> None:
    json_path = tmp_path / "phase1-schema-only.json"
    _write_json_input(json_path)
    payload = json.loads(json_path.read_text(encoding="utf-8"))
    payload["questions"][0]["quality_score"] = 0.0
    payload["questions"][0]["ability_dimensions"] = ["reasoning", "not_valid"]
    payload["questions"][0]["knowledge_tags"] = ["LogicFill", "good_tag"]
    payload["questions"][0]["discrimination_index"] = 0.42
    payload["questions"][0]["heat_score"] = 2.5
    payload["questions"][0]["complexity_level"] = 4
    json_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    import_papers = _MAPPER.map_raw_papers(_PARSER.load_raw_papers(json_path))
    question = import_papers[0].questions[0]

    assert question.ability_dimensions == []
    assert question.knowledge_tags == []
    assert question.discrimination_index is None
    assert question.heat_score == 0.0
    assert question.complexity_level is None
    assert question.quality_score == 0.0


def test_apply_uses_per_paper_transactions(tmp_path: Path) -> None:
    env, db_url = _make_database(tmp_path)
    _alembic(env, "upgrade", "head")
    batch_path = tmp_path / "batch.json"
    _write_json_input(batch_path)
    payload = json.loads(batch_path.read_text(encoding="utf-8"))
    payload = [
        payload,
        {
            **payload,
            "paper_code": "GX-2024-02",
            "questions": [
                payload["questions"][0],
                {
                    **payload["questions"][1],
                    "prompt": "Question 2 changed",
                    "content_json": {
                        "stem": "Question 2 changed",
                        "options": ["A", "B"],
                        "correct_answer": "B",
                    },
                },
            ],
        },
    ]
    batch_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    engine = create_engine(db_url, future=True)
    try:
        with pytest.raises(ValueError, match="partial overlap"):
            _MODULE._build_manifest(
                engine,
                _MAPPER.map_raw_papers(_PARSER.load_raw_papers(batch_path)),
                dry_run=False,
            )
    finally:
        engine.dispose()

    engine = create_engine(db_url, future=True)
    try:
        with Session(engine) as session:
            assert session.scalar(select(PaperV2).where(PaperV2.paper_code == "GX-2024-01")) is not None
            assert session.scalar(select(PaperV2).where(PaperV2.paper_code == "GX-2024-02")) is None
    finally:
        engine.dispose()

