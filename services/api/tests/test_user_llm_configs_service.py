"""User BYOM config service + factory tests.

Route-level llm config suites stay archived with the legacy unmounted surface.
These tests keep the pure service/factory coverage active.
"""

from __future__ import annotations

import secrets
from collections.abc import Iterator
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from sikao_api.core.config import Settings
from sikao_api.db.base import Base
from sikao_api.db.models import User
from sikao_api.modules.auth.application.security import hash_password
from sikao_api.modules.llm.application.llm import (
    LLMConfigError,
    build_llm_provider,
)
from sikao_api.modules.llm.application.user_configs import UserLlmConfigService
from sikao_api.modules.system.application.errors import ConflictError, NotFoundError


def _master_key_hex() -> str:
    return secrets.token_hex(32)


def _public_addrinfo(ip: str = "8.8.8.8") -> list:  # type: ignore[type-arg]
    return [(2, 1, 6, "", (ip, 0))]


@pytest.fixture
def session() -> Iterator[Session]:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    session_local = sessionmaker(
        bind=engine,
        autoflush=False,
        expire_on_commit=False,
        future=True,
    )
    db = session_local()
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
    assert config.is_default is False
    assert isinstance(config.api_key_encrypted, bytes)
    assert b"sk-test" not in config.api_key_encrypted


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
    settings = _make_settings()
    user = _make_user(session)
    service = UserLlmConfigService(session, settings)
    with patch("socket.getaddrinfo", return_value=_public_addrinfo()):
        config_a = service.create(
            user_id=user.id,
            label="a",
            base_url="https://api.deepseek.com/v1",
            api_key="sk-1",
            model="m",
        )
        config_b = service.create(
            user_id=user.id,
            label="b",
            base_url="https://api.openai.com/v1",
            api_key="sk-2",
            model="m",
        )
    service.set_default(user_id=user.id, config_id=config_a.id)
    service.set_default(user_id=user.id, config_id=config_b.id)
    session.refresh(config_a)
    session.refresh(config_b)
    assert config_a.is_default is False
    assert config_b.is_default is True


def test_get_user_default_returns_none_when_no_default(session: Session) -> None:
    settings = _make_settings()
    user = _make_user(session)
    service = UserLlmConfigService(session, settings)
    with patch("socket.getaddrinfo", return_value=_public_addrinfo()):
        service.create(
            user_id=user.id,
            label="x",
            base_url="https://api.deepseek.com/v1",
            api_key="sk-x",
            model="m",
        )
    assert service.get_user_default(user_id=user.id) is None


def test_delete_config_removes_row(session: Session) -> None:
    settings = _make_settings()
    user = _make_user(session)
    service = UserLlmConfigService(session, settings)
    with patch("socket.getaddrinfo", return_value=_public_addrinfo()):
        config = service.create(
            user_id=user.id,
            label="x",
            base_url="https://api.deepseek.com/v1",
            api_key="sk-x",
            model="m",
        )
    service.delete(user_id=user.id, config_id=config.id)
    assert service.list(user_id=user.id) == []


def test_get_or_404_other_user_config_blocked(session: Session) -> None:
    settings = _make_settings()
    user_a = _make_user(session, username="alice")
    user_b = _make_user(session, username="bob")
    service = UserLlmConfigService(session, settings)
    with patch("socket.getaddrinfo", return_value=_public_addrinfo()):
        config = service.create(
            user_id=user_a.id,
            label="x",
            base_url="https://api.deepseek.com/v1",
            api_key="sk-x",
            model="m",
        )
    with pytest.raises(NotFoundError):
        service.delete(user_id=user_b.id, config_id=config.id)


def test_serialize_masked_never_returns_raw_key(session: Session) -> None:
    settings = _make_settings()
    user = _make_user(session)
    service = UserLlmConfigService(session, settings)
    plaintext = "sk-30c7456ee25148ec952f5e7fff318f3c"
    with patch("socket.getaddrinfo", return_value=_public_addrinfo()):
        config = service.create(
            user_id=user.id,
            label="x",
            base_url="https://api.deepseek.com/v1",
            api_key=plaintext,
            model="m",
        )
    [serialized] = service.serialize_masked([config])
    assert serialized["api_key_masked"] != plaintext
    assert plaintext not in str(serialized)
    assert serialized["api_key_masked"] == "sk-30...8f3c"


def test_build_llm_provider_user_default_overrides_system(
    session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("sikao_api.core.config._read_apikey_file_default", lambda: None)
    settings = _make_settings(llm_api_key="sk-system-key")
    user = _make_user(session)
    service = UserLlmConfigService(session, settings)
    with patch("socket.getaddrinfo", return_value=_public_addrinfo()):
        config = service.create(
            user_id=user.id,
            label="my",
            base_url="https://api.openai.com/v1",
            api_key="sk-user-byom-key",
            model="gpt-4o",
        )
        service.set_default(user_id=user.id, config_id=config.id)
        provider, label = build_llm_provider(settings, db=session, user_id=user.id)
    assert provider._config.base_url == "https://api.openai.com/v1"  # type: ignore[attr-defined]
    assert provider._config.api_key == "sk-user-byom-key"  # type: ignore[attr-defined]
    assert label == "user_byom"


def test_build_llm_provider_falls_back_to_system_when_no_user_default(
    session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("sikao_api.core.config._read_apikey_file_default", lambda: None)
    settings = _make_settings(llm_api_key="sk-system-key")
    user = _make_user(session)
    provider, label = build_llm_provider(settings, db=session, user_id=user.id)
    assert provider._config.api_key == "sk-system-key"  # type: ignore[attr-defined]
    assert label == "system"


def test_build_llm_provider_no_db_no_user_id_uses_system(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("sikao_api.core.config._read_apikey_file_default", lambda: None)
    settings = _make_settings(llm_api_key="sk-system-key")
    provider, label = build_llm_provider(settings)
    assert provider._config.api_key == "sk-system-key"  # type: ignore[attr-defined]
    assert label == "system"
