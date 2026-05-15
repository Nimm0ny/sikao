"""PR13 P5 · essay draft routes tests.

2 endpoints (POST /drafts upsert / GET /drafts/{question_id} get) — auth + CSRF
+ happy path + upsert in-place + cross-user 404 防 leak + max_length 422 +
metadata roundtrip + cascade delete.

跟 test_essay_grading_routes.py 同 fixture 风格 (SQLite tmp_path TestClient).
不打 LLM (drafts 不触发 LLM, 跟 grading 区分).
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from sikao_api.core.config import Settings
from sikao_api.db.models import (
    Paper,
    PaperBlock,
    PaperRevision,
    PaperSection,
    Question,
)
from sikao_api.main import create_app
from sikao_api.modules.auth.application.security import hash_password

# ── Fixtures ─────────────────────────────────────────────────────────────────


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
        yield c, s


def _register(client: TestClient, *, username: str = "user1") -> int:
    resp = client.post(
        "/api/v2/auth/register/email",
        json={
            "email": f"{username}@test.local",
            "password": "passw0rd",
            "displayName": username,
        },
    )
    assert resp.status_code == 200, resp.text
    return int(resp.json()["user"]["id"])


def _csrf(client: TestClient) -> dict[str, str]:
    csrf = client.cookies.get("csrf_token")
    assert csrf, "csrf_token cookie missing"
    return {"X-CSRF-Token": csrf}


def _seed_essay_question_via_app(client: TestClient) -> int:
    """直接通过 app.state.db.session_factory 插一道 essay 题, 返回 question.id."""
    factory = client.app.state.db.session_factory
    sess = factory()
    try:
        paper = Paper(paper_code="ESSAY-T", paper_name="t")
        sess.add(paper)
        sess.flush()
        revision = PaperRevision(
            paper_id=paper.id,
            revision_number=1,
            sort_order=1,
            paper_name="t",
            question_count=1,
            source_hash="h",
        )
        sess.add(revision)
        sess.flush()
        sec = PaperSection(
            paper_revision_id=revision.id,
            section_key="s1",
            title="申论",
            instruction_text="",
            display_order=1,
            question_count=1,
        )
        sess.add(sec)
        sess.flush()
        block = PaperBlock(
            paper_revision_id=revision.id,
            section_id=sec.id,
            block_type="question",
            display_order=1,
        )
        sess.add(block)
        sess.flush()
        q = Question(
            paper_revision_id=revision.id,
            section_id=sec.id,
            block_id=block.id,
            position=1,
            source_uuid="essay-q1",
            question_kind="essay",
            subtype_name="申论",
            stem_text="<p>题干</p>",
            answer_text="",
            renderer_key="essay",
            is_gradable=False,
            type_payload_json={
                "materialTexts": ["材料一", "材料二"],
                "wordLimitMin": 800,
                "wordLimitMax": 1000,
                "fullScore": 40,
            },
        )
        sess.add(q)
        sess.flush()
        sess.commit()
        return q.id
    finally:
        sess.close()


# ── Auth + CSRF gate ────────────────────────────────────────────────────────


def test_save_draft_unauthenticated_401(client) -> None:
    c, _ = client
    resp = c.post(
        "/api/v2/essay/drafts",
        json={"questionId": 1, "typedDraft": "x"},
    )
    assert resp.status_code == 401


def test_save_draft_no_csrf_403(client) -> None:
    c, _ = client
    _register(c)
    resp = c.post(
        "/api/v2/essay/drafts",
        json={"questionId": 1, "typedDraft": "x"},
    )
    assert resp.status_code == 403


# ── Happy path: create + update upsert ──────────────────────────────────────


def test_save_draft_creates_new(client) -> None:
    c, _ = client
    _register(c)
    qid = _seed_essay_question_via_app(c)
    resp = c.post(
        "/api/v2/essay/drafts",
        json={"questionId": qid, "typedDraft": "第一稿"},
        headers=_csrf(c),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["questionId"] == qid
    assert body["typedDraft"] == "第一稿"
    assert body["handwrittenDraftMetadata"] is None
    assert body["id"] >= 1


def test_save_draft_updates_existing(client) -> None:
    """同 (user, question) 再 POST → 同 record id, typed_draft 替换, updated_at 推进."""
    c, _ = client
    _register(c)
    qid = _seed_essay_question_via_app(c)

    resp1 = c.post(
        "/api/v2/essay/drafts",
        json={"questionId": qid, "typedDraft": "稿 v1"},
        headers=_csrf(c),
    )
    assert resp1.status_code == 200
    body1 = resp1.json()
    record_id_v1 = body1["id"]
    updated_at_v1 = body1["updatedAt"]

    resp2 = c.post(
        "/api/v2/essay/drafts",
        json={"questionId": qid, "typedDraft": "稿 v2 修改"},
        headers=_csrf(c),
    )
    assert resp2.status_code == 200
    body2 = resp2.json()
    # 同 record (upsert), 不是新建.
    assert body2["id"] == record_id_v1
    assert body2["typedDraft"] == "稿 v2 修改"
    # updated_at 不应早于 v1 — SQLite datetime 秒级精度可能相等, 用 >= 兜底.
    assert body2["updatedAt"] >= updated_at_v1
    # saved_at = 首次创建时间, 不变.
    assert body2["savedAt"] == body1["savedAt"]


def test_save_draft_preserves_existing_handwritten_metadata_when_payload_omits_it(client) -> None:
    c, _ = client
    _register(c)
    qid = _seed_essay_question_via_app(c)

    resp1 = c.post(
        "/api/v2/essay/drafts",
        json={
            "questionId": qid,
            "typedDraft": "手写稿 v1",
            "handwrittenDraftMetadata": {"assetId": 42, "strokeCount": 8},
        },
        headers=_csrf(c),
    )
    assert resp1.status_code == 200

    resp2 = c.post(
        "/api/v2/essay/drafts",
        json={"questionId": qid, "typedDraft": "只更新 typedDraft"},
        headers=_csrf(c),
    )
    assert resp2.status_code == 200
    body2 = resp2.json()
    assert body2["typedDraft"] == "只更新 typedDraft"
    assert body2["handwrittenDraftMetadata"] == {
        "assetId": 42,
        "strokeCount": 8,
    }


# ── Body validation ─────────────────────────────────────────────────────────


def test_save_draft_typed_max_5000(client) -> None:
    c, _ = client
    _register(c)
    resp = c.post(
        "/api/v2/essay/drafts",
        json={"questionId": 1, "typedDraft": "x" * 5001},
        headers=_csrf(c),
    )
    assert resp.status_code == 422


def test_save_draft_handwritten_metadata_json(client) -> None:
    """handwritten_draft_metadata 任意 dict 落库 → GET 拿回 byte-for-byte 一致."""
    c, _ = client
    _register(c)
    qid = _seed_essay_question_via_app(c)
    metadata = {
        "path": "/uploads/handwritten/abc.png",
        "mimeType": "image/png",
        "assetId": 42,
        "strokeCount": 128,
    }
    resp = c.post(
        "/api/v2/essay/drafts",
        json={
            "questionId": qid,
            "typedDraft": "",
            "handwrittenDraftMetadata": metadata,
        },
        headers=_csrf(c),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["handwrittenDraftMetadata"] == metadata

    resp2 = c.get(f"/api/v2/essay/drafts/{qid}")
    assert resp2.status_code == 200
    assert resp2.json()["handwrittenDraftMetadata"] == metadata


# ── GET cross-user 404 + not-found 404 ─────────────────────────────────────


def test_get_draft_not_found_404(client) -> None:
    c, _ = client
    _register(c)
    resp = c.get("/api/v2/essay/drafts/99999")
    assert resp.status_code == 404


def test_get_draft_my_only_cross_user_404(client) -> None:
    """user A 草稿 → user B GET 同 question_id 拿不到 → 404 (不返 403, 防 leak)."""
    c, _ = client
    _register(c, username="alice")
    qid = _seed_essay_question_via_app(c)
    resp = c.post(
        "/api/v2/essay/drafts",
        json={"questionId": qid, "typedDraft": "alice 的草稿"},
        headers=_csrf(c),
    )
    assert resp.status_code == 200

    # Switch to bob
    c.cookies.clear()
    _register(c, username="bob")
    resp2 = c.get(f"/api/v2/essay/drafts/{qid}")
    # cross-user 拿不到 alice 的 draft — service 层 user_id 过滤 → None → 404.
    assert resp2.status_code == 404


# ── 非 essay 题 422 ─────────────────────────────────────────────────────────


def test_save_draft_non_essay_question_422(client) -> None:
    """提交非 essay 题 → ValidationError(422 essay_wrong_kind)."""
    c, _ = client
    _register(c)
    # seed a single_choice question
    factory = c.app.state.db.session_factory
    sess = factory()
    try:
        paper = Paper(paper_code="MCQ-T", paper_name="t")
        sess.add(paper)
        sess.flush()
        revision = PaperRevision(
            paper_id=paper.id,
            revision_number=1,
            sort_order=1,
            paper_name="t",
            question_count=1,
            source_hash="h",
        )
        sess.add(revision)
        sess.flush()
        sec = PaperSection(
            paper_revision_id=revision.id,
            section_key="s1",
            title="x",
            instruction_text="",
            display_order=1,
            question_count=1,
        )
        sess.add(sec)
        sess.flush()
        block = PaperBlock(
            paper_revision_id=revision.id,
            section_id=sec.id,
            block_type="question",
            display_order=1,
        )
        sess.add(block)
        sess.flush()
        q = Question(
            paper_revision_id=revision.id,
            section_id=sec.id,
            block_id=block.id,
            position=1,
            source_uuid="u",
            question_kind="single_choice",
            subtype_name="x",
            stem_text="x",
            answer_text="A",
            renderer_key="single_choice",
        )
        sess.add(q)
        sess.commit()
        qid = q.id
    finally:
        sess.close()

    resp = c.post(
        "/api/v2/essay/drafts",
        json={"questionId": qid, "typedDraft": "x"},
        headers=_csrf(c),
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "essay_wrong_kind"


def test_save_draft_question_not_found_404(client) -> None:
    c, _ = client
    _register(c)
    resp = c.post(
        "/api/v2/essay/drafts",
        json={"questionId": 99999, "typedDraft": "x"},
        headers=_csrf(c),
    )
    assert resp.status_code == 404


# ── Cascade: question delete → draft cascade delete ─────────────────────────


def test_save_draft_question_cascade_delete(client) -> None:
    """删 question (含 paper revision tree) → draft 也删掉 (FK ondelete CASCADE).

    用 PaperRevision -> Question CASCADE 链触发: 删 paper revision 带走
    questions, draft FK 设 CASCADE 也带走.
    """
    c, _ = client
    _register(c)
    qid = _seed_essay_question_via_app(c)
    resp = c.post(
        "/api/v2/essay/drafts",
        json={"questionId": qid, "typedDraft": "测 cascade"},
        headers=_csrf(c),
    )
    assert resp.status_code == 200
    record_id = resp.json()["id"]

    # 删 paper revision 链 → questions cascade → drafts cascade.
    factory = c.app.state.db.session_factory
    sess = factory()
    try:
        # SQLite 需 PRAGMA foreign_keys=ON. create_app(initialize_schema=True)
        # 已 setup; 但显式 emit 兜底确保 cascade 生效.
        from sqlalchemy import text

        sess.execute(text("PRAGMA foreign_keys = ON"))
        q = sess.get(Question, qid)
        assert q is not None
        sess.delete(q)
        sess.commit()
    finally:
        sess.close()

    # draft record 应 cascade 删
    from sikao_api.db.models import EssayDraftRecord

    sess2 = factory()
    try:
        gone = sess2.get(EssayDraftRecord, record_id)
        assert gone is None, "draft should cascade delete with question"
    finally:
        sess2.close()
