from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from sikao_api.core.config import Settings
from sikao_api.main import create_app


@contextmanager
def build_client(tmp_path: Path) -> TestClient:
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'phase1-backend.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="phase1-test-secret",
        app_version="phase1-test",
        git_sha="phase1-sha",
        image_tag="phase1-tag",
        build_time="2026-05-20T00:00:00Z",
        schema_version="phase1-schema",
    )
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as client:
        yield client


def _register_and_seed_auth(client: TestClient, *, email: str = "alice@example.com") -> dict[str, str]:
    response = client.post(
        "/api/v2/auth/register/email",
        json={
            "email": email,
            "password": "secret123",
            "displayName": "Alice",
        },
    )
    assert response.status_code == 200, response.text
    csrf = response.cookies.get("csrf_token_v2")
    assert csrf is not None
    client.headers["X-CSRF-Token"] = csrf
    token = response.cookies.get("auth_session_v2")
    assert token is not None
    return {"csrf": csrf, "token": token}


def test_openapi_exposes_phase1_backend_paths(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        response = client.get("/openapi.json")
        assert response.status_code == 200, response.text
        paths = response.json()["paths"]
        assert "/api/v2/auth/login" in paths
        assert "/api/v2/dashboard/overview" in paths
        assert "/api/v2/practice/center" in paths
        assert "/api/v2/practice/sessions" in paths
        assert "/api/v2/review/items" in paths
        assert "/api/v2/notes" in paths
        assert "/api/v2/profile/overview" in paths


def test_auth_register_login_session_and_logout(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_response = client.post(
            "/api/v2/auth/register/email",
            json={
                "email": "alice@example.com",
                "password": "secret123",
                "displayName": "Alice",
            },
        )
        assert register_response.status_code == 200, register_response.text
        register_body = register_response.json()
        assert register_body["user"]["email"] == "alice@example.com"
        assert "auth_session_v2" in register_response.cookies
        assert "csrf_token_v2" in register_response.cookies

        session_response = client.get("/api/v2/auth/session")
        assert session_response.status_code == 200, session_response.text
        assert session_response.json()["authenticated"] is True

        client.headers["X-CSRF-Token"] = register_response.cookies["csrf_token_v2"]
        logout_response = client.post("/api/v2/auth/logout")
        assert logout_response.status_code == 200, logout_response.text
        assert logout_response.json()["ok"] is True

        login_response = client.post(
            "/api/v2/auth/login",
            json={"identifier": "alice@example.com", "password": "secret123"},
        )
        assert login_response.status_code == 200, login_response.text
        assert login_response.json()["user"]["displayName"] == "Alice"


def test_empty_contract_shapes_for_core_pages(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _register_and_seed_auth(client)

        dashboard = client.get("/api/v2/dashboard/overview")
        assert dashboard.status_code == 200, dashboard.text
        dashboard_body = dashboard.json()
        assert set(dashboard_body.keys()) == {"summary", "sections", "actions"}

        practice = client.get("/api/v2/practice/center")
        assert practice.status_code == 200, practice.text
        assert set(practice.json().keys()) == {"summary", "sections", "actions"}

        review = client.get("/api/v2/review/items")
        assert review.status_code == 200, review.text
        assert set(review.json().keys()) == {"items", "total", "page", "pageSize"}

        notes = client.get("/api/v2/notes")
        assert notes.status_code == 200, notes.text
        assert set(notes.json().keys()) == {"items", "total", "page", "pageSize"}

        profile = client.get("/api/v2/profile/overview")
        assert profile.status_code == 200, profile.text
        assert set(profile.json().keys()) == {"summary", "sections", "actions"}


def test_notes_profile_and_session_skeleton_endpoints_work(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _register_and_seed_auth(client)

        create_note = client.post(
            "/api/v2/notes",
            json={"title": "First note", "body": "Skeleton note body"},
        )
        assert create_note.status_code == 200, create_note.text

        list_notes = client.get("/api/v2/notes")
        assert list_notes.status_code == 200, list_notes.text
        assert list_notes.json()["total"] == 1

        update_info = client.put(
            "/api/v2/profile/info",
            json={
                "displayName": "Alice Updated",
                "realName": "Alice",
                "region": "Beijing",
                "bio": "Phase 1 profile",
            },
        )
        assert update_info.status_code == 200, update_info.text
        assert update_info.json()["displayName"] == "Alice Updated"

        update_goals = client.put(
            "/api/v2/profile/goals",
            json={"targetExam": "国考", "targetScore": "130", "weeklyTargetHours": 12},
        )
        assert update_goals.status_code == 200, update_goals.text
        assert update_goals.json()["targetExam"] == "国考"

        session_response = client.post(
            "/api/v2/practice/sessions",
            json={"track": "xingce", "entryKind": "papers", "paperCode": None, "questionIds": [], "payload": {}},
        )
        assert session_response.status_code == 200, session_response.text
        session_id = session_response.json()["id"]

        save_answers = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={
                "answers": [
                    {"questionKey": "Q1", "answer": {"selected": ["A"]}, "durationSeconds": 12}
                ]
            },
        )
        assert save_answers.status_code == 200, save_answers.text
        assert save_answers.json()["status"] == "saved"

        submit_session = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        assert submit_session.status_code == 200, submit_session.text
        assert submit_session.json()["status"] == "submitted"

        session_result = client.get(f"/api/v2/practice/sessions/{session_id}/result")
        assert session_result.status_code == 200, session_result.text
        assert set(session_result.json().keys()) == {"summary", "sections", "actions"}


def test_phase1_contract_smoke_covers_all_new_endpoints(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _register_and_seed_auth(client, email="phase1@example.com")

        # auth auxiliary flows
        with patch(
            "sikao_api.modules.identity.application.service.generate_verification_code",
            side_effect=["111111", "222222"],
        ):
            send_register_code = client.post(
                "/api/v2/auth/send-code",
                json={
                    "targetKind": "email",
                    "targetValue": "verify@example.com",
                    "purpose": "register",
                },
            )
            assert send_register_code.status_code == 200, send_register_code.text
            assert "devCode" not in send_register_code.json()
            verify_code = client.post(
                "/api/v2/auth/verify-code",
                json={
                    "targetKind": "email",
                    "targetValue": "verify@example.com",
                    "purpose": "register",
                    "code": "111111",
                },
            )
            assert verify_code.status_code == 200, verify_code.text

            reset_code = client.post(
                "/api/v2/auth/send-code",
                json={
                    "targetKind": "email",
                    "targetValue": "phase1@example.com",
                    "purpose": "reset_password",
                },
            )
            assert reset_code.status_code == 200, reset_code.text
            assert "devCode" not in reset_code.json()
            reset_password = client.post(
                "/api/v2/auth/reset-password",
                json={
                    "identifier": "phase1@example.com",
                    "code": "222222",
                    "newPassword": "newsecret456",
                },
            )
            assert reset_password.status_code == 200, reset_password.text
            relogin = client.post(
                "/api/v2/auth/login",
                json={
                    "identifier": "phase1@example.com",
                    "password": "newsecret456",
                },
            )
            assert relogin.status_code == 200, relogin.text
            client.headers["X-CSRF-Token"] = relogin.cookies["csrf_token_v2"]

        # dashboard
        for path in [
            "/api/v2/dashboard/overview",
            "/api/v2/dashboard/today",
            "/api/v2/dashboard/today/must-do",
            "/api/v2/dashboard/today/continue",
            "/api/v2/dashboard/today/review",
            "/api/v2/dashboard/weekly-plan",
            "/api/v2/dashboard/weekly-plan/goal",
            "/api/v2/dashboard/weekly-plan/today-completion",
            "/api/v2/dashboard/weekly-plan/adjust",
            "/api/v2/dashboard/progress",
            "/api/v2/dashboard/progress/trend",
            "/api/v2/dashboard/progress/weakness",
            "/api/v2/dashboard/progress/diagnosis",
            "/api/v2/dashboard/records",
        ]:
            response = client.get(path)
            assert response.status_code == 200, (path, response.text)

        # practice + session
        for path in [
            "/api/v2/practice/center",
            "/api/v2/practice/xingce/categories",
            "/api/v2/practice/xingce/papers",
            "/api/v2/practice/essay/categories",
            "/api/v2/practice/essay/papers",
        ]:
            response = client.get(path)
            assert response.status_code == 200, (path, response.text)

        create_session = client.post(
            "/api/v2/practice/sessions",
            json={"track": "essay", "entryKind": "categories", "questionIds": [], "payload": {"seed": True}},
        )
        assert create_session.status_code == 200, create_session.text
        session_id = create_session.json()["id"]
        assert client.get(f"/api/v2/practice/sessions/{session_id}").status_code == 200
        assert client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={"answers": [{"questionKey": "Q-1", "answer": {"text": "demo"}}]},
        ).status_code == 200
        assert client.post(f"/api/v2/practice/sessions/{session_id}/submit").status_code == 200
        assert client.get(f"/api/v2/practice/sessions/{session_id}/result").status_code == 200

        # review
        assert client.get("/api/v2/review/items").status_code == 200
        assert client.get("/api/v2/review/smart").status_code == 200
        assert client.get("/api/v2/review/items/1").status_code == 200
        assert client.post("/api/v2/review/items/1/redo").status_code == 200

        # notes
        note = client.post("/api/v2/notes", json={"title": "Smoke", "body": "Body"})
        assert note.status_code == 200, note.text
        note_id = note.json()["id"]
        assert client.get("/api/v2/notes").status_code == 200
        assert client.get(f"/api/v2/notes/{note_id}").status_code == 200
        assert client.put(
            f"/api/v2/notes/{note_id}",
            json={"title": "Smoke 2", "body": "Body 2", "status": "archived"},
        ).status_code == 200

        # profile
        assert client.get("/api/v2/profile/overview").status_code == 200
        assert client.get("/api/v2/profile/security").status_code == 200
        assert client.put(
            "/api/v2/profile/security",
            json={"currentPassword": "newsecret456", "newPassword": "newsecret789"},
        ).status_code == 200
        assert client.get("/api/v2/profile/goals").status_code == 200
        assert client.put(
            "/api/v2/profile/goals",
            json={"targetExam": "省考", "targetScore": "125", "weeklyTargetHours": 10},
        ).status_code == 200
        assert client.get("/api/v2/profile/info").status_code == 200
        assert client.put(
            "/api/v2/profile/info",
            json={"displayName": "Phase1", "realName": "P1", "region": "Shanghai", "bio": "Bio"},
        ).status_code == 200
