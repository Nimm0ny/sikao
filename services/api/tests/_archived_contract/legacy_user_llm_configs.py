"""User BYOM config CRUD service + endpoint tests — Slice 0c.

Cover:
- service: create / list / update / delete / set_default / get_user_default
- service: build_provider (decrypt + SSRF re-check + return provider)
- endpoint: GET list / POST create / PATCH / DELETE / set-default (auth + CSRF)
- factory build_llm_provider(settings, db, user_id) 优先 user default
"""

from __future__ import annotations

import secrets
from collections.abc import Iterator
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from sikao_api.core.config import Settings
from sikao_api.db.base import Base
from sikao_api.db.models import User, UserLlmConfig
from sikao_api.main import create_app
from sikao_api.modules.system.application.errors import ConflictError, NotFoundError
from sikao_api.modules.llm.application.llm import LLMConfigError, build_llm_provider
from sikao_api.modules.auth.application.security import hash_password
from sikao_api.modules.llm.application.user_configs import UserLlmConfigService


def _master_key_hex() -> str:
    return secrets.token_hex(32)


def _public_addrinfo(ip: str = "8.8.8.8") -> list:  # type: ignore[type-arg]
    return [(2, 1, 6, "", (ip, 0))]


@pytest.fixture
def session() -> Iterator[Session]:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False, future=True
    )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _make_settings(**overrides: object) -> Settings:
    base = {"_env_file": None, "llm_config_enc_key": _master_key_hex()}
    base.update(overrides)
    return Settings(**base)  # type: ignore[arg-type]


