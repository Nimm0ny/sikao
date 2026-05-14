"""SIKAO Wave 10 Phase B — note comments (一级嵌套).

Coverage:
  - create: 顶层 + 一级 child OK; grand-child (parent.parent_id NOT NULL) → 422.
  - create: 私笔记 (is_public=false) → 404; non-existent note → 404.
  - list: ASC by created_at; anonymous note → user_display_name None.
  - delete: owner-only; cross-user → 404. notes.comments_count 同步维护.
  - delete 顶层 cascade 带走 children (count 减去 1+children).
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from sikao_api.core.config import Settings
from sikao_api.db.session import DatabaseManager
from sikao_api.db.models import Note
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
        "body": {"text": "金句"},
        "sourceKind": "specialty",
        "sourceRef": "ref",
        "sourceDomain": "essay",
        "title": "t",
        "tags": [],
    }


def _create_public_note(
    c: TestClient, *, anonymous: bool = True
) -> int:
    created = c.post(
        "/api/v2/notebook/notes", json=_quote_payload(), headers=_csrf(c)
    ).json()
    note_id = created["id"]
    c.patch(
        f"/api/v2/notebook/notes/{note_id}/public-toggle",
        json={"isPublic": True, "displayAnonymous": anonymous},
        headers=_csrf(c),
    )
    return note_id


# ─── Create ─────────────────────────────────────────────────────────────────


def test_create_top_level_comment(client) -> None:
    c, _ = client
    _register(c)
    note_id = _create_public_note(c)
    resp = c.post(
        f"/api/v2/notebook/notes/{note_id}/comments",
        json={"content": "评论一段"},
        headers=_csrf(c),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["noteId"] == note_id
    assert body["content"] == "评论一段"
    assert body["parentCommentId"] is None
    assert body["likesCount"] == 0


def test_create_one_level_nested_reply(client) -> None:
    c, _ = client
    _register(c)
    note_id = _create_public_note(c)
    top = c.post(
        f"/api/v2/notebook/notes/{note_id}/comments",
        json={"content": "顶层"},
        headers=_csrf(c),
    ).json()
    reply = c.post(
        f"/api/v2/notebook/notes/{note_id}/comments",
        json={"content": "回复", "parentCommentId": top["id"]},
        headers=_csrf(c),
    )
    assert reply.status_code == 201
    assert reply.json()["parentCommentId"] == top["id"]


def test_create_grand_child_reply_returns_422(client) -> None:
    """parent comment 已经是 child → 拒绝 (一级嵌套)."""
    c, _ = client
    _register(c)
    note_id = _create_public_note(c)
    top = c.post(
        f"/api/v2/notebook/notes/{note_id}/comments",
        json={"content": "顶层"},
        headers=_csrf(c),
    ).json()
    child = c.post(
        f"/api/v2/notebook/notes/{note_id}/comments",
        json={"content": "child", "parentCommentId": top["id"]},
        headers=_csrf(c),
    ).json()
    grand = c.post(
        f"/api/v2/notebook/notes/{note_id}/comments",
        json={"content": "grand", "parentCommentId": child["id"]},
        headers=_csrf(c),
    )
    assert grand.status_code == 422


def test_create_on_private_note_returns_404(client) -> None:
    c, _ = client
    _register(c)
    created = c.post(
        "/api/v2/notebook/notes", json=_quote_payload(), headers=_csrf(c)
    ).json()
    # 不 public-toggle, is_public=false
    resp = c.post(
        f"/api/v2/notebook/notes/{created['id']}/comments",
        json={"content": "ping"},
        headers=_csrf(c),
    )
    assert resp.status_code == 404


def test_create_unauthenticated_returns_401(client) -> None:
    c, _ = client
    _register(c)
    note_id = _create_public_note(c)
    c.cookies.clear()
    resp = c.post(
        f"/api/v2/notebook/notes/{note_id}/comments",
        json={"content": "ping"},
    )
    assert resp.status_code == 401


def test_create_parent_from_different_note_returns_422(client) -> None:
    """parent_comment_id 引另一 note 的 comment → 422."""
    c, _ = client
    _register(c)
    note1 = _create_public_note(c)
    note2 = _create_public_note(c)
    top_on_note1 = c.post(
        f"/api/v2/notebook/notes/{note1}/comments",
        json={"content": "on n1"},
        headers=_csrf(c),
    ).json()
    bad = c.post(
        f"/api/v2/notebook/notes/{note2}/comments",
        json={"content": "x-note", "parentCommentId": top_on_note1["id"]},
        headers=_csrf(c),
    )
    assert bad.status_code == 422


# ─── List ───────────────────────────────────────────────────────────────────


def test_list_returns_ascending_by_created_at(client) -> None:
    c, _ = client
    _register(c)
    note_id = _create_public_note(c)
    for content in ("a", "b", "c"):
        c.post(
            f"/api/v2/notebook/notes/{note_id}/comments",
            json={"content": content},
            headers=_csrf(c),
        )
    resp = c.get(f"/api/v2/notebook/notes/{note_id}/comments")
    items = resp.json()["items"]
    assert [i["content"] for i in items] == ["a", "b", "c"]


def test_list_anonymous_note_hides_display_name(client) -> None:
    c, _ = client
    _register(c, username="alice")
    note_id = _create_public_note(c, anonymous=True)
    c.post(
        f"/api/v2/notebook/notes/{note_id}/comments",
        json={"content": "hi"},
        headers=_csrf(c),
    )
    resp = c.get(f"/api/v2/notebook/notes/{note_id}/comments")
    item = resp.json()["items"][0]
    assert item["userDisplayName"] is None


def test_list_non_anonymous_note_shows_display_name(client) -> None:
    c, _ = client
    _register(c, username="alice")
    note_id = _create_public_note(c, anonymous=False)
    c.post(
        f"/api/v2/notebook/notes/{note_id}/comments",
        json={"content": "hi"},
        headers=_csrf(c),
    )
    resp = c.get(f"/api/v2/notebook/notes/{note_id}/comments")
    item = resp.json()["items"][0]
    assert item["userDisplayName"] == "alice"


# ─── Delete ─────────────────────────────────────────────────────────────────


def test_delete_top_comment_owner_204(client) -> None:
    c, _ = client
    _register(c)
    note_id = _create_public_note(c)
    top = c.post(
        f"/api/v2/notebook/notes/{note_id}/comments",
        json={"content": "x"},
        headers=_csrf(c),
    ).json()
    resp = c.delete(
        f"/api/v2/notebook/comments/{top['id']}", headers=_csrf(c)
    )
    assert resp.status_code == 204


def test_delete_cross_user_returns_404(client) -> None:
    c, _ = client
    _register(c, username="alice")
    note_id = _create_public_note(c)
    top = c.post(
        f"/api/v2/notebook/notes/{note_id}/comments",
        json={"content": "x"},
        headers=_csrf(c),
    ).json()
    c.cookies.clear()
    _register(c, username="bob")
    resp = c.delete(
        f"/api/v2/notebook/comments/{top['id']}", headers=_csrf(c)
    )
    assert resp.status_code == 404


def test_delete_decrements_comments_count(client, tmp_path) -> None:
    c, _ = client
    _register(c)
    note_id = _create_public_note(c)
    top = c.post(
        f"/api/v2/notebook/notes/{note_id}/comments",
        json={"content": "x"},
        headers=_csrf(c),
    ).json()
    # 直接查 DB 看 count
    db_url = f"sqlite:///{(tmp_path / 'exam.db').as_posix()}"
    db = DatabaseManager(
        Settings(
            app_env="test",
            database_url=db_url,
            upload_dir=tmp_path / "uploads",
            import_tmp_dir=tmp_path / "imports",
            admin_username="admin",
            admin_password_hash=hash_password("adminpass"),
            jwt_secret="test-secret-0123456789-test-secret",
            llm_api_key="sk",
            llm_base_url="https://api.deepseek.com/v1",
        )
    )
    with db.session_factory() as session:
        n = session.get(Note, note_id)
        assert n is not None
        assert n.comments_count == 1
    c.delete(f"/api/v2/notebook/comments/{top['id']}", headers=_csrf(c))
    with db.session_factory() as session:
        n = session.get(Note, note_id)
        assert n is not None
        assert n.comments_count == 0


def test_delete_top_cascades_children_count(client, tmp_path) -> None:
    """删顶层 comment → comments_count -= 1+children."""
    c, _ = client
    _register(c)
    note_id = _create_public_note(c)
    top = c.post(
        f"/api/v2/notebook/notes/{note_id}/comments",
        json={"content": "top"},
        headers=_csrf(c),
    ).json()
    for content in ("c1", "c2"):
        c.post(
            f"/api/v2/notebook/notes/{note_id}/comments",
            json={"content": content, "parentCommentId": top["id"]},
            headers=_csrf(c),
        )
    db_url = f"sqlite:///{(tmp_path / 'exam.db').as_posix()}"
    db = DatabaseManager(
        Settings(
            app_env="test",
            database_url=db_url,
            upload_dir=tmp_path / "uploads",
            import_tmp_dir=tmp_path / "imports",
            admin_username="admin",
            admin_password_hash=hash_password("adminpass"),
            jwt_secret="test-secret-0123456789-test-secret",
            llm_api_key="sk",
            llm_base_url="https://api.deepseek.com/v1",
        )
    )
    with db.session_factory() as session:
        n = session.get(Note, note_id)
        assert n is not None
        assert n.comments_count == 3
    # 删顶层 → 减 3 (顶层 + 2 children)
    c.delete(f"/api/v2/notebook/comments/{top['id']}", headers=_csrf(c))
    with db.session_factory() as session:
        n = session.get(Note, note_id)
        assert n is not None
        assert n.comments_count == 0


# ─── Note 不存在 ────────────────────────────────────────────────────────────


def test_create_on_nonexistent_note_returns_404(client) -> None:
    c, _ = client
    _register(c)
    resp = c.post(
        "/api/v2/notebook/notes/999999/comments",
        json={"content": "x"},
        headers=_csrf(c),
    )
    assert resp.status_code == 404


def test_list_on_nonexistent_note_returns_404(client) -> None:
    c, _ = client
    _register(c)
    resp = c.get("/api/v2/notebook/notes/999999/comments")
    assert resp.status_code == 404
