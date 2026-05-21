from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys
from urllib.parse import quote
from uuid import uuid4

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL, make_url
from sikao_api.core.config import Settings
from sikao_api.main import create_app


def _render_url(url: URL) -> str:
    user = url.username or ""
    password = quote(url.password or "", safe="")
    auth = f"{user}:{password}@" if password else f"{user}@"
    host = url.host or "127.0.0.1"
    port = f":{url.port}" if url.port is not None else ""
    database = url.database or ""
    return f"{url.drivername}://{auth}{host}{port}/{database}"


def _alembic_head_revision() -> str:
    """Read latest alembic revision dynamically — assert 不再 hardcode (跟随
    alembic versions/ 加文件自动跟). B-review B5 修: 老 assert 写死
    "0001_initial", 0002+ ship 后该 test 一直 fail (可惜被 skipif 默认 skip 不
    被 CI 抓).
    """
    cfg = Config(
        str(
            Path(__file__).resolve().parents[3]
            / "database"
            / "migrations"
            / "alembic.ini"
        )
    )
    script = ScriptDirectory.from_config(cfg)
    head = script.get_current_head()
    if head is None:
        raise RuntimeError("alembic versions/ has no head revision")
    return head


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_alembic_upgrade_and_version_endpoint() -> None:
    base_url = make_url(os.environ["TEST_POSTGRESQL_URL"])
    test_database = f"sikao_verify_migration_{uuid4().hex[:8]}"
    database_url_obj = base_url.set(database=test_database)
    database_url = _render_url(database_url_obj)
    admin_url = base_url.set(database="template1")
    admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    with admin_engine.begin() as connection:
        connection.execute(text(f'DROP DATABASE IF EXISTS "{test_database}"'))
        connection.execute(text(f'CREATE DATABASE "{test_database}"'))

    alembic_ini = (
        Path(__file__).resolve().parents[3]
        / "database"
        / "migrations"
        / "alembic.ini"
    )
    previous_database_url = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = database_url
    engine = None
    try:
        env = os.environ.copy()
        env["DATABASE_URL"] = database_url
        env["PYTHONPATH"] = str(Path(__file__).resolve().parents[1] / "src")
        subprocess.run(
            [
                sys.executable,
                "-m",
                "alembic",
                "-c",
                str(alembic_ini),
                "upgrade",
                "head",
            ],
            check=True,
            cwd=Path(__file__).resolve().parents[3],
            env=env,
        )
        engine = create_engine(database_url_obj)
        with engine.begin() as connection:
            connection.execute(text("SELECT 1"))

        settings = Settings(
            app_env="test",
            database_url=database_url,
            upload_dir=Path("./tmp/uploads"),
            import_tmp_dir=Path("./tmp/imports"),
            jwt_secret="postgres-test-secret",
        )
        app = create_app(settings=settings, initialize_schema=False)

        expected_head = _alembic_head_revision()
        from fastapi.testclient import TestClient

        with TestClient(app) as client:
            response = client.get("/version")
            assert response.status_code == 200
            assert response.json()["schemaVersion"] == expected_head
    finally:
        if engine is not None:
            engine.dispose()
        cleanup_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
        try:
            with cleanup_engine.begin() as connection:
                connection.execute(
                    text(
                        """
                        SELECT pg_terminate_backend(pid)
                        FROM pg_stat_activity
                        WHERE datname = :database_name
                          AND pid <> pg_backend_pid()
                        """
                    ),
                    {"database_name": test_database},
                )
                connection.execute(text(f'DROP DATABASE IF EXISTS "{test_database}"'))
        finally:
            cleanup_engine.dispose()
            admin_engine.dispose()
        if previous_database_url is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = previous_database_url
