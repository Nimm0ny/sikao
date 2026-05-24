"""Auth recovery endpoint tests — Phase B.4.

Cover (8 cases per plan §4 B.4):
1. forgot nonexistent email (dev gate on) → 200 + 无 _devMagicLink
2. forgot happy path (dev gate on) → 200 + 有 _devMagicLink
3. forgot prod-mode (dev gate off, app_env=test) → 200 + 无 _devMagicLink, 无论 user 存在
4. reset valid token → 200 + 旧密码失败 + 新密码成功登录
5. reset expired token → 410
6. reset used token → 410
7. reset invalidates other active reset tokens (D6)
8. verify-email send + confirm → user.email_verified flips to True
"""

from __future__ import annotations

from contextlib import contextmanager
from datetime import timedelta
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select

from sikao_api.core.config import Settings
from sikao_api.db.models import AuthToken, User, utc_now
from sikao_api.main import create_app
from sikao_api.modules.auth.application.security import hash_password


def _make_settings(tmp_path: Path, *, dev_expose: bool) -> Settings:
    """Test settings — app_env=local (双 gate 第一项满足 since {local, test}
    都允许 dev_expose). dev_expose 控制 P1-3 第二项."""
    return Settings(
        app_env="local",
        database_url=f"sqlite:///{(tmp_path / 'exam-api.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        admin_username="admin",
        admin_password_hash=hash_password("adminpass"),
        jwt_secret="test-secret-0123456789-test-secret",
        app_version="test-version",
        git_sha="test-sha",
        image_tag="test-tag",
        build_time="2026-04-22T00:00:00Z",
        schema_version="test-schema",
        email_provider="stub",
        frontend_base_url="http://localhost:18080",
        dev_expose_magic_link=dev_expose,
    )


@contextmanager
def _build_client(tmp_path: Path, *, dev_expose: bool):
    settings = _make_settings(tmp_path, dev_expose=dev_expose)
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as client:
        yield client, app


def _seed_user_with_email(
    app: Any,
    *,
    username: str = "alice",
    email: str = "alice@example.com",
    password: str = "OldPass123!",
    email_verified: bool = False,
) -> int:
    session = app.state.db.session_factory()
    try:
        user = User(
            username=username,
            display_name=username,
            password_hash=hash_password(password),
            email=email,
            email_verified=email_verified,
            is_active=True,
        )
        session.add(user)
        session.commit()
        return user.id
    finally:
        session.close()


def _login_with_csrf(client: TestClient, identifier: str, password: str) -> str:
    """Returns the auth_token cookie value. csrf cookie + header 顺手设.

    Identity v2 (commit #3d): /auth/login schema 改 LoginIdentifierRequest.
    Test users seeded with email, identifier 用 email-form ("alice@example.com").
    """
    resp = client.post(
        "/api/v2/auth/login",
        json={"identifier": identifier, "password": password},
    )
    assert resp.status_code == 200
    csrf = resp.cookies.get("csrf_token")
    if csrf is not None:
        client.headers["X-CSRF-Token"] = csrf
    return resp.cookies["auth_token"]


# ─── forgot-password ──────────────────────────────────────────────────────


