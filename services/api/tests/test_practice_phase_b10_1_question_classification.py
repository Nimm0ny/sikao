"""Phase-Practice WU-B10.1: questions_v2 classification field acceptance tests.

Verifies the migration cycle and model-level invariants for the Tab 2 first-batch
column additions: source / year / region / exam_type / category_l1 / category_l2
plus the two composite indexes.
"""

from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PaperRevisionV2, PaperV2, QuestionV2


_REPO_ROOT = Path(__file__).resolve().parents[3]
_ALEMBIC_INI = _REPO_ROOT / "database" / "migrations" / "alembic.ini"
_API_SRC = _REPO_ROOT / "services" / "api" / "src"


def _make_database(tmp_dir: Path) -> tuple[Path, dict[str, str], str]:
    db_file = tmp_dir / f"b10_1-{uuid4().hex}.db"
    db_file.parent.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    db_url = f"sqlite:///{db_file.as_posix()}"
    env["DATABASE_URL"] = db_url
    env["PYTHONPATH"] = str(_API_SRC)
    return db_file, env, db_url


def _alembic(env: dict[str, str], *args: str) -> None:
    subprocess.run(
        [sys.executable, "-m", "alembic", "-c", str(_ALEMBIC_INI), *args],
        check=True,
        cwd=_REPO_ROOT,
        env=env,
    )


def _seed_paper_revision(db_url: str, *, suffix: str) -> int:
    """Insert a minimum paper + revision and return revision_id."""
    engine = create_engine(db_url, future=True)
    try:
        with Session(engine) as session:
            paper = PaperV2(
                paper_code=f"paper-{suffix}",
                title=f"paper {suffix}",
                subject_kind="xingce",
            )
            session.add(paper)
            session.flush()
            revision = PaperRevisionV2(
                paper_id=paper.id,
                revision_number=1,
                status="draft",
            )
            session.add(revision)
            session.flush()
            session.commit()
            return revision.id
    finally:
        engine.dispose()


def test_model_declares_classification_columns() -> None:
    """ORM-level smoke: declared columns + types match the migration."""
    table = QuestionV2.__table__
    assert "source" in table.c and not table.c["source"].nullable
    assert "year" in table.c and table.c["year"].nullable
    assert "region" in table.c and table.c["region"].nullable
    assert "exam_type" in table.c and not table.c["exam_type"].nullable
    assert "category_l1" in table.c and not table.c["category_l1"].nullable
    assert "category_l2" in table.c and table.c["category_l2"].nullable

    declared_indexes = {idx.name for idx in table.indexes}
    assert "ix_questions_v2_category" in declared_indexes
    assert "ix_questions_v2_year_region_exam" in declared_indexes


def test_upgrade_applies_columns_and_indexes(tmp_path: Path) -> None:
    db_file, env, _ = _make_database(tmp_path)
    _alembic(env, "upgrade", "head")

    with sqlite3.connect(db_file) as conn:
        cols = {row[1]: row for row in conn.execute("PRAGMA table_info(questions_v2)")}
        assert "source" in cols and cols["source"][3] == 1  # NOT NULL
        assert "year" in cols and cols["year"][3] == 0  # nullable
        assert "region" in cols and cols["region"][3] == 0
        assert "exam_type" in cols and cols["exam_type"][3] == 1
        assert "category_l1" in cols and cols["category_l1"][3] == 1
        assert "category_l2" in cols and cols["category_l2"][3] == 0

        indexes = {row[1] for row in conn.execute("PRAGMA index_list(questions_v2)")}
        assert "ix_questions_v2_category" in indexes
        assert "ix_questions_v2_year_region_exam" in indexes


