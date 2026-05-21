from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from sikao_api.core.config import Settings
from sikao_api.main import create_app


def test_home_m3_openapi_exposes_dashboard_contract_and_hides_legacy_routes(tmp_path: Path) -> None:
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'home-m3-openapi.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="home-m3-openapi-secret",
        app_version="home-m3-test",
        git_sha="home-m3-sha",
        image_tag="home-m3-tag",
        build_time="2026-05-21T00:00:00Z",
        schema_version="home-m3-schema",
    )
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as client:
        response = client.get("/openapi.json")

    assert response.status_code == 200, response.text
    schema = response.json()
    paths = schema["paths"]
    assert "/api/v2/dashboard/progress" in paths
    assert "/api/v2/dashboard/progress/timeseries" in paths
    assert "/api/v2/dashboard/full-plan" in paths
    assert "/api/v2/dashboard/weekly-plan/adjust" in paths
    assert "/api/v2/dashboard/today/must-do" not in paths
    assert "/api/v2/practice/study-plan/start" not in paths
    assert "/api/v2/study-plan/today" not in paths

    schemas = schema["components"]["schemas"]
    assert "DashboardProgressResponseV2" in schemas
    assert "DashboardTodayResponseV2" in schemas
    assert "DashboardWeeklyPlanResponseV2" in schemas
    assert "DashboardFullPlanResponseV2" in schemas
