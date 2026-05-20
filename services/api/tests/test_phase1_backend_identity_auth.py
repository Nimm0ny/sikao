from __future__ import annotations

from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Iterator
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import select

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import AuthSessionV2, PhoneContactV2, VerificationTokenV2
from sikao_api.main import create_app


@contextmanager
def build_client(
    tmp_path: Path,
    *,
    auth_cookie_secure: bool = False,
) -> Iterator[tuple[TestClient, object]]:
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'phase1-identity-auth.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="phase1-identity-secret",
        app_version="phase1-test",
        git_sha="phase1-sha",
        image_tag="phase1-tag",
        build_time="2026-05-20T00:00:00Z",
        schema_version="phase1-schema",
        auth_cookie_secure=auth_cookie_secure,
    )
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as client:
        yield client, app


def _register_email(
    client: TestClient,
    *,
    email: str = "alice@example.com",
    password: str = "secret123",
) -> tuple[dict[str, object], str, str]:
    response = client.post(
        "/api/v2/auth/register/email",
        json={
            "email": email,
            "password": password,
            "displayName": "Alice",
        },
    )
    assert response.status_code == 200, response.text
    auth_cookie = response.cookies.get("auth_session_v2")
    csrf_cookie = response.cookies.get("csrf_token_v2")
    assert auth_cookie is not None
    assert csrf_cookie is not None
    return response.json(), auth_cookie, csrf_cookie


def test_register_and_login_hide_session_and_csrf_secrets(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, _app):
        register_body, _auth_cookie, _csrf_cookie = _register_email(client)
        assert "csrfToken" not in register_body
        assert "token" not in register_body["session"]

        login_response = client.post(
            "/api/v2/auth/login",
            json={"identifier": "alice@example.com", "password": "secret123"},
        )
        assert login_response.status_code == 200, login_response.text
        login_body = login_response.json()
        assert "csrfToken" not in login_body
        assert "token" not in login_body["session"]


