from __future__ import annotations

from contextlib import contextmanager
import os
from typing import Iterator
from urllib.parse import quote
from uuid import uuid4

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, URL, make_url


def _render_url(url: URL) -> str:
    user = url.username or ""
    password = quote(url.password or "", safe="")
    auth = f"{user}:{password}@" if password else f"{user}@"
    host = url.host or "127.0.0.1"
    port = f":{url.port}" if url.port is not None else ""
    database = url.database or ""
    return f"{url.drivername}://{auth}{host}{port}/{database}"


@contextmanager
def build_postgres_engine(prefix: str) -> Iterator[Engine]:
    base_url = make_url(os.environ["TEST_POSTGRESQL_URL"])
    test_database = f"{prefix}_{uuid4().hex[:8]}"
    database_url = _render_url(base_url.set(database=test_database))
    admin_url = base_url.set(database="template1")
    admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    with admin_engine.begin() as connection:
        connection.execute(text(f'DROP DATABASE IF EXISTS "{test_database}"'))
        connection.execute(text(f'CREATE DATABASE "{test_database}"'))

    engine = create_engine(database_url)
    try:
        yield engine
    finally:
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
