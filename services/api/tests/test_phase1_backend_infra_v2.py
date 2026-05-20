from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.schema import MetaData

from sikao_api.core.config import Settings
from sikao_api.db.session import (
    DatabaseManager,
    build_alembic_compare_options,
    build_alembic_include_name,
    build_alembic_target_metadata,
)
from sikao_api.main import create_app


REPO_ROOT = Path(__file__).resolve().parents[3]
ALEMBIC_INI = REPO_ROOT / "database" / "migrations" / "alembic.ini"
ALEMBIC_WORKDIR = REPO_ROOT / "database" / "migrations"


def _build_settings(tmp_path: Path, database_name: str) -> Settings:
    return Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / database_name).as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="phase1-infra-secret",
        app_version="phase1-infra-test",
        git_sha="phase1-infra-sha",
        image_tag="phase1-infra-tag",
        build_time="2026-05-20T00:00:00Z",
        schema_version="phase1-infra-schema",
    )


@contextmanager
def _build_client(tmp_path: Path) -> TestClient:
    app = create_app(settings=_build_settings(tmp_path, "phase1-infra.db"), initialize_schema=True)
    with TestClient(app) as client:
        yield client


def _read_tables(database_file: Path) -> set[str]:
    with sqlite3.connect(database_file) as connection:
        rows = connection.execute(
            """
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
              AND name NOT LIKE 'sqlite_%'
            """
        ).fetchall()
    return {row[0] for row in rows}


def _run_alembic_command(
    database_file: Path,
    *args: str,
    extra_env: dict[str, str] | None = None,
    workdir: Path | None = None,
) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["DATABASE_URL"] = f"sqlite:///{database_file.as_posix()}"
    env.pop("PYTHONPATH", None)
    if extra_env is not None:
        env.update(extra_env)
    return subprocess.run(
        [
            sys.executable,
            "-m",
            "alembic",
            "-c",
            str(ALEMBIC_INI),
            *args,
        ],
        cwd=workdir or REPO_ROOT,
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )


def _read_table_columns(database_file: Path, table_name: str) -> list[tuple[str, str, bool, str | None]]:
    with sqlite3.connect(database_file) as connection:
        rows = connection.execute(f"PRAGMA table_info('{table_name}')").fetchall()
    return [(row[1], row[2].upper(), bool(row[3]), row[4]) for row in rows]


def _read_table_indexes(database_file: Path, table_name: str) -> set[tuple[bool, str, tuple[str, ...]]]:
    with sqlite3.connect(database_file) as connection:
        rows = connection.execute(f"PRAGMA index_list('{table_name}')").fetchall()
        indexes: set[tuple[bool, str, tuple[str, ...]]] = set()
        for row in rows:
            index_name = row[1]
            is_unique = bool(row[2])
            origin = str(row[3]).lower()
            if origin == "pk":
                continue
            columns = connection.execute(f"PRAGMA index_info('{index_name}')").fetchall()
            indexes.add((is_unique, origin, tuple(column_row[2] for column_row in columns)))
    return indexes


def _read_table_foreign_keys(database_file: Path, table_name: str) -> set[tuple[tuple[str, ...], str, tuple[str, ...], str]]:
    with sqlite3.connect(database_file) as connection:
        rows = connection.execute(f"PRAGMA foreign_key_list('{table_name}')").fetchall()
    grouped: dict[int, dict[str, object]] = {}
    for row in rows:
        foreign_key = grouped.setdefault(
            int(row[0]),
            {
                "from_columns": [],
                "ref_table": str(row[2]),
                "to_columns": [],
                "on_delete": str(row[6]).upper(),
            },
        )
        from_columns = foreign_key["from_columns"]
        to_columns = foreign_key["to_columns"]
        assert isinstance(from_columns, list)
        assert isinstance(to_columns, list)
        from_columns.append((int(row[1]), str(row[3])))
        to_columns.append((int(row[1]), str(row[4])))
    return {
        (
            tuple(column for _, column in sorted(entry["from_columns"])),
            str(entry["ref_table"]),
            tuple(column for _, column in sorted(entry["to_columns"])),
            str(entry["on_delete"]),
        )
        for entry in grouped.values()
    }


def _flatten_diffs(diffs: list[object]) -> list[tuple[object, ...]]:
    flattened: list[tuple[object, ...]] = []
    for diff in diffs:
        if isinstance(diff, list):
            flattened.extend(_flatten_diffs(diff))
            continue
        if isinstance(diff, tuple):
            flattened.append(diff)
    return flattened


