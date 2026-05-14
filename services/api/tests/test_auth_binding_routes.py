"""Auth binding endpoint integration tests — commit #4b.

Cover:
- /auth/bind/phone/send-code: happy + D18 unique 预检 + 401/403 (no auth/csrf)
- /auth/bind/phone/confirm: happy + D12 password confirm + D17 wrong code
- /auth/bind/email/send-link: happy + D18 unique 预检
- /auth/bind/email/confirm: happy + D12 + 410 wrong token + cross-user defense (#4a)
"""

from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select

from sikao_api.core.config import Settings
from sikao_api.db.models import PreRegisterCode, User
from sikao_api.main import create_app
from sikao_api.modules.auth.application.security import hash_password


def _make_settings(tmp_path: Path) -> Settings:
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
        sms_provider="stub",
        frontend_base_url="http://localhost:18080",
        dev_expose_magic_code=True,
        dev_expose_magic_link=True,
    )


@contextmanager
def _build_client(tmp_path: Path):
    settings = _make_settings(tmp_path)
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as client:
        yield client, app


def _seed_and_login(
    app: Any,
    client: TestClient,
    *,
    email: str = "alice@example.com",
    password: str = "Pass123!",
    phone: str | None = None,
) -> int:
    """Seed user + login; sets cookies + CSRF header in client. Returns user_id."""
    session = app.state.db.session_factory()
    try:
        user = User(
            username=None,
            display_name="alice",
            password_hash=hash_password(password),
            email=email,
            email_verified=True,
            phone=phone,
            phone_verified=phone is not None,
            is_active=True,
        )
        session.add(user)
        session.commit()
        user_id = user.id
    finally:
        session.close()

    resp = client.post(
        "/api/v2/auth/login",
        json={"identifier": email, "password": password},
    )
    assert resp.status_code == 200, resp.text
    csrf = resp.cookies.get("csrf_token")
    if csrf:
        client.headers["X-CSRF-Token"] = csrf
    return user_id


# ─── /auth/bind/phone/send-code ───────────────────────────


