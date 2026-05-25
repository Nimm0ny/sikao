from __future__ import annotations

from collections.abc import Callable
from collections.abc import Generator
from functools import lru_cache
from pathlib import Path
import sys
import types
from typing import Any

from fastapi import Request
from sqlalchemy import create_engine, event, false, text, true
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.schema import DefaultClause, MetaData
from sqlalchemy.orm import Session, sessionmaker

from sikao_api.core.config import Settings
from sikao_api.db.base import Base


def _enable_sqlite_foreign_keys(dbapi_connection: Any, _connection_record: Any) -> None:
    """SQLite 默认 FK 是 disabled — 必须每个 connect 都执行 PRAGMA 开启,
    否则 ON DELETE CASCADE / SET NULL 静默不生效, dev 上跟 prod PG 行为不一致.

    参考 https://docs.sqlalchemy.org/en/20/dialects/sqlite.html#foreign-key-support.
    Slice 3a 引入 study_plans.token_usage_id ON DELETE SET NULL, 不开 pragma
    时 dev 测试删 llm_token_usage 不会清空 FK, 跟 prod 行为漂移.
    """
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


_SQLITE_RUNTIME_SERVER_DEFAULTS: dict[tuple[str, str], Callable[[], Any]] = {
    ("users_v2", "is_active"): true,
    ("email_contacts_v2", "is_primary"): true,
    ("email_contacts_v2", "is_verified"): false,
    ("phone_contacts_v2", "is_primary"): true,
    ("phone_contacts_v2", "is_verified"): false,
}

_PHASE1_V2_ALEMBIC_SCOPE = "phase1_v2"
_SHADOW_BASE_IMPORT = "from sikao_api.db.base import Base"


def _include_phase1_v2_name(
    name: str | None,
    type_: str,
    parent_names: dict[str, str | None],
) -> bool:
    if type_ == "schema":
        return name in {None, ""}
    if type_ == "table":
        return name == "alembic_version" or bool(name and name.endswith("_v2"))
    if type_ in {
        "column",
        "index",
        "unique_constraint",
        "foreign_key_constraint",
        "primary_key_constraint",
    }:
        table_name = parent_names.get("table_name")
        return bool(table_name and table_name.endswith("_v2"))
    return True


def _clone_metadata(source: MetaData) -> MetaData:
    cloned = MetaData()
    for table in list(source.tables.values()):
        table.to_metadata(cloned)
    return cloned


def _clone_phase1_v2_metadata(source: MetaData) -> MetaData:
    cloned = MetaData()
    for table in list(source.tables.values()):
        if table.name.endswith("_v2"):
            table.to_metadata(cloned)
    return cloned


def _apply_sqlite_runtime_defaults(metadata: MetaData) -> None:
    for (table_name, column_name), default_factory in _SQLITE_RUNTIME_SERVER_DEFAULTS.items():
        column = metadata.tables[table_name].c[column_name]
        column.server_default = DefaultClause(default_factory())


@lru_cache(maxsize=2)
def _load_isolated_metadata_snapshot(module_filename: str) -> MetaData:
    module_path = Path(__file__).with_name(module_filename)
    shadow_module_name = f"sikao_api.db._shadow_{module_path.stem}"
    module_source = module_path.read_text(encoding="utf-8")
    if _SHADOW_BASE_IMPORT not in module_source:
        raise RuntimeError(f"Unable to shadow Base import in {module_path}")
    shadow_source = module_source.replace(
        _SHADOW_BASE_IMPORT,
        "Base = __sikao_shadow_base__",
        1,
    )

    class ShadowBase(DeclarativeBase):
        pass

    shadow_module = types.ModuleType(shadow_module_name)
    shadow_module.__dict__.update(
        {
            "__builtins__": __builtins__,
            "__file__": str(module_path),
            "__name__": shadow_module_name,
            "__package__": "sikao_api.db",
            "__sikao_shadow_base__": ShadowBase,
        }
    )

    try:
        sys.modules[shadow_module_name] = shadow_module
        exec(
            compile(shadow_source, str(module_path), "exec"),
            shadow_module.__dict__,
            shadow_module.__dict__,
        )
        return _clone_metadata(ShadowBase.metadata)
    finally:
        sys.modules.pop(shadow_module_name, None)


def _load_isolated_metadata(module_filename: str) -> MetaData:
    return _clone_metadata(_load_isolated_metadata_snapshot(module_filename))


def _load_base_models_metadata() -> MetaData:
    from sikao_api.db import models  # noqa: F401

    if any(table_name.endswith("_v2") for table_name in Base.metadata.tables):
        return _load_isolated_metadata("models.py")
    return _clone_metadata(Base.metadata)


def _append_v2_tables(metadata: MetaData) -> None:
    isolated_v2 = _load_isolated_metadata("models_v2.py")
    for table in list(isolated_v2.tables.values()):
        table.to_metadata(metadata)


def _build_phase1_metadata() -> MetaData:
    metadata = _load_base_models_metadata()
    _append_v2_tables(metadata)
    _apply_sqlite_runtime_defaults(metadata)
    return metadata


def build_alembic_compare_options() -> dict[str, bool]:
    return {
        "compare_type": True,
        "compare_server_default": True,
    }


def build_alembic_include_name(
    scope: str | None,
) -> Callable[[str | None, str, dict[str, str | None]], bool] | None:
    if scope in {None, ""}:
        return None
    if scope == _PHASE1_V2_ALEMBIC_SCOPE:
        return _include_phase1_v2_name
    raise RuntimeError(f"Unsupported Alembic metadata scope: {scope}")


def build_alembic_target_metadata(scope: str | None = None) -> MetaData:
    metadata = _build_phase1_metadata()
    if scope in {None, ""}:
        return metadata
    if scope == _PHASE1_V2_ALEMBIC_SCOPE:
        return _clone_phase1_v2_metadata(metadata)
    raise RuntimeError(f"Unsupported Alembic metadata scope: {scope}")


class DatabaseManager:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        connect_args = {"check_same_thread": False} if settings.is_sqlite else {}
        engine_kwargs: dict[str, object] = {"echo": settings.db_echo, "connect_args": connect_args}
        if not settings.is_sqlite:
            engine_kwargs["pool_size"] = settings.db_pool_size
            engine_kwargs["max_overflow"] = settings.db_pool_max_overflow
        self.engine = create_engine(settings.database_url, **engine_kwargs)
        if settings.is_sqlite:
            event.listen(self.engine, "connect", _enable_sqlite_foreign_keys)
        self.session_factory = sessionmaker(bind=self.engine, autoflush=False, autocommit=False, expire_on_commit=False)

    def create_all(self) -> None:
        if not self.settings.is_sqlite:
            raise RuntimeError(
                "DatabaseManager.create_all is SQLite-only convenience; "
                "use Alembic migrations for non-SQLite databases."
            )
        load_runtime_metadata().create_all(self.engine)

    def ping(self) -> None:
        with self.engine.connect() as connection:
            connection.execute(text("SELECT 1"))


def load_runtime_metadata() -> MetaData:
    return _build_phase1_metadata()


def get_engine(request: Request) -> Engine:
    return request.app.state.db.engine


def get_db_session(request: Request) -> Generator[Session, None, None]:
    session = request.app.state.db.session_factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
