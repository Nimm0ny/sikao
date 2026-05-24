"""Phase-Practice WU-B11.2: practice_session_answers_v2 in-session flag tests."""

from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
import json
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import (
    PracticeSessionAnswerV2,
)


_REPO_ROOT = Path(__file__).resolve().parents[3]
_ALEMBIC_INI = _REPO_ROOT / "database" / "migrations" / "alembic.ini"
_API_SRC = _REPO_ROOT / "services" / "api" / "src"


def _make_database(tmp_dir: Path) -> tuple[Path, dict[str, str], str]:
    db_file = tmp_dir / f"b11_2-{uuid4().hex}.db"
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


def _seed_session(db_url: str) -> int:
    database_file = Path(db_url.removeprefix("sqlite:///"))
    now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat(sep=" ")
    with sqlite3.connect(database_file) as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            INSERT INTO users_v2 (public_id, display_name, is_active, created_at, updated_at)
            VALUES (?, ?, 1, ?, ?)
            """,
            (str(uuid4()), "seed user", now, now),
        )
        user_id = cursor.lastrowid
        assert user_id is not None
        user_id = int(user_id)

        columns = {
            row[1]
            for row in cursor.execute("PRAGMA table_info('practice_sessions_v2')").fetchall()
        }
        values: dict[str, object] = {
            "user_id": user_id,
            "track": "xingce",
            "entry_kind": "paper",
            "status": "draft",
            "payload_json": json.dumps({}),
            "started_at": now,
            "updated_at": now,
        }
        if "practice_mode" in columns:
            values["practice_mode"] = "full_set"
        if "source_mode" in columns:
            values["source_mode"] = "paper"
        if "config_snapshot" in columns:
            values["config_snapshot"] = json.dumps({})

        ordered_columns = list(values.keys())
        placeholders = ", ".join("?" for _ in ordered_columns)
        cursor.execute(
            f"""
            INSERT INTO practice_sessions_v2 ({", ".join(ordered_columns)})
            VALUES ({placeholders})
            """,
            tuple(values[column] for column in ordered_columns),
        )
        session_id = cursor.lastrowid
        assert session_id is not None
        session_id = int(session_id)
        connection.commit()
        return session_id


def test_model_declares_columns() -> None:
    table = PracticeSessionAnswerV2.__table__
    assert table.c["flagged"].nullable is False
    assert table.c["viewed_solution"].nullable is False
    assert table.c["view_solution_at"].nullable is True


def test_upgrade_applies_columns(tmp_path: Path) -> None:
    db_file, env, _ = _make_database(tmp_path)
    _alembic(env, "upgrade", "head")
    with sqlite3.connect(db_file) as conn:
        cols = {row[1]: row for row in conn.execute("PRAGMA table_info(practice_session_answers_v2)")}
        assert cols["flagged"][3] == 1  # NOT NULL
        assert cols["viewed_solution"][3] == 1
        assert cols["view_solution_at"][3] == 0  # nullable


def test_upgrade_seeds_legacy_answers_with_defaults(tmp_path: Path) -> None:
    """Pre-1016 answer must come out of upgrade with (false, false, NULL)."""
    db_file, env, db_url = _make_database(tmp_path)
    _alembic(env, "upgrade", "1015_practice_session_practice_mode")
    session_id = _seed_session(db_url)
    with sqlite3.connect(db_file) as conn:
        conn.execute(
            "INSERT INTO practice_session_answers_v2 "
            "(session_id, question_key, display_order, response_json, answered_at) "
            "VALUES (?, 'q-1', 1, '{}', datetime('now'))",
            (session_id,),
        )
        conn.commit()

    _alembic(env, "upgrade", "head")

    with sqlite3.connect(db_file) as conn:
        row = conn.execute(
            "SELECT flagged, viewed_solution, view_solution_at "
            "FROM practice_session_answers_v2 WHERE question_key = 'q-1'"
        ).fetchone()
    assert row == (0, 0, None)


def test_solution_view_round_trip(tmp_path: Path) -> None:
    """An answer that records the user opening the solution must persist
    viewed_solution=true together with a non-NULL view_solution_at."""
    _, env, db_url = _make_database(tmp_path)
    _alembic(env, "upgrade", "head")
    session_id = _seed_session(db_url)

    engine = create_engine(db_url, future=True)
    try:
        with Session(engine) as session:
            session.add(PracticeSessionAnswerV2(
                session_id=session_id,
                question_key="q-flagged",
                display_order=1,
                response_json={},
                flagged=True,
                viewed_solution=True,
                view_solution_at=datetime(2026, 5, 22, tzinfo=timezone.utc).replace(tzinfo=None),
            ))
            session.commit()
            row = session.query(PracticeSessionAnswerV2).filter_by(question_key="q-flagged").one()
            assert row.flagged is True
            assert row.viewed_solution is True
            assert row.view_solution_at is not None
    finally:
        engine.dispose()


def test_downgrade_then_reupgrade_is_clean(tmp_path: Path) -> None:
    db_file, env, _ = _make_database(tmp_path)
    _alembic(env, "upgrade", "head")
    _alembic(env, "downgrade", "1015_practice_session_practice_mode")
    with sqlite3.connect(db_file) as conn:
        cols = {row[1] for row in conn.execute("PRAGMA table_info(practice_session_answers_v2)")}
        for col in ("flagged", "viewed_solution", "view_solution_at"):
            assert col not in cols

    _alembic(env, "upgrade", "head")
    with sqlite3.connect(db_file) as conn:
        cols = {row[1] for row in conn.execute("PRAGMA table_info(practice_session_answers_v2)")}
        for col in ("flagged", "viewed_solution", "view_solution_at"):
            assert col in cols
