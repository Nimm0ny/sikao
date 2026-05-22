from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Iterator

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import EssayReportV2, EssaySubmissionV2, PracticeSessionAnswerV2, PracticeSessionV2, UserV2
from sikao_api.main import create_app


@contextmanager
def build_client(tmp_path: Path) -> Iterator[tuple[TestClient, FastAPI]]:
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'home-m2-profile-records.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="home-m2-profile-secret",
        app_version="home-m2-test",
        git_sha="home-m2-sha",
        image_tag="home-m2-tag",
        build_time="2026-05-21T00:00:00Z",
        schema_version="home-m2-schema",
    )
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as client:
        yield client, app


def _register(client: TestClient) -> None:
    response = client.post(
        "/api/v2/auth/register/email",
        json={"email": "alice@example.com", "password": "secret123", "displayName": "Alice"},
    )
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = response.cookies["csrf_token_v2"]


def _load_user(app: FastAPI) -> UserV2:
    session = app.state.db.session_factory()
    try:
        user = session.scalar(select(UserV2).where(UserV2.display_name == "Alice"))
        assert user is not None
        session.expunge(user)
        return user
    finally:
        session.close()


def test_profile_extensions_and_records_canonicalization(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        _register(client)
        user = _load_user(app)

        goals = client.put(
            "/api/v2/profile/goals",
            json={
                "targetExam": "legacy-exam",
                "targetScore": 70,
                "weeklyTargetHours": 12,
                "examTargets": [
                    {
                        "examId": "guokao-2027",
                        "examName": "Guokao 2027",
                        "examDate": "2027-11-26",
                        "subjects": ["xingce", "essay"],
                    }
                ],
            },
        )
        assert goals.status_code == 200, goals.text
        assert goals.json()["targetExam"] == "legacy-exam"
        assert goals.json()["examTargets"][0]["examId"] == "guokao-2027"

        info = client.put(
            "/api/v2/profile/info",
            json={"aiAdjustEnabled": False, "dashboardPreferences": {"sectionOrder": ["b", "a", "c"]}},
        )
        assert info.status_code == 200, info.text
        assert info.json()["displayName"] == "Alice"
        assert info.json()["aiAdjustEnabled"] is False
        assert info.json()["dashboardPreferences"]["sectionOrder"] == ["b", "a", "c"]

        info_again = client.put(
            "/api/v2/profile/info",
            json={"recommenderPreferences": {"restBias": "low"}},
        )
        assert info_again.status_code == 200, info_again.text
        assert info_again.json()["aiAdjustEnabled"] is False
        assert info_again.json()["recommenderPreferences"]["restBias"] == "low"

        session = app.state.db.session_factory()
        try:
            session.add(
                PracticeSessionV2(
                    user_id=user.id,
                    track="xingce",
                    entry_kind="manual",
                    status="submitted",
                    started_at=datetime(2026, 6, 15, 1, 0),
                    submitted_at=datetime(2026, 6, 15, 1, 20),
                    payload_json={"subject": "yanyu"},
                )
            )
            session.add(
                PracticeSessionV2(
                    user_id=user.id,
                    track="xingce",
                    entry_kind="manual",
                    status="draft",
                    started_at=datetime(2026, 6, 16, 1, 0),
                    submitted_at=None,
                    payload_json={"subject": "shuliang"},
                )
            )
            session.flush()
            session.add_all(
                [
                    PracticeSessionAnswerV2(
                        session_id=1,
                        question_key="1",
                        display_order=1,
                        response_json={},
                        is_correct=True,
                    ),
                    PracticeSessionAnswerV2(
                        session_id=1,
                        question_key="2",
                        display_order=2,
                        response_json={},
                        is_correct=False,
                    ),
                ]
            )
            submission = EssaySubmissionV2(
                user_id=user.id,
                content="essay content",
                status="submitted",
                submitted_at=datetime(2026, 6, 15, 2, 0),
            )
            session.add(submission)
            session.flush()
            session.add(
                EssayReportV2(
                    submission_id=submission.id,
                    status="completed",
                    score=Decimal("72.50"),
                    feedback_json={},
                )
            )
            session.commit()
        finally:
            session.close()

        records = client.get(
            "/api/v2/profile/records",
            params={
                "page": 1,
                "size": 10,
                "kind": "xingce_practice",
                "status": "completed",
                "from": "2026-06-15",
                "to": "2026-06-15",
                "session_id": 1,
            },
        )
        assert records.status_code == 200, records.text
        assert records.json()["total"] == 1
        assert records.json()["items"][0]["id"] == "practice-1"

        day_window = client.get(
            "/api/v2/profile/records",
            params={
                "page": 1,
                "size": 10,
                "from": "2026-06-15",
                "to": "2026-06-15",
            },
        )
        assert day_window.status_code == 200, day_window.text
        assert day_window.json()["total"] == 2
        assert {item["id"] for item in day_window.json()["items"]} == {
            "practice-1",
            f"essay-submission-{submission.id}",
        }

        legacy_dashboard_records = client.get("/api/v2/dashboard/records")
        assert legacy_dashboard_records.status_code == 404, legacy_dashboard_records.text

        openapi = client.get("/openapi.json")
        assert openapi.status_code == 200
        paths = openapi.json()["paths"]
        assert "/api/v2/plans" in paths
        assert "/api/v2/plans/events" in paths
        assert "/api/v2/recommendations/today" in paths
        assert "/api/v2/profile/records" in paths
        assert "/api/v2/dashboard/records" not in paths
