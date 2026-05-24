from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import select

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import EmailContactV2, PhoneContactV2, VerificationTokenV2
from sikao_api.main import create_app


@contextmanager
def _build_client(tmp_path: Path):
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'identity-v2-routes.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="identity-v2-routes-secret",
        app_version="identity-v2-routes-test",
        git_sha="identity-v2-routes-sha",
        image_tag="identity-v2-routes-tag",
        build_time="2026-05-24T00:00:00Z",
        schema_version="identity-v2-routes-schema",
    )
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as client:
        yield client, app


def test_register_email_happy_returns_v2_session_cookies(tmp_path: Path) -> None:
    with _build_client(tmp_path) as (client, app):
        response = client.post(
            "/api/v2/auth/register/email",
            json={
                "email": "alice@example.com",
                "password": "Pass123!",
                "displayName": "Alice",
            },
        )

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["user"]["email"] == "alice@example.com"
        assert body["user"]["displayName"] == "Alice"
        assert body["user"]["phone"] is None
        assert "publicId" in body["user"]
        assert "auth_session_v2" in response.cookies
        assert "csrf_token_v2" in response.cookies

        session = app.state.db.session_factory()
        try:
            contact = session.scalar(select(EmailContactV2))
            assert contact is not None
            assert contact.email == "alice@example.com"
            assert contact.is_verified is False
        finally:
            session.close()


def test_register_email_duplicate_returns_409_case_insensitive(tmp_path: Path) -> None:
    with _build_client(tmp_path) as (client, _app):
        first = client.post(
            "/api/v2/auth/register/email",
            json={
                "email": "alice@example.com",
                "password": "Pass123!",
                "displayName": "Alice",
            },
        )
        assert first.status_code == 200, first.text

        duplicate = client.post(
            "/api/v2/auth/register/email",
            json={
                "email": "ALICE@example.com",
                "password": "Pass123!",
                "displayName": "Alice 2",
            },
        )
        assert duplicate.status_code == 409, duplicate.text
        assert duplicate.json()["code"] == "email_taken"


def test_send_code_persists_verification_token_without_exposing_plaintext(
    tmp_path: Path,
) -> None:
    with _build_client(tmp_path) as (client, app):
        with patch(
            "sikao_api.modules.identity.application.service.generate_verification_code",
            return_value="123456",
        ):
            response = client.post(
                "/api/v2/auth/send-code",
                json={
                    "targetKind": "phone",
                    "targetValue": "13800138000",
                    "purpose": "register",
                },
            )

        assert response.status_code == 200, response.text
        assert response.json() == {
            "ok": True,
            "purpose": "register",
            "delivery": "dev",
        }

        session = app.state.db.session_factory()
        try:
            token = session.scalar(select(VerificationTokenV2))
            assert token is not None
            assert token.target_kind == "phone"
            assert token.target_value == "13800138000"
            assert token.purpose == "register"
        finally:
            session.close()


def test_send_code_rejects_bind_purpose(tmp_path: Path) -> None:
    with _build_client(tmp_path) as (client, _app):
        response = client.post(
            "/api/v2/auth/send-code",
            json={
                "targetKind": "phone",
                "targetValue": "13800138000",
                "purpose": "bind",
            },
        )
    assert response.status_code == 422, response.text


