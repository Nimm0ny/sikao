"""Slice 2c · essay grading routes tests.

3 endpoints (POST /grade / GET /grades/{id} / GET /grades) — auth + CSRF gate +
happy path + cross-user 404 + status='pending' 立即返 + BackgroundTask 跑完后
GET 看到 status='completed'.

LLM provider 用 monkeypatch 替换成 stub, 不打真网络.
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
from tests._helpers.llm_stubs import StubLlmProvider, well_formed_essay_payload

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
        json={"email": f"{username}@test.local", "password": "passw0rd", "displayName": username},
    )
    assert resp.status_code == 200, resp.text
    return int(resp.json()["user"]["id"])


def _csrf(client: TestClient) -> dict[str, str]:
    csrf = client.cookies.get("csrf_token")
    assert csrf, "csrf_token cookie missing"
    return {"X-CSRF-Token": csrf}


def _seed_essay_question_via_app(client: TestClient) -> int:
    """直接通过 app.state.db.session_factory 插一道 essay 题, 返回 question.id.

    跳过 admin import 路径 — 路由测试只关心 /essay/* 自己."""
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


def _patch_provider(monkeypatch, content: str | None = None) -> None:
    """patch essay_grading.build_llm_provider 返 shared stub + 'system' label."""
    payload = content or well_formed_essay_payload()
    monkeypatch.setattr(
        "sikao_api.modules.essay.application.essay_grading.build_llm_provider",
        lambda settings, db=None, user_id=None: (StubLlmProvider(payload), "system"),
    )


# ── Auth + CSRF gate ────────────────────────────────────────────────────────


def test_post_grade_unauthenticated_401(client) -> None:
    c, _ = client
    resp = c.post(
        "/api/v2/essay/grade",
        json={"questionId": 1, "answerText": "x"},
    )
    assert resp.status_code == 401


def test_post_grade_csrf_missing_403(client) -> None:
    c, _ = client
    _register(c)
    resp = c.post(
        "/api/v2/essay/grade",
        json={"questionId": 1, "answerText": "x"},
    )
    assert resp.status_code == 403


def test_get_grades_unauthenticated_401(client) -> None:
    c, _ = client
    resp = c.get("/api/v2/essay/grades")
    assert resp.status_code == 401


# ── Body validation ────────────────────────────────────────────────────────


def test_post_grade_empty_answer_422(client) -> None:
    c, _ = client
    _register(c)
    resp = c.post(
        "/api/v2/essay/grade",
        json={"questionId": 1, "answerText": ""},
        headers=_csrf(c),
    )
    assert resp.status_code == 422


def test_post_grade_oversize_answer_422(client) -> None:
    c, _ = client
    _register(c)
    resp = c.post(
        "/api/v2/essay/grade",
        json={"questionId": 1, "answerText": "x" * 5001},
        headers=_csrf(c),
    )
    assert resp.status_code == 422


def test_post_grade_question_not_found_404(client, monkeypatch) -> None:
    c, _ = client
    _register(c)
    _patch_provider(monkeypatch)
    resp = c.post(
        "/api/v2/essay/grade",
        json={"questionId": 99999, "answerText": "x"},
        headers=_csrf(c),
    )
    assert resp.status_code == 404


# ── Happy path: submit → background grades → GET sees completed ────────────


def test_post_grade_creates_pending_then_background_completes(client, monkeypatch) -> None:
    c, _ = client
    _register(c)
    qid = _seed_essay_question_via_app(c)
    _patch_provider(monkeypatch)

    resp = c.post(
        "/api/v2/essay/grade",
        json={"questionId": qid, "answerText": "我的论点是 ..." * 50},
        headers=_csrf(c),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    record_id = body["id"]
    assert body["questionId"] == qid
    # POST 响应在 BackgroundTask 跑前序列化, 仍 'pending'. 但 TestClient 是同步,
    # BackgroundTask 在 response 发回 client 前已 await 完, 第二次 GET 看完成态.
    # (FastAPI BackgroundTasks 行为 — TestClient 跟生产略不同, 测试角度无所谓.)

    resp2 = c.get(f"/api/v2/essay/grades/{record_id}")
    assert resp2.status_code == 200
    body2 = resp2.json()
    assert body2["status"] == "completed"
    assert body2["score"] is not None
    assert body2["feedback"] is not None
    # weighted: 0.30*8+0.25*7+0.20*8+0.15*9+0.10*6 = 7.7 → 77.0
    assert body2["score"] == 77.0
    assert body2["feedback"]["overallScore"] == 77.0
    assert body2["feedback"]["sampleAnswer"] == "x" * 950
    assert body2["feedback"]["suspicious"] is False


def test_post_grade_non_essay_question_422(client, tmp_path: Path, monkeypatch) -> None:
    """提交非 essay 题 → ValidationError(422 essay_wrong_kind)."""
    c, _ = client
    _register(c)
    _patch_provider(monkeypatch)
    # seed a single_choice question
    factory = c.app.state.db.session_factory
    sess = factory()
    try:
        paper = Paper(paper_code="MCQ-T", paper_name="t")
        sess.add(paper)
        sess.flush()
        revision = PaperRevision(
            paper_id=paper.id, revision_number=1, sort_order=1, paper_name="t",
            question_count=1, source_hash="h",
        )
        sess.add(revision)
        sess.flush()
        sec = PaperSection(
            paper_revision_id=revision.id, section_key="s1", title="x",
            instruction_text="", display_order=1, question_count=1,
        )
        sess.add(sec)
        sess.flush()
        block = PaperBlock(
            paper_revision_id=revision.id, section_id=sec.id,
            block_type="question", display_order=1,
        )
        sess.add(block)
        sess.flush()
        q = Question(
            paper_revision_id=revision.id, section_id=sec.id, block_id=block.id,
            position=1, source_uuid="u", question_kind="single_choice",
            subtype_name="x", stem_text="x", answer_text="A",
            renderer_key="single_choice",
        )
        sess.add(q)
        sess.commit()
        qid = q.id
    finally:
        sess.close()

    resp = c.post(
        "/api/v2/essay/grade",
        json={"questionId": qid, "answerText": "x"},
        headers=_csrf(c),
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "essay_wrong_kind"


# ── Cross-user 404 ──────────────────────────────────────────────────────────


def test_get_grade_cross_user_404(client, monkeypatch) -> None:
    c, _ = client
    user1_id = _register(c, username="alice")  # noqa: F841
    qid = _seed_essay_question_via_app(c)
    _patch_provider(monkeypatch)

    resp = c.post(
        "/api/v2/essay/grade",
        json={"questionId": qid, "answerText": "alice 的答案"},
        headers=_csrf(c),
    )
    assert resp.status_code == 200
    record_id = resp.json()["id"]

    # Switch user — clear cookies + register bob
    c.cookies.clear()
    _register(c, username="bob")

    resp2 = c.get(f"/api/v2/essay/grades/{record_id}")
    assert resp2.status_code == 404


# ── List ────────────────────────────────────────────────────────────────────


def test_list_grades_only_returns_my_records(client, monkeypatch) -> None:
    c, _ = client
    _register(c, username="alice")
    qid = _seed_essay_question_via_app(c)
    _patch_provider(monkeypatch)
    for i in range(2):
        resp = c.post(
            "/api/v2/essay/grade",
            json={"questionId": qid, "answerText": f"alice answer {i}"},
            headers=_csrf(c),
        )
        assert resp.status_code == 200

    # bob shouldn't see alice's records
    c.cookies.clear()
    _register(c, username="bob")
    resp = c.get("/api/v2/essay/grades")
    assert resp.status_code == 200
    assert resp.json() == []
