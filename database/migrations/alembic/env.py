from __future__ import annotations

import os
import sys
from collections.abc import Iterator
from contextlib import contextmanager
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from alembic.ddl.impl import DefaultImpl
from sqlalchemy import Column, MetaData, PrimaryKeyConstraint, String, Table, engine_from_config, inspect, pool

_REPO_ROOT = Path(__file__).resolve().parents[3]
_API_SRC = _REPO_ROOT / "services" / "api" / "src"

if str(_API_SRC) not in sys.path:
    sys.path.insert(0, str(_API_SRC))

from sikao_api.core.config import get_settings  # noqa: E402
from sikao_api.db.session import build_alembic_compare_options  # noqa: E402
from sikao_api.db.session import build_alembic_include_name  # noqa: E402
from sikao_api.db.session import build_alembic_target_metadata  # noqa: E402


config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

settings = get_settings()
configured_url = config.get_main_option("sqlalchemy.url")
database_url = os.environ.get("DATABASE_URL") or configured_url or settings.database_url
config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
scope = os.environ.get("SIKAO_ALEMBIC_TARGET_SCOPE")
target_metadata = build_alembic_target_metadata(scope=scope)
include_name = build_alembic_include_name(scope)

# alembic 默认 alembic_version.version_num VARCHAR(32). 我们的 revision id
# 含描述 ("0002_wrong_question_mastery_and_subject" = 40 chars), 在 PG 上 UPDATE
# 触发 22001 "value too long for type character varying(32)". 跨方言加宽到
# String(64) 让长 revision id 安全 stamp. (P1 review fix Phase 7.1 — PG
# container alembic upgrade head 验证发现.)
def _wide_version_table_impl(self, *, version_table, version_table_schema, version_table_pk, **kw):
    vt = Table(
        version_table,
        MetaData(),
        Column("version_num", String(64), nullable=False),
        schema=version_table_schema,
    )
    if version_table_pk:
        vt.append_constraint(
            PrimaryKeyConstraint("version_num", name=f"{version_table}_pkc"),
        )
    return vt


@contextmanager
def _patched_version_table_impl() -> Iterator[None]:
    previous_impl = DefaultImpl.version_table_impl
    DefaultImpl.version_table_impl = _wide_version_table_impl  # type: ignore[method-assign]
    try:
        yield
    finally:
        DefaultImpl.version_table_impl = previous_impl  # type: ignore[method-assign]


def _version_table_name() -> str:
    return config.get_main_option("version_table") or "alembic_version"


def _version_table_schema() -> str | None:
    schema = config.get_main_option("version_table_schema")
    return schema or None


def _version_table_exists(connection) -> bool:
    exists = inspect(connection).has_table(
        _version_table_name(),
        schema=_version_table_schema(),
    )
    if connection.in_transaction():
        connection.rollback()
    return exists


@contextmanager
def _noop_context() -> Iterator[None]:
    yield


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    configure_kwargs: dict[str, object] = {
        "url": url,
        "target_metadata": target_metadata,
        "literal_binds": True,
        **build_alembic_compare_options(),
    }
    if include_name is not None:
        configure_kwargs["include_name"] = include_name
    with _patched_version_table_impl():
        context.configure(
            **configure_kwargs,
        )
        with context.begin_transaction():
            context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        configure_kwargs = {
            "connection": connection,
            "target_metadata": target_metadata,
            **build_alembic_compare_options(),
        }
        if include_name is not None:
            configure_kwargs["include_name"] = include_name
        patch_context = (
            _patched_version_table_impl()
            if not _version_table_exists(connection)
            else _noop_context()
        )
        with patch_context:
            context.configure(**configure_kwargs)
            with context.begin_transaction():
                context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
