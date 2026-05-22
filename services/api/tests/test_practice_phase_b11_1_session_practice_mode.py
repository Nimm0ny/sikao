"""Phase-Practice WU-B11.1: practice_sessions_v2 mode + config_snapshot tests."""

from __future__ import annotations

import json
import os
import sqlite3
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeSessionV2, UserV2


_REPO_ROOT = Path(__file__).resolve().parents[3]
_ALEMBIC_INI = _REPO_ROOT / "database" / "migrations" / "alembic.ini"
_API_SRC = _REPO_ROOT / "services" / "api" / "src"


def _make_database(tmp_dir: Path) -> tuple[Path, dict[str, str], str]:
    db_file = tmp_dir / f"b11_1-{uuid4().hex}.db"
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


def _seed_user(db_url: str) -> int:
    engine = create_engine(db_url, future=True)
    try:
        with Session(engine) as session:
            user = UserV2(public_id=str(uuid4()), display_name="seed user")
            session.add(user)
            session.commit()
            return user.id
    finally:
        engine.dispose()


def test_model_declares_mode_and_snapshot_columns() -> None:
    """ORM declarations match the migration: NOT NULL strings + JSON snapshot."""
    table = PracticeSessionV2.__table__
    assert table.c["practice_mode"].nullable is False
    assert table.c["source_mode"].nullable is False
    assert table.c["config_snapshot"].nullable is False
    # Defaults must agree with the migration's server_default.
    assert table.c["practice_mode"].default.arg == "full_set"
    assert table.c["source_mode"].default.arg == "paper"


def test_upgrade_applies_columns(tmp_path: Path) -> None:
    db_file, env, _ = _make_database(tmp_path)
    _alembic(env, "upgrade", "head")
    with sqlite3.connect(db_file) as conn:
        cols = {row[1]: row for row in conn.execute("PRAGMA table_info(practice_sessions_v2)")}
        for col in ("practice_mode", "source_mode", "config_snapshot"):
            assert col in cols and cols[col][3] == 1, f"{col} should be NOT NULL"


def test_upgrade_seeds_legacy_sessions_with_defaults(tmp_path: Path) -> None:
    """A pre-1015 session must come out of upgrade with full_set / paper / {}."""
    db_file, env, db_url = _make_database(tmp_path)
    _alembic(env, "upgrade", "1014_question_v2_indexes_and_immutable")
    user_id = _seed_user(db_url)

    with sqlite3.connect(db_file) as conn:
        conn.execute(
            "INSERT INTO practice_sessions_v2 "
            "(user_id, track, entry_kind, status, payload_json, started_at, updated_at) "
            "VALUES (?, 'xingce', 'paper', 'submitted', '{}', "
            "datetime('now'), datetime('now'))",
            (user_id,),
        )
        conn.commit()

    _alembic(env, "upgrade", "head")

    with sqlite3.connect(db_file) as conn:
        row = conn.execute(
            "SELECT practice_mode, source_mode, config_snapshot "
            "FROM practice_sessions_v2 ORDER BY id DESC LIMIT 1"
        ).fetchone()
    practice_mode, source_mode, config_snapshot = row
    assert practice_mode == "full_set"
    assert source_mode == "paper"
    assert json.loads(config_snapshot) == {}


@pytest.mark.parametrize(
    "practice_mode,source_mode,config",
    [
        ("per_question", "category", {"category_l1": "verbal"}),
        ("full_set", "paper", {"paper_id": 42}),
        ("full_set", "custom", {"year_range": [2020, 2024], "count": 30}),
        ("full_set", "ai_generated", {"ai_request_id": 7}),
        ("full_set", "daily", {"daily_practice_id": 12}),
        ("full_set", "wrong_redo", {"only_wrong": True}),
    ],
)
def test_documented_mode_values_round_trip(
    tmp_path: Path,
    practice_mode: str,
    source_mode: str,
    config: dict,
) -> None:
    """Every documented (practice_mode, source_mode) combo with a non-trivial
    config_snapshot must round-trip through the column without DB rejection."""
    _, env, db_url = _make_database(tmp_path)
    _alembic(env, "upgrade", "head")
    user_id = _seed_user(db_url)

    engine = create_engine(db_url, future=True)
    try:
        with Session(engine) as session:
            session.add(PracticeSessionV2(
                user_id=user_id,
                track="xingce",
                entry_kind="paper",
                status="draft",
                payload_json={},
                practice_mode=practice_mode,
                source_mode=source_mode,
                config_snapshot=config,
            ))
            session.commit()

        with Session(engine) as session:
            row = session.query(PracticeSessionV2).order_by(PracticeSessionV2.id.desc()).first()
            assert row is not None
            assert row.practice_mode == practice_mode
            assert row.source_mode == source_mode
            assert row.config_snapshot == config
    finally:
        engine.dispose()


def test_downgrade_then_reupgrade_is_clean(tmp_path: Path) -> None:
    db_file, env, _ = _make_database(tmp_path)
    _alembic(env, "upgrade", "head")
    _alembic(env, "downgrade", "1014_question_v2_indexes_and_immutable")
    with sqlite3.connect(db_file) as conn:
        cols = {row[1] for row in conn.execute("PRAGMA table_info(practice_sessions_v2)")}
        for col in ("practice_mode", "source_mode", "config_snapshot"):
            assert col not in cols

    _alembic(env, "upgrade", "head")
    with sqlite3.connect(db_file) as conn:
        cols = {row[1] for row in conn.execute("PRAGMA table_info(practice_sessions_v2)")}
        for col in ("practice_mode", "source_mode", "config_snapshot"):
            assert col in cols