def test_register_phone_full_flow_happy(tmp_path: Path) -> None:
    with _build_client(tmp_path) as (client, app):
        with patch(
            "sikao_api.modules.identity.application.service.generate_verification_code",
            return_value="123456",
        ):
            send_code = client.post(
                "/api/v2/auth/send-code",
                json={
                    "targetKind": "phone",
                    "targetValue": "13800138000",
                    "purpose": "register",
                },
            )
        assert send_code.status_code == 200, send_code.text

        response = client.post(
            "/api/v2/auth/register/phone",
            json={
                "phone": "13800138000",
                "smsCode": "123456",
                "password": "Pass123!",
                "displayName": "Phone User",
            },
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["user"]["phone"] == "13800138000"
        assert body["user"]["displayName"] == "Phone User"
        assert "auth_session_v2" in response.cookies
        assert "csrf_token_v2" in response.cookies

        session = app.state.db.session_factory()
        try:
            contact = session.scalar(select(PhoneContactV2))
            assert contact is not None
            assert contact.phone == "13800138000"
            assert contact.is_verified is True
        finally:
            session.close()


def test_register_phone_wrong_sms_code_returns_401(tmp_path: Path) -> None:
    with _build_client(tmp_path) as (client, _app):
        with patch(
            "sikao_api.modules.identity.application.service.generate_verification_code",
            return_value="123456",
        ):
            send_code = client.post(
                "/api/v2/auth/send-code",
                json={
                    "targetKind": "phone",
                    "targetValue": "13800138000",
                    "purpose": "register",
                },
            )
        assert send_code.status_code == 200, send_code.text

        response = client.post(
            "/api/v2/auth/register/phone",
            json={
                "phone": "13800138000",
                "smsCode": "999999",
                "password": "Pass123!",
                "displayName": "Phone User",
            },
        )
        assert response.status_code == 401, response.text
        assert response.json()["code"] == "verification_mismatch"


def test_register_phone_duplicate_returns_409(tmp_path: Path) -> None:
    with _build_client(tmp_path) as (client, _app):
        with patch(
            "sikao_api.modules.identity.application.service.generate_verification_code",
            return_value="123456",
        ):
            first_send = client.post(
                "/api/v2/auth/send-code",
                json={
                    "targetKind": "phone",
                    "targetValue": "13800138000",
                    "purpose": "register",
                },
            )
        assert first_send.status_code == 200, first_send.text

        first_register = client.post(
            "/api/v2/auth/register/phone",
            json={
                "phone": "13800138000",
                "smsCode": "123456",
                "password": "Pass123!",
                "displayName": "Primary Phone",
            },
        )
        assert first_register.status_code == 200, first_register.text

        with patch(
            "sikao_api.modules.identity.application.service.generate_verification_code",
            return_value="654321",
        ):
            second_send = client.post(
                "/api/v2/auth/send-code",
                json={
                    "targetKind": "phone",
                    "targetValue": "13800138000",
                    "purpose": "register",
                },
            )
        assert second_send.status_code == 200, second_send.text

        duplicate = client.post(
            "/api/v2/auth/register/phone",
            json={
                "phone": "13800138000",
                "smsCode": "654321",
                "password": "OtherPass123!",
                "displayName": "Duplicate Phone",
            },
        )
        assert duplicate.status_code == 409, duplicate.text
        assert duplicate.json()["code"] == "phone_taken"


def test_login_session_and_logout_use_v2_contract(tmp_path: Path) -> None:
    with _build_client(tmp_path) as (client, _app):
        register = client.post(
            "/api/v2/auth/register/email",
            json={
                "email": "alice@example.com",
                "password": "Pass123!",
                "displayName": "Alice",
            },
        )
        assert register.status_code == 200, register.text

        login = client.post(
            "/api/v2/auth/login",
            json={"identifier": "alice@example.com", "password": "Pass123!"},
        )
        assert login.status_code == 200, login.text
        assert "auth_session_v2" in login.cookies
        assert "csrf_token_v2" in login.cookies

        session_response = client.get("/api/v2/auth/session")
        assert session_response.status_code == 200, session_response.text
        assert session_response.json()["authenticated"] is True

        client.headers["X-CSRF-Token"] = login.cookies["csrf_token_v2"]
        logout = client.post("/api/v2/auth/logout")
        assert logout.status_code == 200, logout.text
        assert logout.json()["ok"] is True

        after_logout = client.get("/api/v2/auth/session")
        assert after_logout.status_code == 401, after_logout.text
