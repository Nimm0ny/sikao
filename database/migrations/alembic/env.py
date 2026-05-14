from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from alembic.ddl.impl import DefaultImpl
from sqlalchemy import Column, MetaData, PrimaryKeyConstraint, String, Table, engine_from_config, pool

from sikao_api.core.config import get_settings
from sikao_api.db.models import Base


config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.database_url)
target_metadata = Base.metadata

# alembic 默认 alembic_version.version_num VARCHAR(32). 我们的 revision id
# 含描述 ("0002_wrong_question_mastery_and_subject" = 40 chars), 在 PG 上 UPDATE
# 触发 22001 "value too long for type character varying(32)". 跨方言加宽到
# String(64) 让长 revision id 安全 stamp. (P1 review fix Phase 7.1 — PG
# container alembic upgrade head 验证发现.)
_orig_version_table_impl = DefaultImpl.version_table_impl


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


DefaultImpl.version_table_impl = _wide_version_table_impl  # type: ignore[method-assign]


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
