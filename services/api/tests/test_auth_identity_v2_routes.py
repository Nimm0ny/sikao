"""Identity v2 endpoint integration tests — commit #3c.

Covers (per plan §6 P3 验收 + commit #3c additions):
- POST /api/v2/auth/register/email: happy + duplicate
- POST /api/v2/auth/register/phone: dev-gate-driven flow (send-code → register) +
  wrong sms_code (410) + phone duplicate (409)
- POST /api/v2/auth/sms/send-code: dev gate on/off + bind_phone reject (403) +
  invalid phone format
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


def _make_settings(tmp_path: Path, *, dev_expose_code: bool = True) -> Settings:
    """Test settings — app_env=local (双 gate 第一项), dev_expose_code 控制第二项."""
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
        dev_expose_magic_code=dev_expose_code,
    )


@contextmanager
def _build_client(tmp_path: Path, *, dev_expose_code: bool = True):
    settings = _make_settings(tmp_path, dev_expose_code=dev_expose_code)
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as client:
        yield client, app


def _seed_existing_phone_user(app: Any, *, phone: str = "13800138000") -> int:
    session = app.state.db.session_factory()
    try:
        user = User(
            username=None,
            display_name=f"用户{phone[-4:]}",
            password_hash=hash_password("OldPass123!"),
            email=None,
            phone=phone,
            phone_verified=True,
            is_active=True,
        )
        session.add(user)
        session.commit()
        return user.id
    finally:
        session.close()


def _seed_existing_email_user(
    app: Any, *, email: str = "alice@example.com"
) -> int:
    session = app.state.db.session_factory()
    try:
        user = User(
            username=None,
            display_name="alice",
            password_hash=hash_password("OldPass123!"),
            email=email,
            email_verified=False,
            is_active=True,
        )
        session.add(user)
        session.commit()
        return user.id
    finally:
        session.close()


# ─── /register/email ───────────────────────────────────────


def test_register_email_happy_returns_session_cookies(tmp_path: Path) -> None:
    with _build_client(tmp_path) as (client, _app):
        resp = client.post(
            "/api/v2/auth/register/email",
            json={"email": "alice@example.com", "password": "Pass123!"},
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["user"]["email"] == "alice@example.com"
    assert body["user"]["emailVerified"] is False
    assert body["user"]["phone"] is None
    assert body["user"]["needsIdentifierSetup"] is False
    # display_name fallback split @ (review fix #6)
    assert body["user"]["displayName"] == "alice"
    # cookies set
    cookies = resp.cookies
    assert "auth_token" in cookies
    assert "csrf_token" in cookies


def test_register_email_duplicate_returns_409(tmp_path: Path) -> None:
    with _build_client(tmp_path) as (client, app):
        _seed_existing_email_user(app, email="alice@example.com")
        resp = client.post(
            "/api/v2/auth/register/email",
            json={"email": "ALICE@example.com", "password": "Pass123!"},
        )
    assert resp.status_code == 409, resp.text
    assert resp.json()["code"] == "email_taken"


# ─── /sms/send-code ────────────────────────────────────────


def test_sms_send_code_dev_gate_on_returns_magic_code(tmp_path: Path) -> None:
    with _build_client(tmp_path, dev_expose_code=True) as (client, _app):
        resp = client.post(
            "/api/v2/auth/sms/send-code",
            json={"phone": "13800138000", "purpose": "register"},
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is True
    code = body.get("_devMagicCode")
    assert code is not None
    assert len(code) == 6
    assert code.isdigit()


def test_sms_send_code_dev_gate_off_hides_code(tmp_path: Path) -> None:
    """prod 模式 (dev_expose_magic_code=False) → response 不含 _devMagicCode.

    response_model_exclude_none=True 让 dev_magic_code=None 时不进 body
    (frontend 拿不到 key).
    """
    with _build_client(tmp_path, dev_expose_code=False) as (client, _app):
        resp = client.post(
            "/api/v2/auth/sms/send-code",
            json={"phone": "13800138000", "purpose": "register"},
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is True
    assert "_devMagicCode" not in body


def test_sms_send_code_persists_pre_register_code(tmp_path: Path) -> None:
    """Side effect: 调用后 pre_register_codes 应该有 1 row (target/purpose 匹配)."""
    with _build_client(tmp_path) as (client, app):
        resp = client.post(
            "/api/v2/auth/sms/send-code",
            json={"phone": "+86 138-0013-8000", "purpose": "register"},
        )
        assert resp.status_code == 200, resp.text
        session = app.state.db.session_factory()
        try:
            rows = session.scalars(select(PreRegisterCode)).all()
            assert len(rows) == 1
            assert rows[0].target_kind == "phone"
            assert rows[0].target_value == "13800138000"  # normalized
            assert rows[0].purpose == "register"
            assert rows[0].used_at is None
        finally:
            session.close()


def test_sms_send_code_bind_phone_purpose_rejected(tmp_path: Path) -> None:
    """bind_phone purpose 走独立 endpoint (commit #4); 当前 endpoint 拒."""
    with _build_client(tmp_path) as (client, _app):
        resp = client.post(
            "/api/v2/auth/sms/send-code",
            json={"phone": "13800138000", "purpose": "bind_phone"},
        )
    assert resp.status_code == 403, resp.text
    assert resp.json()["code"] == "not_exposed"


def test_sms_send_code_invalid_phone_format(tmp_path: Path) -> None:
    """无法 normalize 的 phone (e.g. 1 后第二位 0-2) → 422 schema 拦或 400 service."""
    with _build_client(tmp_path) as (client, _app):
        resp = client.post(
            "/api/v2/auth/sms/send-code",
            json={"phone": "12800138000", "purpose": "register"},
        )
    # Pydantic schema min_length=11 max_length=20 不拦此 case (长度对); service
    # normalize_phone 返 None → ValidationError → 400.
    assert resp.status_code in (400, 422), resp.text


# ─── /register/phone (full flow: send-code → register) ─────


def _send_sms_code_and_get(client: TestClient, phone: str) -> str:
    """Helper: 调 send-code with dev gate on, 返 raw code."""
    resp = client.post(
        "/api/v2/auth/sms/send-code",
        json={"phone": phone, "purpose": "register"},
    )
    assert resp.status_code == 200, resp.text
    code = resp.json().get("_devMagicCode")
    assert code is not None
    return code


def test_register_phone_full_flow_happy(tmp_path: Path) -> None:
    with _build_client(tmp_path) as (client, _app):
        code = _send_sms_code_and_get(client, "13800138000")
        resp = client.post(
            "/api/v2/auth/register/phone",
            json={
                "phone": "13800138000",
                "smsCode": code,
                "password": "Pass123!",
            },
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["user"]["phone"] == "13800138000"
    assert body["user"]["phoneVerified"] is True  # D10 verify-then-write
    assert body["user"]["email"] is None
    assert body["user"]["needsIdentifierSetup"] is False
    # display_name fallback 用户XXXX (review fix #6)
    assert body["user"]["displayName"] == "用户8000"


def test_register_phone_wrong_sms_code_returns_410(tmp_path: Path) -> None:
    with _build_client(tmp_path) as (client, _app):
        # 先调 send-code 让 active code 存在 (否则 verify_code 找不到 active 直接拒)
        _send_sms_code_and_get(client, "13800138000")
        resp = client.post(
            "/api/v2/auth/register/phone",
            json={
                "phone": "13800138000",
                "smsCode": "999999",
                "password": "Pass123!",
            },
        )
    assert resp.status_code == 410, resp.text
    assert resp.json()["code"] == "code_invalid"


def test_register_phone_duplicate_returns_409_before_verify(
    tmp_path: Path,
) -> None:
    """D18 入口预检: phone 已被占 → 409 code=phone_taken, 不消耗 SMS code."""
    with _build_client(tmp_path) as (client, app):
        _seed_existing_phone_user(app, phone="13800138000")
        # 即使带正确 sms_code 也应在 unique 预检处拒 (不进 verify_code).
        code = _send_sms_code_and_get(client, "13800138000")
        resp = client.post(
            "/api/v2/auth/register/phone",
            json={
                "phone": "13800138000",
                "smsCode": code,
                "password": "Pass123!",
            },
        )
    assert resp.status_code == 409, resp.text
    assert resp.json()["code"] == "phone_taken"