def test_upgrade_seeds_legacy_rows_with_defaults(tmp_path: Path) -> None:
    """Pre-existing rows (without the new columns) must come out of the
    upgrade with the documented defaults: source=real_exam, exam_type=other,
    category_l1=uncategorized."""
    db_file, env, db_url = _make_database(tmp_path)
    _alembic(env, "upgrade", "1011_merge_home_drop_and_profile_tab5")

    revision_id = _seed_paper_revision(db_url, suffix="legacy")
    with sqlite3.connect(db_file) as conn:
        conn.execute(
            "INSERT INTO questions_v2 "
            "(revision_id, item_no, subject_kind, prompt, answer_kind, status, content_json, "
            "created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
            (revision_id, 1, "xingce", "legacy prompt", "single_choice", "draft", "{}"),
        )
        conn.commit()

    _alembic(env, "upgrade", "head")

    with sqlite3.connect(db_file) as conn:
        row = conn.execute(
            "SELECT source, year, region, exam_type, category_l1, category_l2 "
            "FROM questions_v2 WHERE prompt = 'legacy prompt'"
        ).fetchone()
        source, year, region, exam_type, category_l1, category_l2 = row
        assert source == "real_exam"
        assert year is None
        assert region is None
        assert exam_type == "other"
        assert category_l1 == "uncategorized"
        assert category_l2 is None


def test_downgrade_then_reupgrade_is_clean(tmp_path: Path) -> None:
    """Round-trip: head -> 1011 -> head must leave the schema identical."""
    db_file, env, _ = _make_database(tmp_path)
    _alembic(env, "upgrade", "head")
    _alembic(env, "downgrade", "1011_merge_home_drop_and_profile_tab5")

    with sqlite3.connect(db_file) as conn:
        cols = {row[1] for row in conn.execute("PRAGMA table_info(questions_v2)")}
        for new_col in ("source", "year", "region", "exam_type", "category_l1", "category_l2"):
            assert new_col not in cols, f"{new_col} should be dropped on downgrade"

        indexes = {row[1] for row in conn.execute("PRAGMA index_list(questions_v2)")}
        assert "ix_questions_v2_category" not in indexes
        assert "ix_questions_v2_year_region_exam" not in indexes

    _alembic(env, "upgrade", "head")

    with sqlite3.connect(db_file) as conn:
        cols = {row[1] for row in conn.execute("PRAGMA table_info(questions_v2)")}
        for new_col in ("source", "year", "region", "exam_type", "category_l1", "category_l2"):
            assert new_col in cols


@pytest.mark.parametrize(
    "field,value",
    [
        ("source", "real_exam"),
        ("source", "ai_generated"),
        ("source", "ai_modified"),
        ("exam_type", "national"),
        ("exam_type", "provincial"),
        ("exam_type", "institution"),
        ("exam_type", "xuandiao"),
        ("exam_type", "other"),
    ],
)
def test_documented_enum_values_are_storable(tmp_path: Path, field: str, value: str) -> None:
    """The application-layer enums (source, exam_type) must round-trip through
    the column without DB-level rejection. We do not enforce DB-side enums on
    purpose - application validation owns the contract - but the column must
    accept every documented value."""
    _, env, db_url = _make_database(tmp_path)
    _alembic(env, "upgrade", "head")
    revision_id = _seed_paper_revision(db_url, suffix=f"{field}-{value}")

    engine = create_engine(db_url, future=True)
    try:
        with Session(engine) as session:
            kwargs = {field: value}
            kwargs.setdefault("source", "real_exam")
            kwargs.setdefault("exam_type", "other")
            kwargs.setdefault("category_l1", "uncategorized")
            question = QuestionV2(
                revision_id=revision_id,
                item_no=1,
                subject_kind="xingce",
                prompt=f"prompt {field}={value}",
                answer_kind="single_choice",
                status="draft",
                content_json={},
                **kwargs,
            )
            session.add(question)
            session.commit()
            stored = session.execute(
                text(f"SELECT {field} FROM questions_v2 WHERE prompt = :p"),
                {"p": f"prompt {field}={value}"},
            ).scalar_one()
            assert stored == value
    finally:
        engine.dispose()