def _v2_tables(table_names: set[str]) -> set[str]:
    return {table_name for table_name in table_names if table_name.endswith("_v2")}


def _build_v2_target_metadata() -> MetaData:
    return build_alembic_target_metadata(scope="phase1_v2")


def _rewrite_sqlite_table_sql(
    database_file: Path,
    table_name: str,
    *,
    replace_from: str,
    replace_to: str,
) -> None:
    with sqlite3.connect(database_file) as connection:
        row = connection.execute(
            """
            SELECT sql
            FROM sqlite_master
            WHERE type = 'table'
              AND name = ?
            """,
            (table_name,),
        ).fetchone()
        assert row is not None
        current_sql = str(row[0])
        updated_sql = current_sql.replace(replace_from, replace_to, 1)
        assert updated_sql != current_sql
        connection.execute("PRAGMA writable_schema=ON")
        connection.execute(
            """
            UPDATE sqlite_master
            SET sql = ?
            WHERE type = 'table'
              AND name = ?
            """,
            (updated_sql, table_name),
        )
        connection.execute("PRAGMA writable_schema=OFF")
        connection.commit()


@pytest.mark.parametrize("path", ["/api/v2/profile/info", "/api/v2/notes/1"])
def test_phase1_cors_preflight_allows_put_routes(tmp_path: Path, path: str) -> None:
    with _build_client(tmp_path) as client:
        response = client.options(
            path,
            headers={
                "Origin": "http://localhost:18080",
                "Access-Control-Request-Method": "PUT",
                "Access-Control-Request-Headers": "content-type,x-csrf-token",
            },
        )

    assert response.status_code == 200, response.text
    allow_methods = {method.strip() for method in response.headers["access-control-allow-methods"].split(",")}
    assert "PUT" in allow_methods
    assert response.headers["access-control-allow-origin"] == "http://localhost:18080"


def test_phase1_runtime_create_all_matches_alembic_sqlite_schema(tmp_path: Path) -> None:
    runtime_db = tmp_path / f"phase1-runtime-{uuid4().hex}.db"
    migration_db = tmp_path / f"phase1-migration-{uuid4().hex}.db"

    runtime_settings = _build_settings(tmp_path, runtime_db.name)
    DatabaseManager(runtime_settings).create_all()

    upgrade = _run_alembic_command(migration_db, "upgrade", "head")
    assert upgrade.returncode == 0, upgrade.stderr or upgrade.stdout

    runtime_tables = _read_tables(runtime_db)
    migration_tables = _read_tables(migration_db) - {"alembic_version"}
    runtime_v2_tables = _v2_tables(runtime_tables)
    migration_v2_tables = _v2_tables(migration_tables)

    assert "users_v2" in runtime_v2_tables
    assert "practice_sessions_v2" in runtime_v2_tables
    assert "profile_goals_v2" in runtime_v2_tables
    assert "notes_v2" in runtime_v2_tables
    assert runtime_v2_tables == migration_v2_tables
    for table_name in sorted(runtime_v2_tables):
        assert _read_table_columns(runtime_db, table_name) == _read_table_columns(migration_db, table_name)
        assert _read_table_indexes(runtime_db, table_name) == _read_table_indexes(migration_db, table_name)
        assert _read_table_foreign_keys(runtime_db, table_name) == _read_table_foreign_keys(migration_db, table_name)

    practice_session_indexes = _read_table_indexes(runtime_db, "practice_sessions_v2")
    assert (False, "c", ("user_id", "started_at")) in practice_session_indexes

    answer_indexes = _read_table_indexes(runtime_db, "practice_session_answers_v2")
    assert (False, "c", ("session_id", "display_order")) in answer_indexes
    assert (True, "u", ("session_id", "question_key")) in answer_indexes

    essay_report_indexes = _read_table_indexes(runtime_db, "essay_reports_v2")
    assert (True, "u", ("submission_id",)) in essay_report_indexes

    practice_session_fks = _read_table_foreign_keys(runtime_db, "practice_sessions_v2")
    assert (("user_id",), "users_v2", ("id",), "CASCADE") in practice_session_fks
    assert (("paper_id",), "papers_v2", ("id",), "SET NULL") in practice_session_fks
    assert (("revision_id",), "paper_revisions_v2", ("id",), "SET NULL") in practice_session_fks