def test_send_code_response_hides_plaintext_otp(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        with patch(
            "sikao_api.modules.identity.application.service.generate_verification_code",
            return_value="123456",
        ):
            response = client.post(
                "/api/v2/auth/send-code",
                json={
                    "targetKind": "email",
                    "targetValue": "alice@example.com",
                    "purpose": "reset_password",
                },
            )
        assert response.status_code == 200, response.text
        assert response.json() == {
            "ok": True,
            "purpose": "reset_password",
            "delivery": "dev",
        }

        session = app.state.db.session_factory()
        try:
            token = session.scalar(select(VerificationTokenV2))
            assert token is not None
            assert token.target_value == "alice@example.com"
        finally:
            session.close()


def test_session_supports_bearer_and_rejects_expired_session(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        register_body, auth_cookie, _csrf_cookie = _register_email(client)
        client.cookies.clear()

        session_response = client.get(
            "/api/v2/auth/session",
            headers={"Authorization": f"Bearer {auth_cookie}"},
        )
        assert session_response.status_code == 200, session_response.text
        assert session_response.json()["session"]["id"] == register_body["session"]["id"]
        assert "token" not in session_response.json()["session"]

        db_session = app.state.db.session_factory()
        try:
            auth_session = db_session.scalar(select(AuthSessionV2))
            assert auth_session is not None
            auth_session.expires_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(seconds=1)
            db_session.commit()
        finally:
            db_session.close()

        expired_response = client.get(
            "/api/v2/auth/session",
            headers={"Authorization": f"Bearer {auth_cookie}"},
        )
        assert expired_response.status_code == 401
        assert expired_response.json()["code"] == "session_expired"


def test_logout_accepts_bearer_without_csrf_cookie(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, _app):
        _body, auth_cookie, _csrf_cookie = _register_email(client)
        client.cookies.clear()
        client.headers.pop("X-CSRF-Token", None)

        logout_response = client.post(
            "/api/v2/auth/logout",
            headers={"Authorization": f"Bearer {auth_cookie}"},
        )
        assert logout_response.status_code == 200, logout_response.text

        revoked_response = client.get(
            "/api/v2/auth/session",
            headers={"Authorization": f"Bearer {auth_cookie}"},
        )
        assert revoked_response.status_code == 401
        assert revoked_response.json()["code"] == "session_revoked"


def test_logout_with_cookie_auth_still_requires_csrf(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, _app):
        _body, _auth_cookie, _csrf_cookie = _register_email(client)
        client.headers.pop("X-CSRF-Token", None)

        logout_response = client.post("/api/v2/auth/logout")
        assert logout_response.status_code == 403, logout_response.text
        assert logout_response.json()["code"] == "csrf_missing"


def test_register_phone_requires_sms_code(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, _app):
        response = client.post(
            "/api/v2/auth/register/phone",
            json={
                "phone": "13800138000",
                "password": "secret123",
                "displayName": "PhoneUser",
            },
        )
    assert response.status_code == 422, response.text


def test_register_phone_rejects_wrong_sms_code(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, _app):
        with patch(
            "sikao_api.modules.identity.application.service.generate_verification_code",
            return_value="123456",
        ):
            send_code_response = client.post(
                "/api/v2/auth/send-code",
                json={
                    "targetKind": "phone",
                    "targetValue": "13800138000",
                    "purpose": "register",
                },
            )
        assert send_code_response.status_code == 200, send_code_response.text

        response = client.post(
            "/api/v2/auth/register/phone",
            json={
                "phone": "13800138000",
                "smsCode": "999999",
                "password": "secret123",
                "displayName": "PhoneUser",
            },
        )
    assert response.status_code == 401, response.text
    assert response.json()["code"] == "verification_mismatch"


def test_register_phone_verifies_sms_code_before_create(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        with patch(
            "sikao_api.modules.identity.application.service.generate_verification_code",
            return_value="123456",
        ):
            send_code_response = client.post(
                "/api/v2/auth/send-code",
                json={
                    "targetKind": "phone",
                    "targetValue": "13800138000",
                    "purpose": "register",
                },
            )
        assert send_code_response.status_code == 200, send_code_response.text

        response = client.post(
            "/api/v2/auth/register/phone",
            json={
                "phone": "13800138000",
                "smsCode": "123456",
                "password": "secret123",
                "displayName": "PhoneUser",
            },
        )
        assert response.status_code == 200, response.text

        session = app.state.db.session_factory()
        try:
            contact = session.scalar(select(PhoneContactV2))
            assert contact is not None
            assert contact.phone == "13800138000"
            assert contact.is_verified is True
        finally:
            session.close()


def test_reset_password_revokes_existing_sessions(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, _app):
        _body, register_token, _register_csrf = _register_email(client)
        second_login = client.post(
            "/api/v2/auth/login",
            json={"identifier": "alice@example.com", "password": "secret123"},
        )
        assert second_login.status_code == 200, second_login.text
        second_token = second_login.cookies["auth_session_v2"]

        with patch(
            "sikao_api.modules.identity.application.service.generate_verification_code",
            return_value="654321",
        ):
            send_code_response = client.post(
                "/api/v2/auth/send-code",
                json={
                    "targetKind": "email",
                    "targetValue": "alice@example.com",
                    "purpose": "reset_password",
                },
            )
        assert send_code_response.status_code == 200, send_code_response.text

        reset_response = client.post(
            "/api/v2/auth/reset-password",
            json={
                "identifier": "alice@example.com",
                "code": "654321",
                "newPassword": "new-secret456",
            },
        )
        assert reset_response.status_code == 200, reset_response.text

        old_password_login = client.post(
            "/api/v2/auth/login",
            json={"identifier": "alice@example.com", "password": "secret123"},
        )
        assert old_password_login.status_code == 401
        assert old_password_login.json()["code"] == "invalid_credentials"

        new_password_login = client.post(
            "/api/v2/auth/login",
            json={"identifier": "alice@example.com", "password": "new-secret456"},
        )
        assert new_password_login.status_code == 200, new_password_login.text

        for token in (register_token, second_token):
            client.cookies.clear()
            revoked_response = client.get(
                "/api/v2/auth/session",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert revoked_response.status_code == 401
            assert revoked_response.json()["code"] == "session_revoked"


def test_v2_cookie_secure_flag_follows_settings(tmp_path: Path) -> None:
    with build_client(tmp_path, auth_cookie_secure=True) as (client, _app):
        response = client.post(
            "/api/v2/auth/register/email",
            json={
                "email": "secure@example.com",
                "password": "secret123",
                "displayName": "Secure",
            },
        )
    assert response.status_code == 200, response.text
    set_cookie_headers = [
        value
        for header, value in response.headers.multi_items()
        if header.lower() == "set-cookie"
    ]
    assert len(set_cookie_headers) == 2
    assert all("Secure" in value for value in set_cookie_headers)
