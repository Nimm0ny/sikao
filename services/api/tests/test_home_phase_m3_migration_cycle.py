from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

from alembic.config import Config


def test_home_m3_drop_migration_supports_downgrade_and_reupgrade(tmp_path: Path) -> None:
    database_file = (
        Path(__file__).resolve().parents[3] / "tmp" / f"home-m3-migrate-{uuid4().hex}.db"
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

    root = Path(__file__).resolve().parents[3]
    subprocess.run(
        [sys.executable, "-m", "alembic", "-c", str(cfg.config_file_name), "upgrade", "head"],
        check=True,
        cwd=root,
        env=env,
    )
    subprocess.run(
        [
            sys.executable,
            "-m",
            "alembic",
            "-c",
            str(cfg.config_file_name),
            "downgrade",
            "1009_home_practice_session_occurrence_ref",
        ],
        check=True,
        cwd=root,
        env=env,
    )

    with sqlite3.connect(database_file) as conn:
        tables_after_downgrade = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
    assert "daily_plans_v2" in tables_after_downgrade
    assert "daily_plan_items_v2" in tables_after_downgrade
    assert "weekly_plans_v2" in tables_after_downgrade

    subprocess.run(
        [sys.executable, "-m", "alembic", "-c", str(cfg.config_file_name), "upgrade", "head"],
        check=True,
        cwd=root,
        env=env,
    )

    with sqlite3.connect(database_file) as conn:
        tables_after_reupgrade = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
    assert "daily_plans_v2" not in tables_after_reupgrade
    assert "daily_plan_items_v2" not in tables_after_reupgrade
    assert "weekly_plans_v2" not in tables_after_reupgrade