def test_bind_phone_send_code_happy(tmp_path: Path) -> None:
    with _build_client(tmp_path) as (client, app):
        _seed_and_login(app, client)
        resp = client.post(
            "/api/v2/auth/bind/phone/send-code",
            json={"phone": "13800138000"},
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is True
    code = body.get("_devMagicCode")
    assert code is not None and len(code) == 6


def test_bind_phone_send_code_blocks_anonymous(tmp_path: Path) -> None:
    """Anonymous (no login cookie) blocked. CSRF dep fires first → 403
    csrf_missing (no csrf_token cookie either). Either 401 or 403 acceptable
    (核心: 匿名不能调 bind endpoint)."""
    with _build_client(tmp_path) as (client, _app):
        resp = client.post(
            "/api/v2/auth/bind/phone/send-code",
            json={"phone": "13800138000"},
        )
    assert resp.status_code in (401, 403), resp.text


def test_bind_phone_send_code_requires_csrf(tmp_path: Path) -> None:
    """Cookie present but no CSRF header → 403."""
    with _build_client(tmp_path) as (client, app):
        _seed_and_login(app, client)
        client.headers.pop("X-CSRF-Token", None)
        resp = client.post(
            "/api/v2/auth/bind/phone/send-code",
            json={"phone": "13800138000"},
        )
    assert resp.status_code == 403, resp.text


def test_bind_phone_send_code_phone_taken_returns_409(tmp_path: Path) -> None:
    """D18 unique 预检: newPhone 别 user 占 → 409 phone_taken."""
    with _build_client(tmp_path) as (client, app):
        # seed bob with phone first (separate session)
        session = app.state.db.session_factory()
        try:
            bob = User(
                username=None,
                display_name="bob",
                password_hash=hash_password("BobPass!"),
                email="bob@example.com",
                phone="13800138000",
                phone_verified=True,
                is_active=True,
            )
            session.add(bob)
            session.commit()
        finally:
            session.close()
        # alice seeds + logs in
        _seed_and_login(app, client, email="alice@example.com")
        resp = client.post(
            "/api/v2/auth/bind/phone/send-code",
            json={"phone": "13800138000"},
        )
    assert resp.status_code == 409, resp.text
    assert resp.json()["code"] == "phone_taken"


def test_bind_phone_send_code_already_bound_returns_409(tmp_path: Path) -> None:
    """Self phone already bound → 409 phone_already_bound."""
    with _build_client(tmp_path) as (client, app):
        _seed_and_login(app, client, phone="13800138000")
        resp = client.post(
            "/api/v2/auth/bind/phone/send-code",
            json={"phone": "13800138000"},
        )
    assert resp.status_code == 409, resp.text
    assert resp.json()["code"] == "phone_already_bound"


# ─── /auth/bind/phone/confirm ─────────────────────────────


def test_bind_phone_confirm_full_flow_happy(tmp_path: Path) -> None:
    """send-code → confirm → user.phone + phone_verified=True."""
    with _build_client(tmp_path) as (client, app):
        user_id = _seed_and_login(app, client)
        send_resp = client.post(
            "/api/v2/auth/bind/phone/send-code",
            json={"phone": "13800138000"},
        )
        code = send_resp.json()["_devMagicCode"]

        resp = client.post(
            "/api/v2/auth/bind/phone/confirm",
            json={
                "phone": "13800138000",
                "smsCode": code,
                "password": "Pass123!",
            },
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["user"]["phone"] == "13800138000"
        assert body["user"]["phoneVerified"] is True

        # DB verify
        session = app.state.db.session_factory()
        try:
            user = session.get(User, user_id)
            assert user is not None
            assert user.phone == "13800138000"
            assert user.phone_verified is True
        finally:
            session.close()


def test_bind_phone_confirm_wrong_password_returns_403(tmp_path: Path) -> None:
    """D12: 密码错 → 403 password_invalid (in service before verify_code)."""
    with _build_client(tmp_path) as (client, app):
        _seed_and_login(app, client)
        send_resp = client.post(
            "/api/v2/auth/bind/phone/send-code",
            json={"phone": "13800138000"},
        )
        code = send_resp.json()["_devMagicCode"]
        resp = client.post(
            "/api/v2/auth/bind/phone/confirm",
            json={
                "phone": "13800138000",
                "smsCode": code,
                "password": "WrongPass!",
            },
        )
    assert resp.status_code == 403, resp.text
    assert resp.json()["code"] == "password_invalid"


def test_bind_phone_confirm_wrong_code_returns_410(tmp_path: Path) -> None:
    """D17 SMS code 错 → 410 code_invalid."""
    with _build_client(tmp_path) as (client, app):
        _seed_and_login(app, client)
        # 先 send 一次, 让 active code 存在 (不然 verify_code 找不到 active 也 410).
        client.post(
            "/api/v2/auth/bind/phone/send-code",
            json={"phone": "13800138000"},
        )
        resp = client.post(
            "/api/v2/auth/bind/phone/confirm",
            json={
                "phone": "13800138000",
                "smsCode": "999999",
                "password": "Pass123!",
            },
        )
    assert resp.status_code == 410, resp.text
    assert resp.json()["code"] == "code_invalid"


# ─── /auth/bind/email/send-link ───────────────────────────


def test_bind_email_send_link_happy(tmp_path: Path) -> None:
    with _build_client(tmp_path) as (client, app):
        # seed alice with phone-only (no email) to test bind new email
        session = app.state.db.session_factory()
        try:
            alice = User(
                username=None,
                display_name="alice",
                password_hash=hash_password("Pass123!"),
                email=None,
                phone="13800138000",
                phone_verified=True,
                is_active=True,
            )
            session.add(alice)
            session.commit()
        finally:
            session.close()
        login = client.post(
            "/api/v2/auth/login",
            json={"identifier": "13800138000", "password": "Pass123!"},
        )
        assert login.status_code == 200, login.text
        client.headers["X-CSRF-Token"] = login.cookies["csrf_token"]

        resp = client.post(
            "/api/v2/auth/bind/email/send-link",
            json={"email": "alice-new@example.com"},
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is True
    token = body.get("_devMagicLink")
    assert token is not None and len(token) >= 20


def test_bind_email_send_link_email_taken_returns_409(tmp_path: Path) -> None:
    """D18: newEmail 别 user 占 → 409 email_taken."""
    with _build_client(tmp_path) as (client, app):
        # seed bob with email first
        session = app.state.db.session_factory()
        try:
            bob = User(
                username=None,
                display_name="bob",
                password_hash=hash_password("Pass123!"),
                email="bob@example.com",
                email_verified=True,
                is_active=True,
            )
            session.add(bob)
            session.commit()
        finally:
            session.close()
        _seed_and_login(app, client, email="alice@example.com")
        resp = client.post(
            "/api/v2/auth/bind/email/send-link",
            json={"email": "bob@example.com"},
        )
    assert resp.status_code == 409, resp.text
    assert resp.json()["code"] == "email_taken"


# ─── /auth/bind/email/confirm ─────────────────────────────


def test_bind_email_confirm_full_flow_happy(tmp_path: Path) -> None:
    with _build_client(tmp_path) as (client, app):
        # seed alice with phone-only
        session = app.state.db.session_factory()
        try:
            alice = User(
                username=None,
                display_name="alice",
                password_hash=hash_password("Pass123!"),
                email=None,
                phone="13800138000",
                phone_verified=True,
                is_active=True,
            )
            session.add(alice)
            session.commit()
            user_id = alice.id
        finally:
            session.close()
        login = client.post(
            "/api/v2/auth/login",
            json={"identifier": "13800138000", "password": "Pass123!"},
        )
        client.headers["X-CSRF-Token"] = login.cookies["csrf_token"]

        send_resp = client.post(
            "/api/v2/auth/bind/email/send-link",
            json={"email": "alice-new@example.com"},
        )
        token = send_resp.json()["_devMagicLink"]

        resp = client.post(
            "/api/v2/auth/bind/email/confirm",
            json={"token": token, "password": "Pass123!"},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["user"]["email"] == "alice-new@example.com"
        assert body["user"]["emailVerified"] is True

        # DB verify
        session = app.state.db.session_factory()
        try:
            user = session.get(User, user_id)
            assert user is not None
            assert user.email == "alice-new@example.com"
            assert user.email_verified is True
        finally:
            session.close()


def test_bind_email_confirm_wrong_password_returns_403(tmp_path: Path) -> None:
    with _build_client(tmp_path) as (client, app):
        _seed_and_login(app, client)
        send_resp = client.post(
            "/api/v2/auth/bind/email/send-link",
            json={"email": "alice-new@example.com"},
        )
        token = send_resp.json()["_devMagicLink"]
        resp = client.post(
            "/api/v2/auth/bind/email/confirm",
            json={"token": token, "password": "WrongPass!"},
        )
    assert resp.status_code == 403, resp.text
    assert resp.json()["code"] == "password_invalid"


def test_bind_email_confirm_invalid_token_returns_410(tmp_path: Path) -> None:
    with _build_client(tmp_path) as (client, app):
        _seed_and_login(app, client)
        # No token issued; random 32-char string.
        resp = client.post(
            "/api/v2/auth/bind/email/confirm",
            json={"token": "x" * 43, "password": "Pass123!"},
        )
    assert resp.status_code == 410, resp.text
    assert resp.json()["code"] == "token_invalid"


def test_bind_email_confirm_cross_user_token_rejected(tmp_path: Path) -> None:
    """#4a security: alice 申请 bind newEmail token, attacker (bob) 偷到
    token 在自己 session confirm → row.user_id=alice != bob → 410.
    """
    with _build_client(tmp_path) as (client, app):
        # alice 申请 bind token (seeded + logged in)
        _seed_and_login(app, client, email="alice@example.com")
        send_resp = client.post(
            "/api/v2/auth/bind/email/send-link",
            json={"email": "victim-new@example.com"},
        )
        leaked_token = send_resp.json()["_devMagicLink"]

        # alice logout, bob 登录 (假设 attacker)
        client.post("/api/v2/auth/logout")
        client.cookies.clear()
        client.headers.pop("X-CSRF-Token", None)
        session = app.state.db.session_factory()
        try:
            bob = User(
                username=None,
                display_name="bob",
                password_hash=hash_password("BobPass!"),
                email="bob@example.com",
                email_verified=True,
                is_active=True,
            )
            session.add(bob)
            session.commit()
        finally:
            session.close()
        login = client.post(
            "/api/v2/auth/login",
            json={"identifier": "bob@example.com", "password": "BobPass!"},
        )
        assert login.status_code == 200
        client.headers["X-CSRF-Token"] = login.cookies["csrf_token"]

        # bob 用 alice 的 token confirm — user_id mismatch → 410
        resp = client.post(
            "/api/v2/auth/bind/email/confirm",
            json={"token": leaked_token, "password": "BobPass!"},
        )
    assert resp.status_code == 410, resp.text
    assert resp.json()["code"] == "token_invalid"
    # alice's pre_register_codes row 仍 unused (bob 命中失败不消耗 row).
    session = app.state.db.session_factory()
    try:
        rows = session.scalars(
            select(PreRegisterCode).where(
                PreRegisterCode.target_value == "victim-new@example.com"
            )
        ).all()
        # row 仍 active 让 alice 能继续用她的 token 在自己 session confirm.
        assert any(r.used_at is None for r in rows)
    finally:
        session.close()
