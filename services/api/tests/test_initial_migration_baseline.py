from __future__ import annotations

import importlib.util
from pathlib import Path


def _load_initial_migration_module():
    migration_path = (
        Path(__file__).resolve().parents[3]
        / "database"
        / "migrations"
        / "alembic"
        / "versions"
        / "0001_initial.py"
    )
    spec = importlib.util.spec_from_file_location("migration_0001_initial", migration_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"failed to load migration module from {migration_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_0001_baseline_metadata_excludes_0024_practice_answer_columns() -> None:
    """Fresh DB baseline must not pre-create 0024 practice answer columns.

    If 0001's cloned metadata already contains these columns, a later
    `alembic upgrade head` on a fresh database dies in 0024 with
    DuplicateColumn on PG/SQLite.
    """

    migration = _load_initial_migration_module()
    metadata = migration._baseline_metadata()

    practice_session_answers = metadata.tables["practice_session_answers"]

    assert "elapsed_seconds" not in practice_session_answers.c
    assert "wrong_reason_code" not in practice_session_answers.c
    assert "wrong_reason_source" not in practice_session_answers.c
