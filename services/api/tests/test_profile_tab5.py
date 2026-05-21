"""Tests for Phase-Profile Tab 5 endpoints (PR-P1 through PR-P5)."""

from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path

from fastapi.testclient import TestClient

from sikao_api.core.config import Settings
from sikao_api.main import create_app


@contextmanager
def _client(tmp_path: Path):
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'profile-tab5.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="tab5-test-secret",
        app_version="tab5-test",
        git_sha="tab5-sha",
        image_tag="tab5-tag",
        build_time="2026-05-21T00:00:00Z",
        schema_version="tab5-schema",
    )
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as client:
        yield client


def _auth(client: TestClient) -> None:
    resp = client.post(
        "/api/v2/auth/register/email",
        json={"email": "tab5@example.com", "password": "secret123", "displayName": "Tab5"},
    )
    assert resp.status_code == 200, resp.text
    csrf = resp.cookies.get("csrf_token_v2")
    assert csrf
    client.headers["X-CSRF-Token"] = csrf


# --- PR-P1: Settings ---


def test_get_settings_defaults(tmp_path: Path) -> None:
    with _client(tmp_path) as c:
        _auth(c)
        resp = c.get("/api/v2/profile/settings")
        assert resp.status_code == 200
        body = resp.json()
        assert body["aiAdjustEnabled"] is True
        assert body["llmEnabled"] is True


def test_put_settings_disable_ai(tmp_path: Path) -> None:
    with _client(tmp_path) as c:
        _auth(c)
        resp = c.put("/api/v2/profile/settings", json={"aiAdjustEnabled": False})
        assert resp.status_code == 200
        body = resp.json()
        assert body["aiAdjustEnabled"] is False
        assert body["llmEnabled"] is False

        resp2 = c.get("/api/v2/profile/settings")
        assert resp2.json()["aiAdjustEnabled"] is False


def test_put_settings_requires_csrf(tmp_path: Path) -> None:
    with _client(tmp_path) as c:
        _auth(c)
        del c.headers["X-CSRF-Token"]
        resp = c.put("/api/v2/profile/settings", json={"aiAdjustEnabled": False})
        assert resp.status_code == 403


# --- PR-P2: Preferences ---


def test_get_preferences_defaults(tmp_path: Path) -> None:
    with _client(tmp_path) as c:
        _auth(c)
        resp = c.get("/api/v2/profile/preferences")
        assert resp.status_code == 200
        body = resp.json()
        assert body["dashboardPreferences"] == {}


def test_put_preferences_updates(tmp_path: Path) -> None:
    with _client(tmp_path) as c:
        _auth(c)
        prefs = {"sectionAVisible": True, "calendarDefaultView": "week"}
        resp = c.put("/api/v2/profile/preferences", json={"dashboardPreferences": prefs})
        assert resp.status_code == 200
        assert resp.json()["dashboardPreferences"] == prefs

        resp2 = c.get("/api/v2/profile/preferences")
        assert resp2.json()["dashboardPreferences"] == prefs


# --- PR-P3: Account Deletion ---


def test_delete_account_success(tmp_path: Path) -> None:
    with _client(tmp_path) as c:
        _auth(c)
        resp = c.request(
            "DELETE",
            "/api/v2/profile/account",
            json={"reason": "not_useful", "confirmation": "确认注销"},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert "7 天" in body["message"]
        assert "hardDeleteAt" in body


def test_delete_account_wrong_confirmation(tmp_path: Path) -> None:
    with _client(tmp_path) as c:
        _auth(c)
        resp = c.request(
            "DELETE",
            "/api/v2/profile/account",
            json={"reason": "other", "confirmation": "wrong"},
        )
        assert resp.status_code == 422


def test_delete_account_blocks_subsequent_auth(tmp_path: Path) -> None:
    with _client(tmp_path) as c:
        _auth(c)
        resp = c.request(
            "DELETE",
            "/api/v2/profile/account",
            json={"reason": "other", "confirmation": "确认注销"},
        )
        assert resp.status_code == 200

        # Subsequent API call: deleted_at check fires before session check,
        # so deleted users get 403 account_deleted (not 401 session_revoked).
        resp2 = c.get("/api/v2/profile/overview")
        assert resp2.status_code == 403


# --- PR-P2: Preferences size cap ---


def test_preferences_rejects_oversized_payload(tmp_path: Path) -> None:
    with _client(tmp_path) as c:
        _auth(c)
        # Build a payload >64KB
        big_value = "x" * 70_000
        resp = c.put(
            "/api/v2/profile/preferences",
            json={"dashboardPreferences": {"big": big_value}},
        )
        assert resp.status_code == 422


# --- PR-P4: Bind Phone stub ---


def test_bind_phone_returns_501(tmp_path: Path) -> None:
    with _client(tmp_path) as c:
        _auth(c)
        resp = c.post(
            "/api/v2/profile/bind-phone",
            json={"phone": "13812341234", "verificationCode": "123456"},
        )
        assert resp.status_code == 501
        assert "not yet implemented" in resp.json()["detail"]


def test_bind_phone_validates_phone_format(tmp_path: Path) -> None:
    with _client(tmp_path) as c:
        _auth(c)
        resp = c.post(
            "/api/v2/profile/bind-phone",
            json={"phone": "123", "verificationCode": "123456"},
        )
        assert resp.status_code == 422
