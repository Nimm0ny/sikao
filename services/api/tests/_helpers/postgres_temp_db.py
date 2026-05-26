from __future__ import annotations

from contextlib import contextmanager
import os
import warnings
from typing import Iterator
from urllib.parse import quote
from uuid import uuid4

from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError
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
    admin_url = base_url.set(database="postgres")
    admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    engine = create_engine(database_url)
    try:
        with admin_engine.begin() as connection:
            connection.execute(text(f'DROP DATABASE IF EXISTS "{test_database}"'))
            # Clone from template0 so local template1 sessions do not block temp DB creation.
            connection.execute(
                text(f'CREATE DATABASE "{test_database}" TEMPLATE template0')
            )
        yield engine
    finally:
        engine.dispose()
        cleanup_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
        try:
            with cleanup_engine.begin() as connection:
                try:
                    connection.execute(text(f'DROP DATABASE IF EXISTS "{test_database}"'))
                except DBAPIError:
                    # Only terminate sessions owned by the current test role; local superuser
                    # sessions (for example autovacuum / admin tools) are outside this helper's scope.
                    connection.execute(
                        text(
                            """
                            SELECT pg_terminate_backend(pid)
                            FROM pg_stat_activity
                            WHERE datname = :database_name
                              AND pid <> pg_backend_pid()
                              AND usename = current_user
                            """
                        ),
                        {"database_name": test_database},
                    )
                    try:
                        connection.execute(
                            text(f'DROP DATABASE IF EXISTS "{test_database}"')
                        )
                    except DBAPIError as exc:
                        warnings.warn(
                            (
                                "best-effort cleanup left temp database "
                                f"{test_database!r} behind: {exc}"
                            ),
                            stacklevel=2,
                        )
        finally:
            cleanup_engine.dispose()
            admin_engine.dispose()
