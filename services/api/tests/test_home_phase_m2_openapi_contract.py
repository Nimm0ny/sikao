from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from sikao_api.core.config import Settings
from sikao_api.main import create_app


def test_home_m2_openapi_exposes_routes_and_link_fields(tmp_path: Path) -> None:
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'home-m2-openapi.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="home-m2-openapi-secret",
        app_version="home-m2-test",
        git_sha="home-m2-sha",
        image_tag="home-m2-tag",
        build_time="2026-05-21T00:00:00Z",
        schema_version="home-m2-schema",
    )
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as client:
        response = client.get("/openapi.json")
    assert response.status_code == 200, response.text
    schema = response.json()
    paths = schema["paths"]
    assert "/api/v2/plans" in paths
    assert "/api/v2/plans/events" in paths
    assert "/api/v2/plans/adjustments/{adjustment_id}/accept" in paths
    assert "/api/v2/recommendations/refresh" in paths
    assert "/api/v2/profile/records" in paths

    practice_session_create = schema["components"]["schemas"]["PracticeSessionCreateRequestV2"]
    properties = practice_session_create["properties"]
    assert "linkedPlanEventId" in properties
    assert "linkedPlanEventOccurrenceRef" in properties
    assert "linkedRecommendationId" in properties
