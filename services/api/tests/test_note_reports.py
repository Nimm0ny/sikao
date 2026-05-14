"""SIKAO Wave 10 Phase B — note reports + admin queue.

Coverage:
  - create report (note + comment targets); target 不存在 → 404.
  - admin queue: FIFO ASC, target_preview shape (note: title+body_text;
    comment: note_id+content), reporter_display_name 解析.
  - admin dismiss: status='dismissed', target 保留.
  - admin approve-delete (note): cascade 删 note + ORM cascade likes/comments.
  - admin approve-delete (comment): 删 comment + 维护 notes.comments_count.
  - 重复 review → 422.
  - admin endpoints HTTP Basic gate (无 admin auth → 401).
"""

from __future__ import annotations

from base64 import b64encode
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from sikao_api.core.config import Settings
from sikao_api.db.session import DatabaseManager
from sikao_api.db.models import Note, NoteComment, NoteReport
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


def _admin_auth_headers(c: TestClient | None = None) -> dict[str, str]:
    """Build admin Basic auth headers. If TestClient given, also include
    X-CSRF-Token header so verify_csrf_token_if_cookie_auth dep passes when
    残留 user cookie 仍在 jar (跨测试 jar 持久, admin Basic 模式不该被拦但
    dep 看到 auth_token cookie 后 strict 验 csrf header).
    """
    token = b64encode(b"admin:adminpass").decode()
    headers = {"Authorization": f"Basic {token}"}
    if c is not None:
        csrf = c.cookies.get("csrf_token")
        if csrf:
            headers["X-CSRF-Token"] = csrf
    return headers


def _quote_payload(text: str = "金句") -> dict:
    return {
        "type": "quote",
        "body": {"text": text},
        "sourceKind": "specialty",
        "sourceRef": "ref",
        "sourceDomain": "essay",
        "title": f"title-{text[:4]}",
        "tags": [],
    }


def _create_public_note(
    c: TestClient, *, text: str = "公开内容"
) -> int:
    created = c.post(
        "/api/v2/notebook/notes",
        json=_quote_payload(text=text),
        headers=_csrf(c),
    ).json()
    nid = created["id"]
    c.patch(
        f"/api/v2/notebook/notes/{nid}/public-toggle",
        json={"isPublic": True, "displayAnonymous": True},
        headers=_csrf(c),
    )
    return nid


# ─── User: create report ────────────────────────────────────────────────────


