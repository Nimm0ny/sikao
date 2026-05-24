"""Auth unbind endpoint integration tests — commit #4c.

D11 solo-verified 保留: 必须保留至少一个已 verified identifier.
- unbind phone 允许 ⇔ email IS NOT NULL AND email_verified=True
- unbind email 允许 ⇔ phone IS NOT NULL AND phone_verified=True

Test matrix (per plan §6 P4):
  (a) bind phone+email 都 verified → unbind email → OK; phone 仍 verified
  (b) 接着 unbind phone → reject (phone 是 unbind email 后唯一 verified, 但
      phone_verified 仍 True 这边 — 实际语义: unbind email 之前 (a) 时 email
      verified, 解了 email 之后 phone 仍 verified, 此时再解 phone 就违反 D11)
  (c) phone bound but phone_verified=False → 不算 verified, 解 email 应 reject
"""

from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from sikao_api.core.config import Settings
from sikao_api.db.models import User
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
    email: str | None = "alice@example.com",
    email_verified: bool = True,
    phone: str | None = "13800138000",
    phone_verified: bool = True,
    password: str = "Pass123!",
) -> int:
    """Seed user with email and/or phone + login + return user_id."""
    session = app.state.db.session_factory()
    try:
        user = User(
            username=None,
            display_name="alice",
            password_hash=hash_password(password),
            email=email,
            email_verified=email_verified,
            phone=phone,
            phone_verified=phone_verified,
            is_active=True,
        )
        session.add(user)
        session.commit()
        user_id = user.id
    finally:
        session.close()

    identifier = email if email is not None else phone
    assert identifier is not None
    resp = client.post(
        "/api/v2/auth/login",
        json={"identifier": identifier, "password": password},
    )
    assert resp.status_code == 200, resp.text
    csrf = resp.cookies.get("csrf_token")
    if csrf:
        client.headers["X-CSRF-Token"] = csrf
    return user_id


# ─── Test matrix per plan §6 P4 ─────────────────────────────


def test_unbind_email_when_phone_verified_succeeds(tmp_path: Path) -> None:
    """(a) bind 两 verified → unbind email → OK; phone 仍 bound + verified."""
    with _build_client(tmp_path) as (client, app):
        user_id = _seed_and_login(app, client)
        resp = client.post(
            "/api/v2/auth/unbind/email",
            json={"password": "Pass123!"},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["user"]["email"] is None
        assert body["user"]["emailVerified"] is False
        assert body["user"]["phone"] == "13800138000"
        assert body["user"]["phoneVerified"] is True

        # DB
        session = app.state.db.session_factory()
        try:
            user = session.get(User, user_id)
            assert user is not None
            assert user.email is None
            assert user.phone == "13800138000"
            assert user.phone_verified is True
        finally:
            session.close()


def test_unbind_phone_when_email_verified_succeeds(tmp_path: Path) -> None:
    """(a 反向): bind 两 verified → unbind phone → OK; email 仍 verified."""
    with _build_client(tmp_path) as (client, app):
        _seed_and_login(app, client)
        resp = client.post(
            "/api/v2/auth/unbind/phone",
            json={"password": "Pass123!"},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["user"]["phone"] is None
        assert body["user"]["phoneVerified"] is False
        assert body["user"]["email"] == "alice@example.com"
        assert body["user"]["emailVerified"] is True


def test_unbind_email_when_no_verified_phone_rejected(tmp_path: Path) -> None:
    """(b/c 反): solo-verified violation. 仅 email verified, phone 缺/未 verified
    → 解 email 拒.

    Case: user 只有 email (no phone). 解 email 会让 user 没 verified
    identifier → reject.
    """
    with _build_client(tmp_path) as (client, app):
        _seed_and_login(
            app, client, phone=None, phone_verified=False
        )
        resp = client.post(
            "/api/v2/auth/unbind/email",
            json={"password": "Pass123!"},
        )
        assert resp.status_code == 409, resp.text
        assert resp.json()["code"] == "identifier_must_remain_verified"


def test_unbind_phone_when_no_verified_email_rejected(tmp_path: Path) -> None:
    """User only has phone, no email → unbind phone rejected."""
    with _build_client(tmp_path) as (client, app):
        _seed_and_login(
            app, client, email=None, email_verified=False
        )
        resp = client.post(
            "/api/v2/auth/unbind/phone",
            json={"password": "Pass123!"},
        )
        assert resp.status_code == 409, resp.text
        assert resp.json()["code"] == "identifier_must_remain_verified"


def test_unbind_phone_with_unverified_email_rejected(tmp_path: Path) -> None:
    """(c): phone bound + verified, email bound but email_verified=False →
    解 phone 拒 (email 未 verified 不算 verified identifier)."""
    with _build_client(tmp_path) as (client, app):
        _seed_and_login(
            app,
            client,
            email="alice@example.com",
            email_verified=False,
            phone="13800138000",
            phone_verified=True,
        )
        resp = client.post(
            "/api/v2/auth/unbind/phone",
            json={"password": "Pass123!"},
        )
        assert resp.status_code == 409, resp.text
        assert resp.json()["code"] == "identifier_must_remain_verified"


def test_unbind_phone_wrong_password_returns_403(tmp_path: Path) -> None:
    """D12: 密码错 → 403 password_invalid."""
    with _build_client(tmp_path) as (client, app):
        _seed_and_login(app, client)
        resp = client.post(
            "/api/v2/auth/unbind/phone",
            json={"password": "WrongPass!"},
        )
        assert resp.status_code == 403, resp.text
        assert resp.json()["code"] == "password_invalid"


def test_unbind_email_wrong_password_returns_403(tmp_path: Path) -> None:
    with _build_client(tmp_path) as (client, app):
        _seed_and_login(app, client)
        resp = client.post(
            "/api/v2/auth/unbind/email",
            json={"password": "WrongPass!"},
        )
        assert resp.status_code == 403, resp.text


def test_unbind_phone_idempotent_when_already_unbound(tmp_path: Path) -> None:
    """User.phone already NULL → idempotent 200 (no state change).

    Edge case rare in practice (UI 不会让用户解已解的 phone), 但 service 层
    应正交.
    """
    with _build_client(tmp_path) as (client, app):
        _seed_and_login(
            app, client, phone=None, phone_verified=False
        )
        resp = client.post(
            "/api/v2/auth/unbind/phone",
            json={"password": "Pass123!"},
        )
        # Idempotent: 仍返 200, user state 不变.
        assert resp.status_code == 200, resp.text
        assert resp.json()["user"]["phone"] is None


def test_sequential_unbind_email_then_phone_blocked(tmp_path: Path) -> None:
    """(b) 双 verified → 解 email OK → 接着解 phone (现在 phone 是唯一 verified
    identifier) → reject. 防账号死锁."""
    with _build_client(tmp_path) as (client, app):
        _seed_and_login(app, client)
        # Step 1: 解 email — OK
        r1 = client.post(
            "/api/v2/auth/unbind/email",
            json={"password": "Pass123!"},
        )
        assert r1.status_code == 200, r1.text
        # Step 2: 接着解 phone — reject (email 已 NULL, phone 是 sole verified)
        r2 = client.post(
            "/api/v2/auth/unbind/phone",
            json={"password": "Pass123!"},
        )
        assert r2.status_code == 409, r2.text
        assert r2.json()["code"] == "identifier_must_remain_verified"
