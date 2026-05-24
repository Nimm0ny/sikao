from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys
from urllib.parse import quote

from sqlalchemy import text
from sqlalchemy.engine import Engine, URL


REPO_ROOT = Path(__file__).resolve().parents[3]
ALEMBIC_INI = REPO_ROOT / "database" / "migrations" / "alembic.ini"


def render_url(url: URL) -> str:
    user = url.username or ""
    password = quote(url.password or "", safe="")
    auth = f"{user}:{password}@" if password else f"{user}@"
    host = url.host or "127.0.0.1"
    port = f":{url.port}" if url.port is not None else ""
    database = url.database or ""
    return f"{url.drivername}://{auth}{host}{port}/{database}"


def run_alembic(database_url: str, *args: str) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url
    env["PYTHONPATH"] = str(REPO_ROOT / "services" / "api" / "src")
    return subprocess.run(
        [sys.executable, "-m", "alembic", "-c", str(ALEMBIC_INI), *args],
        cwd=REPO_ROOT,
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )


def pg_index_names(engine: Engine, table_name: str) -> set[str]:
    with engine.connect() as connection:
        rows = connection.execute(
            text(
                """
                SELECT indexname
                FROM pg_indexes
                WHERE schemaname = 'public'
                  AND tablename = :table_name
                """
            ),
            {"table_name": table_name},
        ).fetchall()
    return {str(row[0]) for row in rows}


def explain_uses_index(
    engine: Engine,
    sql: str,
    params: dict[str, object],
    *,
    expected_index: str,
) -> None:
    with engine.connect() as connection:
        connection.execute(text("SET enable_seqscan TO off"))
        plan_rows = connection.execute(
            text(f"EXPLAIN (COSTS OFF) {sql}"),
            params,
        ).fetchall()
    plan = "\n".join(str(row[0]) for row in plan_rows)
    assert expected_index in plan, plan