def test_create_report_on_note(client) -> None:
    c, _ = client
    _register(c)
    nid = _create_public_note(c)
    resp = c.post(
        "/api/v2/notebook/reports",
        json={"targetType": "note", "targetId": nid, "reason": "spam"},
        headers=_csrf(c),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["targetType"] == "note"
    assert body["targetId"] == nid
    assert body["status"] == "pending"
    assert body["reason"] == "spam"


def test_create_report_on_comment(client) -> None:
    c, _ = client
    _register(c)
    nid = _create_public_note(c)
    cmt = c.post(
        f"/api/v2/notebook/notes/{nid}/comments",
        json={"content": "ugly comment"},
        headers=_csrf(c),
    ).json()
    resp = c.post(
        "/api/v2/notebook/reports",
        json={
            "targetType": "comment",
            "targetId": cmt["id"],
            "reason": "abuse",
        },
        headers=_csrf(c),
    )
    assert resp.status_code == 201
    assert resp.json()["targetType"] == "comment"


def test_create_report_on_nonexistent_note_returns_404(client) -> None:
    c, _ = client
    _register(c)
    resp = c.post(
        "/api/v2/notebook/reports",
        json={"targetType": "note", "targetId": 999999, "reason": "x"},
        headers=_csrf(c),
    )
    assert resp.status_code == 404


def test_create_report_unauthenticated_returns_401(client) -> None:
    c, _ = client
    _register(c)
    nid = _create_public_note(c)
    c.cookies.clear()
    resp = c.post(
        "/api/v2/notebook/reports",
        json={"targetType": "note", "targetId": nid, "reason": "x"},
    )
    assert resp.status_code == 401


# ─── Admin: list pending ────────────────────────────────────────────────────


def test_admin_list_returns_pending_fifo(client) -> None:
    c, _ = client
    _register(c)
    nid = _create_public_note(c)
    for reason in ("first", "second"):
        c.post(
            "/api/v2/notebook/reports",
            json={"targetType": "note", "targetId": nid, "reason": reason},
            headers=_csrf(c),
        )
    resp = c.get(
        "/api/v2/admin/note-reports", headers=_admin_auth_headers(c)
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 2
    assert body["pendingCount"] == 2
    assert [i["reason"] for i in body["items"]] == ["first", "second"]


def test_admin_list_includes_target_preview_note(client) -> None:
    c, _ = client
    _register(c)
    nid = _create_public_note(c, text="预览内容这段话")
    c.post(
        "/api/v2/notebook/reports",
        json={"targetType": "note", "targetId": nid, "reason": "spam"},
        headers=_csrf(c),
    )
    resp = c.get(
        "/api/v2/admin/note-reports", headers=_admin_auth_headers(c)
    )
    item = resp.json()["items"][0]
    assert "title" in item["targetPreview"]
    assert "bodyText" in item["targetPreview"]
    assert item["targetPreview"]["bodyText"] == "预览内容这段话"


def test_admin_list_includes_target_preview_comment(client) -> None:
    c, _ = client
    _register(c)
    nid = _create_public_note(c)
    cmt = c.post(
        f"/api/v2/notebook/notes/{nid}/comments",
        json={"content": "评论文本"},
        headers=_csrf(c),
    ).json()
    c.post(
        "/api/v2/notebook/reports",
        json={
            "targetType": "comment",
            "targetId": cmt["id"],
            "reason": "abuse",
        },
        headers=_csrf(c),
    )
    resp = c.get(
        "/api/v2/admin/note-reports", headers=_admin_auth_headers(c)
    )
    item = resp.json()["items"][0]
    assert item["targetPreview"]["noteId"] == nid
    assert item["targetPreview"]["content"] == "评论文本"


def test_admin_list_unauthenticated_returns_401(client) -> None:
    c, _ = client
    resp = c.get("/api/v2/admin/note-reports")
    assert resp.status_code == 401


# ─── Admin: dismiss ─────────────────────────────────────────────────────────


def test_admin_dismiss_keeps_target(client, tmp_path) -> None:
    c, _ = client
    _register(c)
    nid = _create_public_note(c)
    c.post(
        "/api/v2/notebook/reports",
        json={"targetType": "note", "targetId": nid, "reason": "spam"},
        headers=_csrf(c),
    )
    listed = c.get(
        "/api/v2/admin/note-reports", headers=_admin_auth_headers(c)
    ).json()
    report_id = listed["items"][0]["id"]
    resp = c.post(
        f"/api/v2/admin/note-reports/{report_id}/dismiss",
        headers=_admin_auth_headers(c),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "dismissed"
    # target 仍在
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
        assert session.get(Note, nid) is not None


# ─── Admin: approve-delete ──────────────────────────────────────────────────


def test_admin_approve_delete_note_cascades(client, tmp_path) -> None:
    c, _ = client
    _register(c)
    nid = _create_public_note(c)
    # 加 1 comment + 1 report 模拟 cascade
    cmt = c.post(
        f"/api/v2/notebook/notes/{nid}/comments",
        json={"content": "c"},
        headers=_csrf(c),
    ).json()
    c.post(
        "/api/v2/notebook/reports",
        json={"targetType": "note", "targetId": nid, "reason": "spam"},
        headers=_csrf(c),
    )
    listed = c.get(
        "/api/v2/admin/note-reports", headers=_admin_auth_headers(c)
    ).json()
    report_id = listed["items"][0]["id"]
    resp = c.post(
        f"/api/v2/admin/note-reports/{report_id}/approve-delete",
        headers=_admin_auth_headers(c),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "reviewed"
    # note + comment 应都被删
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
        assert session.get(Note, nid) is None
        assert session.get(NoteComment, cmt["id"]) is None


def test_admin_approve_delete_comment_decrements_count(client, tmp_path) -> None:
    c, _ = client
    _register(c)
    nid = _create_public_note(c)
    cmt = c.post(
        f"/api/v2/notebook/notes/{nid}/comments",
        json={"content": "x"},
        headers=_csrf(c),
    ).json()
    c.post(
        "/api/v2/notebook/reports",
        json={
            "targetType": "comment",
            "targetId": cmt["id"],
            "reason": "abuse",
        },
        headers=_csrf(c),
    )
    listed = c.get(
        "/api/v2/admin/note-reports", headers=_admin_auth_headers(c)
    ).json()
    report_id = listed["items"][0]["id"]
    c.post(
        f"/api/v2/admin/note-reports/{report_id}/approve-delete",
        headers=_admin_auth_headers(c),
    )
    # comment 被删, note.comments_count 减回 0
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
        n = session.get(Note, nid)
        assert n is not None
        assert n.comments_count == 0
        assert session.get(NoteComment, cmt["id"]) is None


def test_admin_review_already_reviewed_returns_422(client) -> None:
    c, _ = client
    _register(c)
    nid = _create_public_note(c)
    c.post(
        "/api/v2/notebook/reports",
        json={"targetType": "note", "targetId": nid, "reason": "x"},
        headers=_csrf(c),
    )
    listed = c.get(
        "/api/v2/admin/note-reports", headers=_admin_auth_headers(c)
    ).json()
    rid = listed["items"][0]["id"]
    c.post(
        f"/api/v2/admin/note-reports/{rid}/dismiss",
        headers=_admin_auth_headers(c),
    )
    # 再 dismiss 一次 → 422
    resp = c.post(
        f"/api/v2/admin/note-reports/{rid}/dismiss",
        headers=_admin_auth_headers(c),
    )
    assert resp.status_code == 422


def test_admin_review_nonexistent_report_returns_404(client) -> None:
    c, _ = client
    resp = c.post(
        "/api/v2/admin/note-reports/999999/dismiss",
        headers=_admin_auth_headers(c),
    )
    assert resp.status_code == 404


def test_admin_endpoints_basic_auth_required(client) -> None:
    """No Authorization header → 401."""
    c, _ = client
    resp1 = c.post("/api/v2/admin/note-reports/1/dismiss")
    resp2 = c.post("/api/v2/admin/note-reports/1/approve-delete")
    assert resp1.status_code == 401
    assert resp2.status_code == 401


# ─── Persist NoteReport row check ───────────────────────────────────────────


def test_create_report_persists_row(client, tmp_path) -> None:
    c, _ = client
    _register(c)
    nid = _create_public_note(c)
    c.post(
        "/api/v2/notebook/reports",
        json={"targetType": "note", "targetId": nid, "reason": "persist-check"},
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
        from sqlalchemy import select

        rows = list(session.scalars(select(NoteReport)).all())
        assert len(rows) == 1
        assert rows[0].reason == "persist-check"
        assert rows[0].status == "pending"