def _make_user(db: Session, *, username: str = "alice") -> User:
    user = User(
        username=username,
        password_hash=hash_password("password"),
        display_name=username,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


# ─── service: create / list / update / delete ────────────────────────────


def test_create_config_persists_with_encrypted_key(session: Session) -> None:
    settings = _make_settings()
    user = _make_user(session)
    service = UserLlmConfigService(session, settings)
    with patch("socket.getaddrinfo", return_value=_public_addrinfo()):
        config = service.create(
            user_id=user.id,
            label="My DeepSeek",
            base_url="https://api.deepseek.com/v1",
            api_key="sk-test-12345-real-looking",
            model="deepseek-v4-flash",
        )
    assert config.id is not None
    assert config.label == "My DeepSeek"
    assert config.is_default is False  # 创建时默认不是 default
    # api_key_encrypted 是 bytes, 不是明文
    assert isinstance(config.api_key_encrypted, bytes)
    assert b"sk-test" not in config.api_key_encrypted  # 明文不在 blob 里


def test_create_config_label_collision_raises_conflict(session: Session) -> None:
    settings = _make_settings()
    user = _make_user(session)
    service = UserLlmConfigService(session, settings)
    with patch("socket.getaddrinfo", return_value=_public_addrinfo()):
        service.create(
            user_id=user.id,
            label="dupe",
            base_url="https://api.deepseek.com/v1",
            api_key="sk-1",
            model="x",
        )
        with pytest.raises(ConflictError, match="already exists") as exc_info:
            service.create(
                user_id=user.id,
                label="dupe",
                base_url="https://api.openai.com/v1",
                api_key="sk-2",
                model="y",
            )
        assert exc_info.value.code == "llm_config_label_taken"


def test_create_config_without_master_key_raises(session: Session) -> None:
    """Missing LLM_CONFIG_ENC_KEY → LLMConfigError (BYOM unavailable)."""
    settings = _make_settings(llm_config_enc_key=None)
    user = _make_user(session)
    service = UserLlmConfigService(session, settings)
    with patch("socket.getaddrinfo", return_value=_public_addrinfo()):
        with pytest.raises(LLMConfigError, match="BYOM unavailable"):
            service.create(
                user_id=user.id,
                label="x",
                base_url="https://api.deepseek.com/v1",
                api_key="sk-x",
                model="m",
            )


def test_set_default_demotes_other_configs(session: Session) -> None:
    """同 user 多 config, set_default 让其他 is_default=False, 当前 True."""
    settings = _make_settings()
    user = _make_user(session)
    service = UserLlmConfigService(session, settings)
    with patch("socket.getaddrinfo", return_value=_public_addrinfo()):
        c1 = service.create(
            user_id=user.id, label="a",
            base_url="https://api.deepseek.com/v1",
            api_key="sk-1", model="m",
        )
        c2 = service.create(
            user_id=user.id, label="b",
            base_url="https://api.openai.com/v1",
            api_key="sk-2", model="m",
        )
    service.set_default(user_id=user.id, config_id=c1.id)
    service.set_default(user_id=user.id, config_id=c2.id)
    session.refresh(c1)
    session.refresh(c2)
    assert c1.is_default is False
    assert c2.is_default is True


def test_get_user_default_returns_none_when_no_default(session: Session) -> None:
    settings = _make_settings()
    user = _make_user(session)
    service = UserLlmConfigService(session, settings)
    with patch("socket.getaddrinfo", return_value=_public_addrinfo()):
        service.create(
            user_id=user.id, label="x",
            base_url="https://api.deepseek.com/v1",
            api_key="sk-x", model="m",
        )
    # 没 set_default → None
    assert service.get_user_default(user_id=user.id) is None


def test_delete_config_removes_row(session: Session) -> None:
    settings = _make_settings()
    user = _make_user(session)
    service = UserLlmConfigService(session, settings)
    with patch("socket.getaddrinfo", return_value=_public_addrinfo()):
        c = service.create(
            user_id=user.id, label="x",
            base_url="https://api.deepseek.com/v1",
            api_key="sk-x", model="m",
        )
    service.delete(user_id=user.id, config_id=c.id)
    assert service.list(user_id=user.id) == []


def test_get_or_404_other_user_config_blocked(session: Session) -> None:
    """User A 不能 update / delete user B 的 config."""
    settings = _make_settings()
    user_a = _make_user(session, username="alice")
    user_b = _make_user(session, username="bob")
    service = UserLlmConfigService(session, settings)
    with patch("socket.getaddrinfo", return_value=_public_addrinfo()):
        c = service.create(
            user_id=user_a.id, label="x",
            base_url="https://api.deepseek.com/v1",
            api_key="sk-x", model="m",
        )
    with pytest.raises(NotFoundError):
        service.delete(user_id=user_b.id, config_id=c.id)


def test_serialize_masked_never_returns_raw_key(session: Session) -> None:
    """UI serialization: api_key 全部 mask 不暴露 raw."""
    settings = _make_settings()
    user = _make_user(session)
    service = UserLlmConfigService(session, settings)
    plaintext = "sk-30c7456ee25148ec952f5e7fff318f3c"
    with patch("socket.getaddrinfo", return_value=_public_addrinfo()):
        config = service.create(
            user_id=user.id, label="x",
            base_url="https://api.deepseek.com/v1",
            api_key=plaintext, model="m",
        )
    [serialized] = service.serialize_masked([config])
    assert serialized["api_key_masked"] != plaintext
    assert plaintext not in str(serialized)
    # mask 格式 'sk-30...8f3c' (前 5 + 后 4 chars)
    assert serialized["api_key_masked"] == "sk-30...8f3c"


# ─── factory build_llm_provider user-aware ───────────────────────────────


def test_build_llm_provider_user_default_overrides_system(
    session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """User 有 default config → factory 用 user 的, 不用 settings.llm_*."""
    monkeypatch.setattr("sikao_api.core.config._read_apikey_file_default", lambda: None)
    settings = _make_settings(llm_api_key="sk-system-key")
    user = _make_user(session)
    service = UserLlmConfigService(session, settings)
    with patch("socket.getaddrinfo", return_value=_public_addrinfo()):
        c = service.create(
            user_id=user.id, label="my",
            base_url="https://api.openai.com/v1",
            api_key="sk-user-byom-key", model="gpt-4o",
        )
        service.set_default(user_id=user.id, config_id=c.id)

        provider, label = build_llm_provider(settings, db=session, user_id=user.id)
    # provider config 走 user's base_url/key (不是 settings.llm_base_url)
    assert provider._config.base_url == "https://api.openai.com/v1"  # type: ignore[attr-defined]
    assert provider._config.api_key == "sk-user-byom-key"  # type: ignore[attr-defined]
    assert label == "user_byom"  # Slice 1a P1: factory 是 truth source


def test_build_llm_provider_falls_back_to_system_when_no_user_default(
    session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """User 没 default config → factory fallback system default settings.llm_*."""
    monkeypatch.setattr("sikao_api.core.config._read_apikey_file_default", lambda: None)
    settings = _make_settings(llm_api_key="sk-system-key")
    user = _make_user(session)
    # 不 set_default
    provider, label = build_llm_provider(settings, db=session, user_id=user.id)
    assert provider._config.api_key == "sk-system-key"  # type: ignore[attr-defined]
    assert label == "system"


def test_build_llm_provider_no_db_no_user_id_uses_system(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """未传 db / user_id (e.g. system task) → 直接 system default."""
    monkeypatch.setattr("sikao_api.core.config._read_apikey_file_default", lambda: None)
    settings = _make_settings(llm_api_key="sk-system-key")
    provider, label = build_llm_provider(settings)
    assert provider._config.api_key == "sk-system-key"  # type: ignore[attr-defined]
    assert label == "system"


# ─── endpoint tests ───────────────────────────────────────────────────────


@pytest.fixture
def client(tmp_path):  # type: ignore[no-untyped-def]
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'exam-api.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        admin_username="admin",
        admin_password_hash=hash_password("adminpass"),
        jwt_secret="test-secret-0123456789-test-secret",
        llm_config_enc_key=_master_key_hex(),
    )
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as c:
        yield c


def _register_user(client: TestClient) -> str:
    """Register + return csrfToken (cookie auto-set)."""
    resp = client.post(
        "/api/v2/auth/register/email",
        json={"email": "user1@test.local", "password": "passw0rd", "displayName": "U1"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json().get("csrfToken") or _get_csrf_from_cookies(client)


def _get_csrf_from_cookies(client: TestClient) -> str:
    for cookie in client.cookies.jar:
        if cookie.name == "csrf_token":
            return cookie.value or ""
    raise RuntimeError("csrf_token cookie not found after register")


def test_endpoint_create_config_requires_csrf(client: TestClient) -> None:
    """POST /llm/configs require CSRF header (mutating endpoint)."""
    _register_user(client)
    # 不带 CSRF header
    resp = client.post(
        "/api/v2/llm/configs",
        json={
            "label": "x",
            "baseUrl": "https://api.deepseek.com/v1",
            "apiKey": "sk-x",
            "model": "m",
        },
    )
    assert resp.status_code == 403
    assert resp.json()["code"].startswith("csrf_")


def test_endpoint_list_configs_unauthenticated(client: TestClient) -> None:
    """GET /llm/configs require auth."""
    resp = client.get("/api/v2/llm/configs")
    assert resp.status_code == 401


def test_endpoint_create_then_list_config(client: TestClient) -> None:
    """Happy path: register → create config → list 包含."""
    csrf = _register_user(client)
    with patch("socket.getaddrinfo", return_value=_public_addrinfo()):
        create_resp = client.post(
            "/api/v2/llm/configs",
            headers={"X-CSRF-Token": csrf},
            json={
                "label": "我的 DeepSeek",
                "baseUrl": "https://api.deepseek.com/v1",
                "apiKey": "sk-30c7456ee25148ec952f5e7fff318f3c",
                "model": "deepseek-v4-flash",
            },
        )
    assert create_resp.status_code == 201, create_resp.text
    body = create_resp.json()
    assert body["label"] == "我的 DeepSeek"
    assert body["isDefault"] is False
    # api_key never raw (前 5 + 后 4 mask)
    assert body["apiKeyMasked"] == "sk-30...8f3c"
    assert "sk-30c7456" not in str(body)  # 不应含明文

    # list 包含
    list_resp = client.get("/api/v2/llm/configs")
    assert list_resp.status_code == 200
    items = list_resp.json()["items"]
    assert len(items) == 1
    assert items[0]["label"] == "我的 DeepSeek"


def test_endpoint_create_config_ssrf_rejected(client: TestClient) -> None:
    """POST 含 metadata hostname → 422 + code='ssrf_blocked'."""
    csrf = _register_user(client)
    resp = client.post(
        "/api/v2/llm/configs",
        headers={"X-CSRF-Token": csrf},
        json={
            "label": "evil",
            "baseUrl": "http://metadata.google.internal/v1",
            "apiKey": "sk-x",
            "model": "m",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "ssrf_blocked"


def test_endpoint_test_config_with_corrupted_blob_returns_unreachable(
    client: TestClient, tmp_path  # type: ignore[no-untyped-def]
) -> None:
    """5th-review P1 #A: master key 漂移 / blob 损坏时 /test endpoint 不应 500.

    Setup: create config (encrypted with master_key A) → 篡改 row.api_key_encrypted
    bytes (模拟 master key rotation 让旧 blob 不可解密) → POST /test → 应返
    200 + status='unreachable' (不是 500), last_tested_status 写 DB.
    """
    csrf = _register_user(client)

    # Step 1: create real config
    with patch("socket.getaddrinfo", return_value=_public_addrinfo()):
        create_resp = client.post(
            "/api/v2/llm/configs",
            headers={"X-CSRF-Token": csrf},
            json={
                "label": "to-be-corrupted",
                "baseUrl": "https://api.deepseek.com/v1",
                "apiKey": "sk-original-key",
                "model": "deepseek-v4-flash",
            },
        )
    assert create_resp.status_code == 201, create_resp.text
    config_id = create_resp.json()["id"]

    # Step 2: 篡改 api_key_encrypted bytes (模拟 master key 漂移让旧 blob 不可解)
    db = client.app.state.db.session_factory()  # type: ignore[attr-defined]
    try:
        config = db.get(UserLlmConfig, config_id)
        assert config is not None
        # 改 ciphertext 1 byte → AES-GCM auth tag 不匹配 → InvalidEncryptedBlob
        tampered = bytearray(config.api_key_encrypted)
        tampered[13] ^= 0xFF
        config.api_key_encrypted = bytes(tampered)
        db.commit()
    finally:
        db.close()

    # Step 3: POST /test → 应 200 + 'unreachable' 不是 500
    resp = client.post(
        f"/api/v2/llm/configs/{config_id}/test",
        headers={"X-CSRF-Token": csrf},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "unreachable"

    # Step 4: last_tested_status 写到 DB (用户从 list endpoint 看到)
    list_resp = client.get("/api/v2/llm/configs")
    [item] = list_resp.json()["items"]
    assert item["lastTestedStatus"] == "unreachable"


def test_endpoint_test_config_ssrf_rebind_returns_unreachable(
    client: TestClient,
) -> None:
    """5th-review P1 #A: DNS rebinding (create OK + call IP 内网) → 'unreachable'."""
    csrf = _register_user(client)

    # Create config: 第一次 resolve 成 public IP
    with patch("socket.getaddrinfo", return_value=_public_addrinfo()):
        create_resp = client.post(
            "/api/v2/llm/configs",
            headers={"X-CSRF-Token": csrf},
            json={
                "label": "rebind-target",
                "baseUrl": "https://attacker-rebind.example/v1",
                "apiKey": "sk-x",
                "model": "m",
            },
        )
    assert create_resp.status_code == 201
    config_id = create_resp.json()["id"]

    # Test: 第二次 resolve 成 loopback (DNS rebind 模拟) → SSRF 拦
    with patch(
        "socket.getaddrinfo",
        return_value=[(2, 1, 6, "", ("127.0.0.1", 0))],
    ):
        resp = client.post(
            f"/api/v2/llm/configs/{config_id}/test",
            headers={"X-CSRF-Token": csrf},
        )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "unreachable"
