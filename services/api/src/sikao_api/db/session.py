from __future__ import annotations

from collections.abc import Generator
from typing import Any

from fastapi import Request
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
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
        from sikao_api.db import models  # noqa: F401
        from sikao_api.db import models_v2  # noqa: F401

        Base.metadata.create_all(self.engine)

    def ping(self) -> None:
        with self.engine.connect() as connection:
            connection.execute(text("SELECT 1"))


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
