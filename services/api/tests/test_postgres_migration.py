from __future__ import annotations

import os
from pathlib import Path

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from alembic import command
from sikao_api.core.config import Settings
from sikao_api.main import create_app


def _alembic_head_revision() -> str:
    """Read latest alembic revision dynamically — assert 不再 hardcode (跟随
    alembic versions/ 加文件自动跟). B-review B5 修: 老 assert 写死
    "0001_initial", 0002+ ship 后该 test 一直 fail (可惜被 skipif 默认 skip 不
    被 CI 抓).
    """
    cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    script = ScriptDirectory.from_config(cfg)
    head = script.get_current_head()
    if head is None:
        raise RuntimeError("alembic versions/ has no head revision")
    return head


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_alembic_upgrade_and_version_endpoint() -> None:
    database_url = os.environ["TEST_POSTGRESQL_URL"]
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))

    alembic_cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    alembic_cfg.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(alembic_cfg, "head")

    settings = Settings(
        app_env="test",
        database_url=database_url,
        upload_dir=Path("./tmp/uploads"),
        import_tmp_dir=Path("./tmp/imports"),
        jwt_secret="postgres-test-secret",
    )
    app = create_app(settings=settings, initialize_schema=False)

    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = SessionLocal()
    expected_head = _alembic_head_revision()
    try:
        with app.router.lifespan_context(app):
            from fastapi.testclient import TestClient

            with TestClient(app) as client:
                response = client.get("/version")
                assert response.status_code == 200
                assert response.json()["schemaVersion"] == expected_head
    finally:
        session.close()
