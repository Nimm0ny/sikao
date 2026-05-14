"""Phase 3.7 + 3.8 fenbi-merge — GET/PUT/DELETE /api/v2/notes/{qid} tests.

覆盖:
  - 401 未登录 (3 个 endpoint 都需 auth)
  - GET 没笔记 → has_note=False, content="", updated_at=None
  - PUT 插入新 → has_note=True, content 回显, updated_at 时间戳
  - PUT 同 qid 二次 → upsert (update, 不重复 row), content 替换
  - PUT 内容超 16KB → 422
  - DELETE 没 row → 204 (idempotent), 之后 GET 仍 has_note=False
  - DELETE 有 row → 204, GET 回退 has_note=False
  - 不同 user 同一 qid 互不干扰 (隔离)
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from sikao_api.core.config import Settings
from sikao_api.db.models import (
    Paper,
    PaperBlock,
    PaperRevision,
    PaperSection,
    Question,
    QuestionOption,
)
from sikao_api.main import create_app
from sikao_api.modules.auth.application.security import hash_password


def _seed_question(database_url: str, question_id: int = 42) -> int:
    """Seed minimal paper + section + block + question so FK constraint passes."""
    engine = create_engine(database_url, future=True)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)
    db = Session()
    try:
        paper = Paper(paper_code="NOTE-TEST", paper_name="测试套卷")
        db.add(paper)
        db.flush()
        revision = PaperRevision(
            paper_id=paper.id,
            revision_number=1,
            sort_order=1,
            paper_name=paper.paper_name,
            question_count=1,
            exam_year=2024,
            source_hash="hash_note",
            is_published=True,
        )
        db.add(revision)
        db.flush()
        paper.current_revision_id = revision.id
        section = PaperSection(
            paper_revision_id=revision.id,
            section_key="NOTE-TEST_S1",
            title="S1",
            instruction_text="",
            display_order=1,
            question_count=1,
        )
        db.add(section)
        db.flush()
        block = PaperBlock(
            paper_revision_id=revision.id,
            section_id=section.id,
            block_type="question",
            display_order=1,
        )
        db.add(block)
        db.flush()
        q = Question(
            id=question_id,
            paper_revision_id=revision.id,
            section_id=section.id,
            block_id=block.id,
            position=1,
            source_uuid="q_note_test",
            question_kind="single_choice",
            subtype_name="X",
            stem_text="q",
            answer_text="A",
            renderer_key="single_choice",
            exam_year=2024,
            is_gradable=True,
            enabled=True,
        )
        db.add(q)
        db.flush()
        db.add(
            QuestionOption(question_id=q.id, option_key="A", option_text="A", display_order=0)
        )
        db.commit()
        return int(q.id)
    finally:
        db.close()


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
    with TestClient(app) as client:
        yield client, settings


@pytest.fixture
def client(tmp_path: Path) -> Iterator[tuple[TestClient, Settings]]:
    with _build_client(tmp_path) as (c, s):
        # 所有 PUT/DELETE 测试都会用 question_id=42, 提前 seed 一次满足 FK
        _seed_question(s.database_url, question_id=42)
        yield c, s


def _register(c: TestClient, name: str = "alice") -> None:
    resp = c.post(
        "/api/v2/auth/register/email",
        json={"email": f"{name}@test.local", "password": "passw0rd", "displayName": name},
    )
    assert resp.status_code == 200, resp.text


def test_notes_anonymous_returns_401(client) -> None:
    c, _ = client
    assert c.get("/api/v2/notes/1").status_code == 401
    assert c.put("/api/v2/notes/1", json={"content": "hi"}).status_code == 401
    assert c.delete("/api/v2/notes/1").status_code == 401


def test_notes_get_unset_returns_has_note_false(client) -> None:
    c, _ = client
    _register(c)
    resp = c.get("/api/v2/notes/42")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["hasNote"] is False
    assert body["content"] == ""
    assert body["updatedAt"] is None


def test_notes_put_inserts_and_get_returns(client) -> None:
    c, _ = client
    _register(c)
    put = c.put(
        "/api/v2/notes/42",
        json={"content": "## 行程问题\n相遇追及综合 — 关键是 [[#018]]"},
    )
    assert put.status_code == 200, put.text
    body = put.json()
    assert body["hasNote"] is True
    assert "[[#018]]" in body["content"]
    assert body["updatedAt"] is not None

    get = c.get("/api/v2/notes/42")
    assert get.json()["content"] == body["content"]


def test_notes_put_twice_upserts_no_duplicate(client) -> None:
    c, _ = client
    _register(c)
    c.put("/api/v2/notes/42", json={"content": "first"})
    second = c.put("/api/v2/notes/42", json={"content": "second"})
    assert second.json()["content"] == "second"
    # 兜底: 若意外建了重复 row, GET 取的可能是任一 — 强校验内容必须是 second
    assert c.get("/api/v2/notes/42").json()["content"] == "second"


def test_notes_put_oversize_content_422(client) -> None:
    c, _ = client
    _register(c)
    huge = "x" * 16385  # 超 16KB 上限 1 字节
    assert c.put("/api/v2/notes/42", json={"content": huge}).status_code == 422


def test_notes_delete_idempotent_when_no_row(client) -> None:
    c, _ = client
    _register(c)
    assert c.delete("/api/v2/notes/42").status_code == 204
    assert c.get("/api/v2/notes/42").json()["hasNote"] is False


def test_notes_delete_then_get_returns_has_note_false(client) -> None:
    c, _ = client
    _register(c)
    c.put("/api/v2/notes/42", json={"content": "to be deleted"})
    assert c.delete("/api/v2/notes/42").status_code == 204
    assert c.get("/api/v2/notes/42").json()["hasNote"] is False


def test_notes_isolated_between_users(client) -> None:
    c, _ = client
    _register(c, name="alice")
    c.put("/api/v2/notes/42", json={"content": "alice note"})
    # 切到 bob — 重新登录会清 token
    c.post("/api/v2/auth/logout")
    _register(c, name="bob")
    bob_get = c.get("/api/v2/notes/42")
    assert bob_get.json()["hasNote"] is False
    c.put("/api/v2/notes/42", json={"content": "bob note"})
    assert c.get("/api/v2/notes/42").json()["content"] == "bob note"
    # 切回 alice 验证 alice 笔记还在
    c.post("/api/v2/auth/logout")
    alice_login = c.post(
        "/api/v2/auth/login",
        json={"identifier": "alice@test.local", "password": "passw0rd"},
    )
    assert alice_login.status_code == 200
    assert c.get("/api/v2/notes/42").json()["content"] == "alice note"
