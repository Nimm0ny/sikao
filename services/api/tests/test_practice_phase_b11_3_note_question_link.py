"""Phase-Practice WU-B11.3: notes_v2 question-link + visibility tests."""

from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
from pathlib import Path
from typing import Any, cast
from uuid import uuid4
from datetime import datetime, timezone

from sqlalchemy import Table, create_engine, event
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import (
    NoteV2,
    QuestionV2,
)


_REPO_ROOT = Path(__file__).resolve().parents[3]
_ALEMBIC_INI = _REPO_ROOT / "database" / "migrations" / "alembic.ini"
_API_SRC = _REPO_ROOT / "services" / "api" / "src"


def _enable_sqlite_fk(dbapi_connection: Any, _record: Any) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def _make_database(tmp_dir: Path) -> tuple[Path, dict[str, str], str]:
    db_file = tmp_dir / f"b11_3-{uuid4().hex}.db"
    db_file.parent.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    db_url = f"sqlite:///{db_file.as_posix()}"
    env["DATABASE_URL"] = db_url
    env["PYTHONPATH"] = str(_API_SRC)
    return db_file, env, db_url


def _alembic(env: dict[str, str], *args: str) -> None:
    subprocess.run(
        [sys.executable, "-m", "alembic", "-c", str(_ALEMBIC_INI), *args],
        check=True, cwd=_REPO_ROOT, env=env,
    )


def _engine_with_fk(db_url: str):
    engine = create_engine(db_url, future=True)
    event.listen(engine, "connect", _enable_sqlite_fk)
    return engine


def _seed_user_and_question(db_url: str) -> tuple[int, int]:
    database_file = Path(db_url.removeprefix("sqlite:///"))
    now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat(sep=" ")
    with sqlite3.connect(database_file) as connection:
        cursor = connection.cursor()
        def insert_row(table_name: str, values: dict[str, object]) -> int:
            columns = {
                row[1]
                for row in cursor.execute(f"PRAGMA table_info('{table_name}')").fetchall()
            }
            ordered_columns = [column for column in values if column in columns]
            placeholders = ", ".join("?" for _ in ordered_columns)
            cursor.execute(
                f"""
                INSERT INTO {table_name} ({", ".join(ordered_columns)})
                VALUES ({placeholders})
                """,
                tuple(values[column] for column in ordered_columns),
            )
            row_id = cursor.lastrowid
            assert row_id is not None
            return int(row_id)

        user_id = insert_row(
            "users_v2",
            {
                "public_id": str(uuid4()),
                "display_name": "seed user",
                "is_active": 1,
                "created_at": now,
                "updated_at": now,
            },
        )

        paper_id = insert_row(
            "papers_v2",
            {
                "paper_code": f"p-{uuid4().hex}",
                "title": "paper",
                "subject_kind": "xingce",
                "created_at": now,
                "updated_at": now,
            },
        )

        revision_id = insert_row(
            "paper_revisions_v2",
            {
                "paper_id": paper_id,
                "revision_number": 1,
                "status": "draft",
                "created_at": now,
                "updated_at": now,
            },
        )

        question_id = insert_row(
            "questions_v2",
            {
                "revision_id": revision_id,
                "item_no": 1,
                "subject_kind": "xingce",
                "prompt": "linked prompt",
                "answer_kind": "single_choice",
                "status": "draft",
                "content_json": "{}",
                "source": "real_exam",
                "exam_type": "other",
                "category_l1": "uncategorized",
                "created_at": now,
                "updated_at": now,
            },
        )
        connection.commit()
        return user_id, question_id


def test_model_declares_link_and_visibility() -> None:
    table = cast(Table, NoteV2.__table__)
    assert table.c["linked_question_id"].nullable is True
    assert table.c["visibility"].nullable is False
    fk = next(iter(table.c["linked_question_id"].foreign_keys))
    assert fk.column.table.name == "questions_v2"
    assert fk.ondelete == "SET NULL"
    assert "ix_notes_v2_user_question" in {idx.name for idx in table.indexes}


def test_upgrade_applies_columns_and_index(tmp_path: Path) -> None:
    db_file, env, _ = _make_database(tmp_path)
    _alembic(env, "upgrade", "head")
    with sqlite3.connect(db_file) as conn:
        cols = {row[1]: row for row in conn.execute("PRAGMA table_info(notes_v2)")}
        assert cols["linked_question_id"][3] == 0  # nullable
        assert cols["visibility"][3] == 1  # NOT NULL
        indexes = {row[1] for row in conn.execute("PRAGMA index_list(notes_v2)")}
        assert "ix_notes_v2_user_question" in indexes


def test_upgrade_seeds_legacy_notes_with_defaults(tmp_path: Path) -> None:
    """Pre-1017 note row must come out of upgrade with linked_question_id NULL
    and visibility='private'."""
    db_file, env, db_url = _make_database(tmp_path)
    _alembic(env, "upgrade", "1016_practice_answer_flag_view_solution")
    user_id, _ = _seed_user_and_question(db_url)
    with sqlite3.connect(db_file) as conn:
        conn.execute(
            "INSERT INTO notes_v2 (user_id, title, body, status, created_at, updated_at) "
            "VALUES (?, 'legacy note', '', 'active', datetime('now'), datetime('now'))",
            (user_id,),
        )
        conn.commit()

    _alembic(env, "upgrade", "head")

    with sqlite3.connect(db_file) as conn:
        row = conn.execute(
            "SELECT linked_question_id, visibility FROM notes_v2 WHERE title = 'legacy note'"
        ).fetchone()
    assert row == (None, "private")


def test_question_link_set_null_on_question_delete(tmp_path: Path) -> None:
    """Hard-deleting the linked question must NULL out linked_question_id on
    the note rather than cascading the delete."""
    _, env, db_url = _make_database(tmp_path)
    _alembic(env, "upgrade", "head")
    user_id, question_id = _seed_user_and_question(db_url)

    engine = _engine_with_fk(db_url)
    try:
        with Session(engine) as session:
            note = NoteV2(
                user_id=user_id,
                title="question-attached note",
                body="memory aid body",
                linked_question_id=question_id,
                visibility="private",
            )
            session.add(note)
            session.commit()
            note_id = note.id

        with Session(engine) as session:
            session.delete(session.get(QuestionV2, question_id))
            session.commit()

        with Session(engine) as session:
            survived = session.get(NoteV2, note_id)
            assert survived is not None
            assert survived.linked_question_id is None
            assert survived.body == "memory aid body"
            assert survived.visibility == "private"
    finally:
        engine.dispose()


def test_downgrade_then_reupgrade_is_clean(tmp_path: Path) -> None:
    db_file, env, _ = _make_database(tmp_path)
    _alembic(env, "upgrade", "head")
    _alembic(env, "downgrade", "1016_practice_answer_flag_view_solution")
    with sqlite3.connect(db_file) as conn:
        cols = {row[1] for row in conn.execute("PRAGMA table_info(notes_v2)")}
        for col in ("linked_question_id", "visibility"):
            assert col not in cols
        indexes = {row[1] for row in conn.execute("PRAGMA index_list(notes_v2)")}
        assert "ix_notes_v2_user_question" not in indexes

    _alembic(env, "upgrade", "head")
    with sqlite3.connect(db_file) as conn:
        cols = {row[1] for row in conn.execute("PRAGMA table_info(notes_v2)")}
        for col in ("linked_question_id", "visibility"):
            assert col in cols
