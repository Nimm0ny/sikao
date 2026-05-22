from __future__ import annotations

import json
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from fastapi import FastAPI
from fastapi.testclient import TestClient

from sikao_api.cli.export_openapi import export_openapi
from sikao_api.core.config import Settings
from sikao_api.main import create_app


@contextmanager
def build_client(tmp_path: Path) -> Iterator[tuple[TestClient, FastAPI]]:
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'home-b9-prep.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="home-b9-prep-secret",
        app_version="home-b9-prep-test",
        git_sha="home-b9-prep-sha",
        image_tag="home-b9-prep-tag",
        build_time="2026-05-22T00:00:00Z",
        schema_version="home-b9-prep-schema",
    )
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as client:
        yield client, app


def _register(client: TestClient) -> None:
    response = client.post(
        "/api/v2/auth/register/email",
        json={
            "email": "prep@example.com",
            "password": "secret123",
            "displayName": "Prep User",
        },
    )
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = response.cookies["csrf_token_v2"]


def test_home_b9_prep_export_openapi_matches_runtime_schema_and_exposes_non_cron_surfaces(
    tmp_path: Path,
) -> None:
    output_path = tmp_path / "openapi.json"

    runtime_schema = create_app().openapi()
    result = export_openapi(output_path)

    assert result == 0
    exported_schema = json.loads(output_path.read_text(encoding="utf-8"))
    assert exported_schema == runtime_schema

    paths = exported_schema["paths"]
    assert "/api/v2/plans" in paths
    assert "/api/v2/plans/events" in paths
    assert "/api/v2/recommendations/today" in paths
    assert "/api/v2/dashboard/progress" in paths
    assert "/api/v2/dashboard/full-plan" in paths
    assert "/api/v2/profile/records" in paths
    assert "/api/v2/dashboard/records" in paths


def test_home_b9_prep_non_cron_smoke_and_records_shim_survives(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, _app):
        _register(client)

        plans = client.get("/api/v2/plans")
        assert plans.status_code == 200, plans.text

        events = client.get(
            "/api/v2/plans/events",
            params={"from": "2026-05-22", "to": "2026-05-23"},
        )
        assert events.status_code == 200, events.text

        recommendations = client.get("/api/v2/recommendations/today")
        assert recommendations.status_code == 200, recommendations.text

        progress = client.get("/api/v2/dashboard/progress")
        assert progress.status_code == 200, progress.text

        full_plan = client.get("/api/v2/dashboard/full-plan")
        assert full_plan.status_code == 200, full_plan.text

        profile_records = client.get("/api/v2/profile/records")
        assert profile_records.status_code == 200, profile_records.text

        dashboard_records = client.get("/api/v2/dashboard/records")
        assert dashboard_records.status_code == 200, dashboard_records.text
        payload = dashboard_records.json()
        assert payload["sections"][0]["href"] == "/profile/records"
        assert payload["actions"][0]["href"] == "/profile/records"
