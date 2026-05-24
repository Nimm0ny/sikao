"""SIKAO Wave 10 Phase B — note likes / favorites toggle.

Coverage:
  - like toggle idempotent: 1st POST → liked=true, count=1; 2nd POST → liked=false, count=0.
  - favorite toggle idempotent.
  - private note (is_public=false) → 404.
  - 多用户独立 like (alice + bob 各 1 → likes_count=2).
  - 未登录 → 401.
  - 不存在 note → 404.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from sikao_api.core.config import Settings
from sikao_api.db.session import DatabaseManager
from sikao_api.main import create_app
from sikao_api.modules.auth.application.security import hash_password


@contextmanager
def _build_client(tmp_path: Path) -> Iterator[tuple[TestClient, Settings]]:
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'exam.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        admin_username="admin",
        admin_password_hash=hash_password("adminpass"),
        jwt_secret="test-secret-0123456789-test-secret",
        llm_api_key="sk-test-key",
        llm_base_url="https://api.deepseek.com/v1",
    )
    app = create_app(settings=settings, initialize_schema=True)
    db = DatabaseManager(settings)
    db.create_all()
    with TestClient(app) as client:
        yield client, settings


@pytest.fixture
def client(tmp_path: Path) -> Iterator[tuple[TestClient, Settings]]:
    with _build_client(tmp_path) as (c, s):
        yield c, s


def _register(c: TestClient, *, username: str = "user1") -> int:
    resp = c.post(
        "/api/v2/auth/register/email",
        json={
            "email": f"{username}@test.local",
            "password": "passw0rd",
            "displayName": username,
        },
    )
    assert resp.status_code == 200, resp.text
    return int(resp.json()["user"]["id"])


def _csrf(c: TestClient) -> dict[str, str]:
    csrf = c.cookies.get("csrf_token")
    assert csrf
    return {"X-CSRF-Token": csrf}


def _quote_payload() -> dict:
    return {
        "type": "quote",
        "body": {"text": "x"},
        "sourceKind": "specialty",
        "sourceRef": "ref",
        "sourceDomain": "essay",
        "title": "t",
        "tags": [],
    }


def _create_public_note(c: TestClient) -> int:
    created = c.post(
        "/api/v2/notebook/notes", json=_quote_payload(), headers=_csrf(c)
    ).json()
    nid = created["id"]
    c.patch(
        f"/api/v2/notebook/notes/{nid}/public-toggle",
        json={"isPublic": True, "displayAnonymous": True},
        headers=_csrf(c),
    )
    return nid


# ─── Likes ──────────────────────────────────────────────────────────────────


def test_like_first_toggle_is_liked_true(client) -> None:
    c, _ = client
    _register(c)
    nid = _create_public_note(c)
    resp = c.post(
        f"/api/v2/notebook/notes/{nid}/likes", headers=_csrf(c)
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["liked"] is True
    assert body["likesCount"] == 1


def test_like_second_toggle_unlikes(client) -> None:
    c, _ = client
    _register(c)
    nid = _create_public_note(c)
    c.post(f"/api/v2/notebook/notes/{nid}/likes", headers=_csrf(c))
    resp = c.post(f"/api/v2/notebook/notes/{nid}/likes", headers=_csrf(c))
    body = resp.json()
    assert body["liked"] is False
    assert body["likesCount"] == 0


def test_like_multiple_users_independent(client) -> None:
    c, _ = client
    _register(c, username="alice")
    nid = _create_public_note(c)
    c.post(f"/api/v2/notebook/notes/{nid}/likes", headers=_csrf(c))
    c.cookies.clear()
    _register(c, username="bob")
    resp = c.post(f"/api/v2/notebook/notes/{nid}/likes", headers=_csrf(c))
    body = resp.json()
    assert body["liked"] is True
    assert body["likesCount"] == 2


def test_like_private_note_returns_404(client) -> None:
    c, _ = client
    _register(c)
    created = c.post(
        "/api/v2/notebook/notes", json=_quote_payload(), headers=_csrf(c)
    ).json()
    # 不 public, 私笔记
    resp = c.post(
        f"/api/v2/notebook/notes/{created['id']}/likes", headers=_csrf(c)
    )
    assert resp.status_code == 404


def test_like_nonexistent_note_returns_404(client) -> None:
    c, _ = client
    _register(c)
    resp = c.post(
        "/api/v2/notebook/notes/999999/likes", headers=_csrf(c)
    )
    assert resp.status_code == 404


def test_like_unauthenticated_returns_401(client) -> None:
    c, _ = client
    _register(c)
    nid = _create_public_note(c)
    c.cookies.clear()
    resp = c.post(f"/api/v2/notebook/notes/{nid}/likes")
    assert resp.status_code == 401


# ─── Favorites ──────────────────────────────────────────────────────────────


def test_favorite_first_toggle_returns_favorited_true(client) -> None:
    c, _ = client
    _register(c)
    nid = _create_public_note(c)
    resp = c.post(
        f"/api/v2/notebook/notes/{nid}/favorites", headers=_csrf(c)
    )
    assert resp.status_code == 200
    assert resp.json()["favorited"] is True


def test_favorite_second_toggle_unfavorites(client) -> None:
    c, _ = client
    _register(c)
    nid = _create_public_note(c)
    c.post(f"/api/v2/notebook/notes/{nid}/favorites", headers=_csrf(c))
    resp = c.post(
        f"/api/v2/notebook/notes/{nid}/favorites", headers=_csrf(c)
    )
    assert resp.json()["favorited"] is False


def test_favorite_private_note_returns_404(client) -> None:
    c, _ = client
    _register(c)
    created = c.post(
        "/api/v2/notebook/notes", json=_quote_payload(), headers=_csrf(c)
    ).json()
    resp = c.post(
        f"/api/v2/notebook/notes/{created['id']}/favorites", headers=_csrf(c)
    )
    assert resp.status_code == 404


def test_favorite_does_not_affect_likes_count(client) -> None:
    c, _ = client
    _register(c)
    nid = _create_public_note(c)
    c.post(f"/api/v2/notebook/notes/{nid}/favorites", headers=_csrf(c))
    # likes_count 应该仍是 0
    public = c.get(
        f"/api/v2/notebook/notes/{nid}"
    ).json()
    assert public["likesCount"] == 0