def test_phase1_metadata_builders_do_not_register_v2_tables_on_global_base_in_clean_interpreter() -> None:
    script = """
import sys
from sikao_api.db.base import Base
from sikao_api.db.session import build_alembic_target_metadata, load_runtime_metadata

base_module = sys.modules['sikao_api.db.base']
assert base_module.Base is Base
assert not any(name.startswith('sikao_api.db._shadow_') for name in sys.modules)
assert 'sikao_api.db.models_v2' not in sys.modules
assert not any(name.endswith('_v2') for name in Base.metadata.tables)
target = build_alembic_target_metadata()
runtime = load_runtime_metadata()
assert sys.modules['sikao_api.db.base'] is base_module
assert sys.modules['sikao_api.db.base'].Base is Base
assert not any(name.startswith('sikao_api.db._shadow_') for name in sys.modules)
assert 'sikao_api.db.models_v2' not in sys.modules
assert target is not Base.metadata
assert runtime is not Base.metadata
assert 'users' in Base.metadata.tables
assert 'users_v2' not in Base.metadata.tables
assert target.tables['users'] is not Base.metadata.tables['users']
assert runtime.tables['users'] is not Base.metadata.tables['users']
assert 'users' in target.tables
assert 'users_v2' in target.tables
assert 'notes_v2' in target.tables
assert 'users' in runtime.tables
assert 'users_v2' in runtime.tables
assert 'notes_v2' in runtime.tables
"""
    env = os.environ.copy()
    env["PYTHONPATH"] = str(REPO_ROOT / "services" / "api" / "src")
    process = subprocess.run(
        [sys.executable, "-c", script],
        cwd=REPO_ROOT,
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )
    assert process.returncode == 0, process.stderr or process.stdout


def test_phase1_alembic_compare_options_enable_server_default_drift_detection() -> None:
    assert build_alembic_compare_options() == {
        "compare_type": True,
        "compare_server_default": True,
    }


def test_phase1_inprocess_alembic_upgrade_restores_default_version_table_impl(tmp_path: Path) -> None:
    database_file = tmp_path / f"phase1-inprocess-{uuid4().hex}.db"
    database_url = f"sqlite:///{database_file.as_posix()}"
    script = f"""
import os
import sqlite3
from alembic import command
from alembic.config import Config
from alembic.ddl.impl import DefaultImpl

database_url = {database_url!r}
os.environ['DATABASE_URL'] = database_url
os.environ['SIKAO_ALEMBIC_TARGET_SCOPE'] = 'phase1_v2'

def build_default_version_table():
    return DefaultImpl.version_table_impl(
        object(),
        version_table='alembic_version',
        version_table_schema=None,
        version_table_pk=True,
    )

default_version_table = build_default_version_table()
assert default_version_table.c.version_num.type.length == 32

config = Config({str(ALEMBIC_INI)!r})
command.upgrade(config, 'head')

restored_after_upgrade = build_default_version_table()
assert restored_after_upgrade.c.version_num.type.length == 32

command.check(config)

restored_after_check = build_default_version_table()
assert restored_after_check.c.version_num.type.length == 32

with sqlite3.connect({database_file.as_posix()!r}) as connection:
    columns = connection.execute(\"PRAGMA table_info('alembic_version')\").fetchall()
assert [(row[1], row[2].upper(), bool(row[3]), row[4]) for row in columns] == [
    ('version_num', 'VARCHAR(64)', True, None),
]
"""
    env = os.environ.copy()
    env["PYTHONPATH"] = str(REPO_ROOT / "services" / "api" / "src")
    process = subprocess.run(
        [sys.executable, "-c", script],
        cwd=REPO_ROOT,
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )
    assert process.returncode == 0, process.stderr or process.stdout


def test_phase1_alembic_cli_check_has_no_phase1_v2_drift_after_head(tmp_path: Path) -> None:
    database_file = tmp_path / f"phase1-cli-check-{uuid4().hex}.db"

    upgrade = _run_alembic_command(
        database_file,
        "upgrade",
        "head",
        workdir=ALEMBIC_WORKDIR,
    )
    assert upgrade.returncode == 0, upgrade.stderr or upgrade.stdout

    check = _run_alembic_command(
        database_file,
        "check",
        extra_env={"SIKAO_ALEMBIC_TARGET_SCOPE": "phase1_v2"},
        workdir=ALEMBIC_WORKDIR,
    )

    assert check.returncode == 0, check.stderr or check.stdout


