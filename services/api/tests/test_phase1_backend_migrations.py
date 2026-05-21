from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

from alembic.config import Config


def test_phase1_migrations_create_new_tables_without_dropping_legacy(tmp_path: Path) -> None:
    database_file = (
        Path(__file__).resolve().parents[3] / "tmp" / f"phase1-migrate-{uuid4().hex}.db"
    )
    database_file.parent.mkdir(parents=True, exist_ok=True)
    database_url = f"sqlite:///{database_file.as_posix()}"
    cfg = Config(
        str(
            Path(__file__).resolve().parents[3]
            / "database"
            / "migrations"
            / "alembic.ini"
        )
    )
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url
    env["PYTHONPATH"] = str(Path(__file__).resolve().parents[1] / "src")
    subprocess.run(
        [
            sys.executable,
            "-m",
            "alembic",
            "-c",
            str(cfg.config_file_name),
            "upgrade",
            "head",
        ],
        check=True,
        cwd=Path(__file__).resolve().parents[3],
        env=env,
    )

    with sqlite3.connect(database_file) as conn:
        tables = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
        practice_session_columns = {
            row[1] for row in conn.execute("PRAGMA table_info('practice_sessions_v2')").fetchall()
        }

    assert "users" in tables
    assert "papers" in tables
    assert "users_v2" in tables
    assert "papers_v2" in tables
    assert "practice_sessions_v2" in tables
    assert "essay_reports_v2" in tables
    assert "profile_goals_v2" in tables
    assert "plan_v2" in tables
    assert "plan_event_v2" in tables
    assert "plan_adjustment_v2" in tables
    assert "recommendation_v2" in tables
    assert "recommendation_feedback_v2" in tables
    assert "idempotency_key_v2" in tables
    assert "llm_call_v2" in tables
    assert "audit_log_v2" in tables
    assert "linked_plan_event_occurrence_ref" in practice_session_columns
    assert "daily_plans_v2" not in tables
    assert "daily_plan_items_v2" not in tables
    assert "weekly_plans_v2" not in tables
