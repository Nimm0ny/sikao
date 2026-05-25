from __future__ import annotations

import os
from pathlib import Path
from typing import Any, cast

from fastapi.testclient import TestClient
import pytest

import sikao_api.main as main_module
from sikao_api.core.config import Settings
from sikao_api.main import create_app

from _helpers.notes_search_support import InMemoryNotesSearchClient
from _helpers.postgres_temp_db import build_postgres_engine
from _review_phase_r1_support import render_url


def _build_settings(tmp_path: Path, *, database_url: str) -> Settings:
    return Settings(
        app_env="test",
        database_url=database_url,
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="startup-contract-secret",
        meili_url="http://meili.test",
        meili_master_key="startup-contract-key",
    )


def test_notes_search_settings_require_url_and_key_together(tmp_path: Path) -> None:
    settings = Settings(
        app_env="test",
        database_url="postgresql+psycopg://postgres@127.0.0.1:15433/postgres",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="startup-contract-secret",
        meili_url="http://meili.test",
    )
    with pytest.raises(RuntimeError, match="MEILI_URL and MEILI_MASTER_KEY"):
        settings.validate_runtime()


def test_notes_search_create_app_rejects_half_config_settings(tmp_path: Path) -> None:
    settings = Settings(
        app_env="test",
        database_url="postgresql+psycopg://postgres@127.0.0.1:15433/postgres",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="startup-contract-secret",
        meili_master_key="startup-contract-key",
    )
    with pytest.raises(RuntimeError, match="MEILI_URL and MEILI_MASTER_KEY"):
        create_app(settings=settings, initialize_schema=False)


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_notes_search_blank_string_config_is_treated_as_disabled(
    tmp_path: Path,
) -> None:
    with build_postgres_engine("sikao_notes_n3_blank_meili") as engine:
        settings = Settings(
            app_env="test",
            database_url=render_url(engine.url),
            upload_dir=tmp_path / "uploads",
            import_tmp_dir=tmp_path / "imports",
            jwt_secret="startup-contract-secret",
            meili_url="   ",
            meili_master_key="   ",
        )
        with TestClient(create_app(settings=settings, initialize_schema=False)) as client:
            app = cast(Any, client.app)
            assert app.state.notes_search_client.is_enabled is False


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_notes_search_startup_init_runs_when_meili_is_configured(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_client = InMemoryNotesSearchClient()
    monkeypatch.setattr(main_module, "build_notes_search_client", lambda settings: fake_client)

    with build_postgres_engine("sikao_notes_n3_startup") as engine:
        settings = _build_settings(tmp_path, database_url=render_url(engine.url))
        with TestClient(create_app(settings=settings, initialize_schema=False)) as client:
            app = cast(Any, client.app)
            assert app.state.notes_search_client is fake_client
            assert fake_client.init_calls == 1


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_notes_search_startup_init_failure_does_not_block_boot(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_client = InMemoryNotesSearchClient(fail_init=True)
    monkeypatch.setattr(main_module, "build_notes_search_client", lambda settings: fake_client)

    with build_postgres_engine("sikao_notes_n3_startup_fail") as engine:
        settings = _build_settings(tmp_path, database_url=render_url(engine.url))
        with TestClient(create_app(settings=settings, initialize_schema=False)) as client:
            response = client.get("/openapi.json")
            assert response.status_code == 200
            app = cast(Any, client.app)
            assert app.state.notes_search_client is fake_client
            assert fake_client.init_calls == 1
