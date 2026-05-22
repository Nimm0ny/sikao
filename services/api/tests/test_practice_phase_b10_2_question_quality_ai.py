"""Phase-Practice WU-B10.2: questions_v2 quality + AI fields acceptance tests.

Verifies the second-batch field additions: historical_accuracy / answer_count /
quality_score / report_count / is_active (+ index) / content_hash /
ai_source_question_id (self-FK ondelete SET NULL) / ai_self_audit_passed /
ai_generated_at.

content_hash UNIQUE is intentionally not tested here — that constraint lands
in WU-B10.3 together with the source-immutable trigger and the
ix_questions_v2_source_active composite index.
"""

from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PaperRevisionV2, PaperV2, QuestionV2


_REPO_ROOT = Path(__file__).resolve().parents[3]
_ALEMBIC_INI = _REPO_ROOT / "database" / "migrations" / "alembic.ini"
_API_SRC = _REPO_ROOT / "services" / "api" / "src"

_NOT_NULL_COLS = ("historical_accuracy", "answer_count", "quality_score", "report_count", "is_active")
_NULLABLE_COLS = ("content_hash", "ai_source_question_id", "ai_self_audit_passed", "ai_generated_at")
_ALL_COLS = _NOT_NULL_COLS + _NULLABLE_COLS


def _enable_sqlite_fk(dbapi_connection: Any, _record: Any) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def _make_database(tmp_dir: Path) -> tuple[Path, dict[str, str], str]:
    db_file = tmp_dir / f"b10_2-{uuid4().hex}.db"
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


def _engine_with_fk(db_url: str):
    engine = create_engine(db_url, future=True)
    event.listen(engine, "connect", _enable_sqlite_fk)
    return engine


def _seed_paper_revision(db_url: str, *, suffix: str) -> int:
    engine = _engine_with_fk(db_url)
    try:
        with Session(engine) as session:
            paper = PaperV2(paper_code=f"paper-{suffix}", title=f"paper {suffix}", subject_kind="xingce")
            session.add(paper)
            session.flush()
            revision = PaperRevisionV2(paper_id=paper.id, revision_number=1, status="draft")
            session.add(revision)
            session.flush()
            session.commit()
            return revision.id
    finally:
        engine.dispose()


def test_upgrade_columns_index_and_self_fk_metadata(tmp_path: Path) -> None:
    """ORM declarations match the migration: nullability + index + self-FK."""
    table = QuestionV2.__table__
    for col in _NOT_NULL_COLS:
        assert table.c[col].nullable is False, f"{col} must be NOT NULL"
    for col in _NULLABLE_COLS:
        assert table.c[col].nullable is True, f"{col} must be nullable"

    fk = next(iter(table.c["ai_source_question_id"].foreign_keys))
    assert fk.column.table.name == "questions_v2"
    assert fk.ondelete == "SET NULL"
    assert "ix_questions_v2_is_active" in {idx.name for idx in table.indexes}

    # Migration result: every column lands with the documented nullability and
    # the single-col is_active index exists.
    db_file, env, _ = _make_database(tmp_path)
    _alembic(env, "upgrade", "head")
    with sqlite3.connect(db_file) as conn:
        cols = {row[1]: row for row in conn.execute("PRAGMA table_info(questions_v2)")}
        for col in _NOT_NULL_COLS:
            assert col in cols and cols[col][3] == 1, f"{col} should be NOT NULL"
        for col in _NULLABLE_COLS:
            assert col in cols and cols[col][3] == 0, f"{col} should be nullable"
        indexes = {row[1] for row in conn.execute("PRAGMA index_list(questions_v2)")}
        assert "ix_questions_v2_is_active" in indexes