def test_phase1_alembic_cli_check_scopes_to_phase1_v2_tables(tmp_path: Path) -> None:
    legacy_probe_db = tmp_path / f"phase1-cli-scope-legacy-{uuid4().hex}.db"
    scoped_probe_db = tmp_path / f"phase1-cli-scope-v2-{uuid4().hex}.db"

    upgrade = _run_alembic_command(
        legacy_probe_db,
        "upgrade",
        "head",
        workdir=ALEMBIC_WORKDIR,
    )
    assert upgrade.returncode == 0, upgrade.stderr or upgrade.stdout

    with sqlite3.connect(legacy_probe_db) as connection:
        connection.execute("CREATE TABLE scope_probe_legacy (id INTEGER PRIMARY KEY NOT NULL)")
        connection.commit()

    scoped_check = _run_alembic_command(
        legacy_probe_db,
        "check",
        extra_env={"SIKAO_ALEMBIC_TARGET_SCOPE": "phase1_v2"},
        workdir=ALEMBIC_WORKDIR,
    )
    assert scoped_check.returncode == 0, scoped_check.stderr or scoped_check.stdout
    assert "scope_probe_legacy" not in f"{scoped_check.stdout}\n{scoped_check.stderr}"

    scoped_upgrade = _run_alembic_command(
        scoped_probe_db,
        "upgrade",
        "head",
        workdir=ALEMBIC_WORKDIR,
    )
    assert scoped_upgrade.returncode == 0, scoped_upgrade.stderr or scoped_upgrade.stdout

    with sqlite3.connect(scoped_probe_db) as connection:
        connection.execute("CREATE TABLE scope_probe_v2 (id INTEGER PRIMARY KEY NOT NULL)")
        connection.commit()

    scoped_negative_check = _run_alembic_command(
        scoped_probe_db,
        "check",
        extra_env={"SIKAO_ALEMBIC_TARGET_SCOPE": "phase1_v2"},
        workdir=ALEMBIC_WORKDIR,
    )
    assert scoped_negative_check.returncode != 0
    combined_output = f"{scoped_negative_check.stdout}\n{scoped_negative_check.stderr}"
    assert "scope_probe_v2" in combined_output
    assert "scope_probe_legacy" not in combined_output


def test_phase1_compare_metadata_has_no_phase1_v2_drift_after_head(tmp_path: Path) -> None:
    database_file = tmp_path / f"phase1-check-{uuid4().hex}.db"

    upgrade = _run_alembic_command(database_file, "upgrade", "head")
    assert upgrade.returncode == 0, upgrade.stderr or upgrade.stdout

    target_metadata = _build_v2_target_metadata()
    assert "users_v2" in target_metadata.tables
    assert "practice_sessions_v2" in target_metadata.tables
    assert "profile_goals_v2" in target_metadata.tables
    assert "notes_v2" in target_metadata.tables
    assert target_metadata.tables["users_v2"].c["is_active"].server_default is not None
    assert target_metadata.tables["email_contacts_v2"].c["is_primary"].server_default is not None
    assert target_metadata.tables["phone_contacts_v2"].c["is_verified"].server_default is not None

    engine = create_engine(f"sqlite:///{database_file.as_posix()}")
    with engine.connect() as connection:
        context = MigrationContext.configure(
            connection=connection,
            opts={
                **build_alembic_compare_options(),
                "include_name": build_alembic_include_name("phase1_v2"),
            },
        )
        diffs = _flatten_diffs(compare_metadata(context, target_metadata))

    assert diffs == []


def test_phase1_alembic_cli_check_detects_phase1_v2_server_default_drift(tmp_path: Path) -> None:
    database_file = tmp_path / f"phase1-default-drift-{uuid4().hex}.db"

    upgrade = _run_alembic_command(
        database_file,
        "upgrade",
        "head",
        workdir=ALEMBIC_WORKDIR,
    )
    assert upgrade.returncode == 0, upgrade.stderr or upgrade.stdout

    _rewrite_sqlite_table_sql(
        database_file,
        "users_v2",
        replace_from="is_active BOOLEAN DEFAULT 1 NOT NULL",
        replace_to="is_active BOOLEAN DEFAULT 0 NOT NULL",
    )

    check = _run_alembic_command(
        database_file,
        "check",
        extra_env={"SIKAO_ALEMBIC_TARGET_SCOPE": "phase1_v2"},
        workdir=ALEMBIC_WORKDIR,
    )

    assert check.returncode != 0
    combined_output = f"{check.stdout}\n{check.stderr}"
    assert "modify_default" in combined_output
    assert "users_v2" in combined_output
    assert "is_active" in combined_output


def test_phase1_create_all_is_sqlite_only_convenience(tmp_path: Path) -> None:
    settings = _build_settings(tmp_path, "phase1-boundary.db")
    db = DatabaseManager(settings)
    db.settings = SimpleNamespace(is_sqlite=False)

    with pytest.raises(RuntimeError, match="SQLite"):
        db.create_all()
