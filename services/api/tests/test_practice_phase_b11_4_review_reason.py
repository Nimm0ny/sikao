"""Phase-Practice WU-B11.4: review_items_v2 reason enum tests."""

from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import ReviewItemV2, UserV2


_REPO_ROOT = Path(__file__).resolve().parents[3]
_ALEMBIC_INI = _REPO_ROOT / "database" / "migrations" / "alembic.ini"
_API_SRC = _REPO_ROOT / "services" / "api" / "src"


def _make_database(tmp_dir: Path) -> tuple[Path, dict[str, str], str]:
    db_file = tmp_dir / f"b11_4-{uuid4().hex}.db"
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


def test_model_declares_reason_nullable() -> None:
    table = ReviewItemV2.__table__
    assert "reason" in table.c
    assert table.c["reason"].nullable is True


def test_upgrade_applies_column(tmp_path: Path) -> None:
    db_file, env, _ = _make_database(tmp_path)
    _alembic(env, "upgrade", "head")
    with sqlite3.connect(db_file) as conn:
        cols = {row[1]: row for row in conn.execute("PRAGMA table_info(review_items_v2)")}
        assert "reason" in cols and cols["reason"][3] == 0  # nullable


def test_upgrade_leaves_legacy_rows_with_null_reason(tmp_path: Path) -> None:
    """Pre-1018 review items must come out of upgrade with reason NULL — no
    synthetic backfill, since the historical writer path never set one."""
    db_file, env, db_url = _make_database(tmp_path)
    _alembic(env, "upgrade", "1017_note_v2_question_link_visibility")
    user_id = _seed_user(db_url)
    with sqlite3.connect(db_file) as conn:
        conn.execute(
            "INSERT INTO review_items_v2 "
            "(user_id, source_kind, title, status, metadata_json, created_at, updated_at) "
            "VALUES (?, 'practice', 'legacy item', 'pending', '{}', "
            "datetime('now'), datetime('now'))",
            (user_id,),
        )
        conn.commit()

    _alembic(env, "upgrade", "head")

    with sqlite3.connect(db_file) as conn:
        reason = conn.execute(
            "SELECT reason FROM review_items_v2 WHERE title = 'legacy item'"
        ).fetchone()[0]
    assert reason is None


@pytest.mark.parametrize(
    "reason",
    ["wrong_answer", "low_confidence", "manual_add", "flagged_persistent"],
)
def test_documented_reason_values_round_trip(tmp_path: Path, reason: str) -> None:
    """Every documented reason value (incl. the Tab 2 addition flagged_persistent)
    must round-trip without DB rejection."""
    _, env, db_url = _make_database(tmp_path)
    _alembic(env, "upgrade", "head")
    user_id = _seed_user(db_url)

    engine = create_engine(db_url, future=True)
    try:
        with Session(engine) as session:
            session.add(ReviewItemV2(
                user_id=user_id,
                source_kind="practice",
                title=f"item-{reason}",
                status="pending",
                metadata_json={},
                reason=reason,
            ))
            session.commit()
            stored = session.query(ReviewItemV2).filter_by(title=f"item-{reason}").one()
            assert stored.reason == reason
    finally:
        engine.dispose()


def test_downgrade_then_reupgrade_is_clean(tmp_path: Path) -> None:
    db_file, env, _ = _make_database(tmp_path)
    _alembic(env, "upgrade", "head")
    _alembic(env, "downgrade", "1017_note_v2_question_link_visibility")
    with sqlite3.connect(db_file) as conn:
        cols = {row[1] for row in conn.execute("PRAGMA table_info(review_items_v2)")}
        assert "reason" not in cols

    _alembic(env, "upgrade", "head")
    with sqlite3.connect(db_file) as conn:
        cols = {row[1] for row in conn.execute("PRAGMA table_info(review_items_v2)")}
        assert "reason" in cols
