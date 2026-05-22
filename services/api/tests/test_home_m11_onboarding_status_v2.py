from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi.testclient import TestClient

from sikao_api.core.config import Settings
from sikao_api.main import create_app


def build_client(tmp_path: Path) -> TestClient:
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'home-m11-onboarding.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="home-m11-onboarding-secret",
        app_version="home-m11-test",
        git_sha="home-m11-sha",
        image_tag="home-m11-tag",
        build_time="2026-05-23T00:00:00Z",
        schema_version="home-m11-schema",
    )
    app = create_app(settings=settings, initialize_schema=True)
    return TestClient(app)


def test_onboarding_status_route_tracks_profile_goal_completion(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register = client.post(
            "/api/v2/auth/register/email",
            json={
                "email": "onboarding@example.com",
                "password": "secret123",
                "displayName": "Onboarding User",
            },
        )
        assert register.status_code == 200, register.text

        csrf_cookie = register.cookies.get("csrf_token_v2")
        assert csrf_cookie is not None
        client.headers["X-CSRF-Token"] = csrf_cookie

        initial = client.get("/api/v2/me/onboarding-status")
        assert initial.status_code == 200, initial.text
        assert initial.json() == {
            "hasGoal": False,
            "hasExam": False,
            "isOnboarded": False,
        }

        exam_date = (datetime.now(UTC) + timedelta(days=120)).date().isoformat()
        update = client.put(
            "/api/v2/profile/goals",
            json={
                "weeklyTargetHours": 12,
                "examTargets": [
                    {
                        "examId": "GK-2026",
                        "examName": "国考",
                        "examDate": exam_date,
                        "subjects": ["xingce"],
                    }
                ],
            },
        )
        assert update.status_code == 200, update.text

        completed = client.get("/api/v2/me/onboarding-status")
        assert completed.status_code == 200, completed.text
        assert completed.json() == {
            "hasGoal": True,
            "hasExam": True,
            "isOnboarded": True,
        }