def test_upgrade_seeds_legacy_rows_with_quality_defaults(tmp_path: Path) -> None:
    """Legacy row seeded at 1012 must come out of 1013 with the documented
    defaults: accuracy=0.0, count=0, quality=5.0, reports=0, active=1, AI
    fields all NULL."""
    db_file, env, db_url = _make_database(tmp_path)
    _alembic(env, "upgrade", "1012_question_v2_classification_fields")
    revision_id = _seed_paper_revision(db_url, suffix="legacy-quality")
    with sqlite3.connect(db_file) as conn:
        conn.execute(
            "INSERT INTO questions_v2 "
            "(revision_id, item_no, subject_kind, prompt, answer_kind, status, content_json, "
            "source, exam_type, category_l1, created_at, updated_at) "
            "VALUES (?, ?, 'xingce', 'legacy quality', 'single_choice', 'draft', '{}', "
            "'real_exam', 'national', 'verbal', datetime('now'), datetime('now'))",
            (revision_id, 1),
        )
        conn.commit()

    _alembic(env, "upgrade", "head")

    with sqlite3.connect(db_file) as conn:
        row = conn.execute(
            f"SELECT {','.join(_ALL_COLS)} FROM questions_v2 WHERE prompt = 'legacy quality'"
        ).fetchone()
    accuracy, answers, quality, reports, active, *nullable_vals = row
    assert (accuracy, answers, quality, reports, active) == (0.0, 0, 5.0, 0, 1)
    # AI provenance fields stay NULL for legacy real-exam rows. content_hash
    # was nullable at 1013 but the 1014 backfill populates it; that field is
    # asserted in the WU-B10.3 test bench, not here.
    chash, ai_src, ai_audit, ai_gen = nullable_vals
    assert (ai_src, ai_audit, ai_gen) == (None, None, None)
    assert chash is None or len(chash) == 32  # NULL pre-1014, 32-hex post-1014


def test_self_fk_set_null_on_source_delete(tmp_path: Path) -> None:
    """Hard-deleting a real-exam row sets its derived AI item's
    ai_source_question_id to NULL rather than cascading the delete."""
    _, env, db_url = _make_database(tmp_path)
    _alembic(env, "upgrade", "head")
    revision_id = _seed_paper_revision(db_url, suffix="ai-fk")

    engine = _engine_with_fk(db_url)
    try:
        with Session(engine) as session:
            real_exam = QuestionV2(
                revision_id=revision_id, item_no=1, subject_kind="xingce",
                prompt="real exam", answer_kind="single_choice", status="draft",
                content_json={},
            )
            session.add(real_exam)
            session.flush()
            ai_item = QuestionV2(
                revision_id=revision_id, item_no=2, subject_kind="xingce",
                prompt="ai adapted", answer_kind="single_choice", status="draft",
                content_json={}, source="ai_modified", ai_source_question_id=real_exam.id,
                ai_self_audit_passed=True,
                ai_generated_at=datetime(2026, 5, 22, tzinfo=timezone.utc).replace(tzinfo=None),
            )
            session.add(ai_item)
            session.commit()
            real_exam_id, ai_item_id = real_exam.id, ai_item.id

        with Session(engine) as session:
            session.delete(session.get(QuestionV2, real_exam_id))
            session.commit()

        with Session(engine) as session:
            survived = session.get(QuestionV2, ai_item_id)
            assert survived is not None
            assert survived.ai_source_question_id is None
            assert survived.source == "ai_modified"
            assert survived.ai_self_audit_passed is True
    finally:
        engine.dispose()


def test_downgrade_then_reupgrade_is_clean(tmp_path: Path) -> None:
    """Round-trip: head -> 1012 -> head must drop then re-add every column +
    the is_active index."""
    db_file, env, _ = _make_database(tmp_path)
    _alembic(env, "upgrade", "head")
    _alembic(env, "downgrade", "1012_question_v2_classification_fields")
    with sqlite3.connect(db_file) as conn:
        cols = {row[1] for row in conn.execute("PRAGMA table_info(questions_v2)")}
        assert all(c not in cols for c in _ALL_COLS), "B10.2 columns must drop"
        indexes = {row[1] for row in conn.execute("PRAGMA index_list(questions_v2)")}
        assert "ix_questions_v2_is_active" not in indexes

    _alembic(env, "upgrade", "head")
    with sqlite3.connect(db_file) as conn:
        cols = {row[1] for row in conn.execute("PRAGMA table_info(questions_v2)")}
        assert all(c in cols for c in _ALL_COLS)
        indexes = {row[1] for row in conn.execute("PRAGMA index_list(questions_v2)")}
        assert "ix_questions_v2_is_active" in indexes