def test_forgot_password_nonexistent_email_dev_gate_open(tmp_path: Path) -> None:
    """Dev gate 开 + email 不存在 → 200 + body 不含 _devMagicLink (D5 silent)."""
    with _build_client(tmp_path, dev_expose=True) as (client, _app):
        resp = client.post(
            "/api/v2/auth/forgot-password",
            json={"email": "ghost@example.com"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body == {"ok": True}
        assert "_devMagicLink" not in body


def test_forgot_password_happy_path_dev_gate_open(tmp_path: Path) -> None:
    """User 存在 + dev gate 开 → 200 + body 有 _devMagicLink."""
    with _build_client(tmp_path, dev_expose=True) as (client, app):
        _seed_user_with_email(app)
        resp = client.post(
            "/api/v2/auth/forgot-password",
            json={"email": "alice@example.com"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["ok"] is True
        assert "_devMagicLink" in body
        assert body["_devMagicLink"].startswith(
            "http://localhost:18080/reset-password?token="
        )


def test_forgot_password_dev_gate_closed_byte_identical(tmp_path: Path) -> None:
    """Dev gate 关 → 不论 user 存在与否, body 都是 byte-identical {ok: true}."""
    with _build_client(tmp_path, dev_expose=False) as (client, app):
        _seed_user_with_email(app)
        # 1. user 存在
        resp_a = client.post(
            "/api/v2/auth/forgot-password",
            json={"email": "alice@example.com"},
        )
        # 2. user 不存在
        resp_b = client.post(
            "/api/v2/auth/forgot-password",
            json={"email": "ghost@example.com"},
        )
        assert resp_a.status_code == 200
        assert resp_b.status_code == 200
        # P0-3: byte-identical
        assert resp_a.text == resp_b.text == '{"ok":true}'


# ─── reset-password ───────────────────────────────────────────────────────


def _request_reset_get_token(client: TestClient, email: str) -> str:
    """Helper: forgot-password (dev gate on) → return raw token from link."""
    resp = client.post("/api/v2/auth/forgot-password", json={"email": email})
    assert resp.status_code == 200
    link = resp.json()["_devMagicLink"]
    return link.split("token=")[1]


def test_reset_password_valid_token_replaces_password(tmp_path: Path) -> None:
    with _build_client(tmp_path, dev_expose=True) as (client, app):
        _seed_user_with_email(app, password="OldPass123!")
        raw_token = _request_reset_get_token(client, "alice@example.com")

        # 重置密码
        resp = client.post(
            "/api/v2/auth/reset-password",
            json={"token": raw_token, "newPassword": "NewPass456!"},
        )
        assert resp.status_code == 200
        assert resp.json() == {"ok": True}

        # 旧密码不能登录
        resp_old = client.post(
            "/api/v2/auth/login",
            json={"identifier": "alice@example.com", "password": "OldPass123!"},
        )
        assert resp_old.status_code == 401

        # 新密码可以登录
        resp_new = client.post(
            "/api/v2/auth/login",
            json={"identifier": "alice@example.com", "password": "NewPass456!"},
        )
        assert resp_new.status_code == 200


def test_reset_password_expired_token_returns_410(tmp_path: Path) -> None:
    with _build_client(tmp_path, dev_expose=True) as (client, app):
        user_id = _seed_user_with_email(app)
        raw_token = _request_reset_get_token(client, "alice@example.com")
        # backdate token 过期
        session = app.state.db.session_factory()
        try:
            tk = session.scalar(
                select(AuthToken).where(AuthToken.user_id == user_id)
            )
            assert tk is not None
            tk.expires_at = utc_now() - timedelta(seconds=1)
            session.commit()
        finally:
            session.close()
        resp = client.post(
            "/api/v2/auth/reset-password",
            json={"token": raw_token, "newPassword": "NewPass!"},
        )
        assert resp.status_code == 410
        assert resp.json()["code"] == "token_invalid"


def test_reset_password_used_token_returns_410(tmp_path: Path) -> None:
    with _build_client(tmp_path, dev_expose=True) as (client, app):
        _seed_user_with_email(app)
        raw_token = _request_reset_get_token(client, "alice@example.com")
        # 第一次成功
        resp1 = client.post(
            "/api/v2/auth/reset-password",
            json={"token": raw_token, "newPassword": "First!"},
        )
        assert resp1.status_code == 200
        # 第二次同 token → 410 (single-use)
        resp2 = client.post(
            "/api/v2/auth/reset-password",
            json={"token": raw_token, "newPassword": "Second!"},
        )
        assert resp2.status_code == 410


def test_reset_password_invalidates_other_active_tokens(tmp_path: Path) -> None:
    """D6: reset 成功 → user 同 kind 其它 unused reset token 也失效."""
    with _build_client(tmp_path, dev_expose=True) as (client, app):
        user_id = _seed_user_with_email(app)
        # forgot 两次 → 第二次自动 invalidate 第一次 (P1-6).
        # 但要验 D6 是 "reset 成功后", 得手插一条 fresh active token.
        raw_a = _request_reset_get_token(client, "alice@example.com")
        # raw_a 现在是 user 唯一 active token, 重新 forgot 覆盖.
        raw_b = _request_reset_get_token(client, "alice@example.com")
        # raw_a 此时已 used (P1-6). raw_b 是当前 active.
        # D6 焦点: reset(raw_b) 成功后, 即使我们手插一条新 token, 也应该失效.
        from hashlib import sha256

        session = app.state.db.session_factory()
        try:
            extra = AuthToken(
                user_id=user_id,
                kind="password_reset",
                token_hash=sha256(b"injected-fresh-token").hexdigest(),
                expires_at=utc_now() + timedelta(hours=1),
            )
            session.add(extra)
            session.commit()
            extra_id = extra.id
        finally:
            session.close()

        # 用 raw_b reset
        resp = client.post(
            "/api/v2/auth/reset-password",
            json={"token": raw_b, "newPassword": "WhateverPass!"},
        )
        assert resp.status_code == 200

        # extra 现在应该 used_at 非空
        session = app.state.db.session_factory()
        try:
            extra_after = session.get(AuthToken, extra_id)
            assert extra_after is not None and extra_after.used_at is not None
        finally:
            session.close()


# ─── verify-email/send + confirm ─────────────────────────────────────────


def test_verify_email_send_and_confirm_flow(tmp_path: Path) -> None:
    """Send (require auth + CSRF) → confirm (anonymous + token) → email_verified True."""
    with _build_client(tmp_path, dev_expose=True) as (client, app):
        user_id = _seed_user_with_email(app, password="OrigPass!", email_verified=False)
        _login_with_csrf(client, "alice@example.com", "OrigPass!")

        # send
        send_resp = client.post("/api/v2/auth/verify-email/send")
        assert send_resp.status_code == 200
        link = send_resp.json()["_devMagicLink"]
        raw_token = link.split("token=")[1]

        # confirm — anonymous (clear auth + csrf)
        client.cookies.clear()
        client.headers.pop("X-CSRF-Token", None)
        confirm_resp = client.post(
            "/api/v2/auth/verify-email/confirm",
            json={"token": raw_token},
        )
        assert confirm_resp.status_code == 200
        body = confirm_resp.json()
        assert body["ok"] is True
        assert body["user"]["username"] == "alice"

        # DB-side verify
        session = app.state.db.session_factory()
        try:
            user = session.get(User, user_id)
            assert user is not None and user.email_verified is True
        finally:
            session.close()


# Old B.5b register-with-email + PUT /auth/email tests deleted (#3d):
# - register-with-email tests: covered by tests/test_auth_identity_v2_routes.py
#   (commit #3c) for /register/email endpoint
# - PUT /auth/email tests: endpoint deleted (D10 review fix #2 unsafe).
#   Replacement is /auth/bind/email/* (commit #4 — 先验后写).
