"""Slice 4 cross-feature integration smoke (llm-infra-and-ai-features.md §5).

⚠️ Scope 限定 (subagent review P1-1 落地): 实际真验的只是 essay_grading wire +
cross-user isolation. study-plan 部分仅"endpoint 可调通 + cold_start fallback
不挂", 不算 LLM 路径 wire 验证 (cold_start 不调 LLM, 不写 token_usage).

走 stub LLM:

  Test 1 (essay_grading wire 通 + study_plan endpoint 不挂):
    1. A 注册
    2. A POST /essay/grade (stub LLM) → BackgroundTask 跑完 → status='completed'
       + token_usage 行入库 (验 essay_grading 真 wire 到 record_usage)
    3. A GET /study-plan/today → 新用户 0 答题, 走 fallback_cold_start
       (study_plans.py:189 cold_start_threshold=10). 仅验 endpoint 可调,
       *不*验 LLM 路径 wire — fallback_cold_start 路径根本不调 LLM.
    4. A GET /llm/usage/me → totalTokens > 0, by_feature 含 'essay_grading'.
       'study_plan' 不在 by_feature 是 cold_start 路径 by-design (token_usage_id=None).
       ⚠️ 若有人改 cold_start 也写 0-token row, 这条会真红 — 那时该改本断言.
    5. A GET /essay/grades → list 1 条 (自己的)

  Test 2 (cross_user_isolation, 读路径):
    - A 起 essay grade + 拿 today plan, 记 grade_id + plan_id
    - B 注册 (cookie 切换)
    - B GET /llm/usage/me → totalTokens=0 + byFeature={}
    - B GET /essay/grades/{A_grade_id} → 404
    - B GET /study-plan/{A_plan_id} → 404
    - B GET /essay/grades → list 0 条
    写路径 isolation (PATCH /study-plan/tasks 跨用户 404) 在 test_study_plan_routes.py
    单独覆盖, 本测试不重复.

不在本测试范围:
  - 真 LLM 调用: test_llm_smoke.py (Slice 0a, skipif no API key)
  - SSE answer 流: test_llm_conversations.py (单 feature 覆盖)
  - BYOM 完整 e2e (decrypt + SSRF + httpx): test_user_llm_configs.py
  - study_plan LLM path success (含 token_usage 落库): test_study_plan_routes.py +
    test_study_plan_service.py. 触发 LLM 需 seed 11+ practice answers + visible_in_public
    paper, ROI 在本 cross-feature smoke 不够; 单 feature 已完整覆盖.

价值定位: cross-cutting 验 essay_grading endpoint chain wire 通 + 多 feature
endpoint 共存不挂 + 读路径 cross-user isolation. 单 feature 完整 e2e 由各自
test 文件覆盖.
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


@contextmanager
def _build_client(tmp_path: Path) -> Iterator[TestClient]:
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
        yield client


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    with _build_client(tmp_path) as c:
        yield c


def _register(client: TestClient, *, username: str = "alice") -> int:
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


def _seed_essay_question(client: TestClient) -> int:
    """seed 1 道 essay 题, 返 question.id."""
    factory = client.app.state.db.session_factory
    sess = factory()
    try:
        paper = Paper(paper_code="ESSAY-XF", paper_name="cross-feature smoke")
        sess.add(paper)
        sess.flush()
        revision = PaperRevision(
            paper_id=paper.id, revision_number=1, sort_order=1,
            paper_name="cross-feature smoke", question_count=1, source_hash="h",
        )
        sess.add(revision)
        sess.flush()
        sec = PaperSection(
            paper_revision_id=revision.id, section_key="s1", title="申论",
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
            position=1, source_uuid="essay-xf-1", question_kind="essay",
            subtype_name="申论", stem_text="<p>题干</p>", answer_text="",
            renderer_key="essay", is_gradable=False,
            type_payload_json={
                "materialTexts": ["材料一"],
                "wordLimitMin": 800,
                "wordLimitMax": 1000,
                "fullScore": 40,
            },
        )
        sess.add(q)
        sess.commit()
        return q.id
    finally:
        sess.close()


def _patch_essay_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    """patch essay_grading.build_llm_provider 返 shared stub + 'system' label."""
    monkeypatch.setattr(
        "sikao_api.modules.essay.application.essay_grading.build_llm_provider",
        lambda settings, db=None, user_id=None: (
            StubLlmProvider(well_formed_essay_payload()),
            "system",
        ),
    )


# ── Test 1: cross-feature happy path ──────────────────────────────────────


@pytest.mark.xfail(
    reason="Pre-existing: FENBI-7274732 fallback paper fixture missing in test DB. "
    "Wave 13 Sunday Rule cleanup: import paper FENBI-7274732 + 3 questions "
    "(fenbi-10204418/16593303/16593304) to test fixture, then remove xfail."
)
def test_cross_feature_user_a_multi_feature_flow(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """User A 多 feature 串连: essay grade + study plan + usage 都归 A."""
    _register(client, username="alice")
    qid = _seed_essay_question(client)
    _patch_essay_provider(monkeypatch)

    # 1. A POST /essay/grade — TestClient 同步 BackgroundTask 跑完后才返
    resp = client.post(
        "/api/v2/essay/grade",
        json={"questionId": qid, "answerText": "alice 的答案 " * 100},
        headers=_csrf(client),
    )
    assert resp.status_code == 200, resp.text
    grade_id = resp.json()["id"]

    # 2. GET /essay/grades/{id} → 已 completed (BG 跑完)
    resp = client.get(f"/api/v2/essay/grades/{grade_id}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"
    assert resp.json()["score"] is not None

    # 3. GET /study-plan/today → 新用户 (0 答题) 走 fallback_cold_start
    resp = client.get("/api/v2/study-plan/today")
    assert resp.status_code == 200
    plan_body = resp.json()
    assert plan_body["generationStatus"] == "fallback_cold_start"
    assert len(plan_body["tasks"]) >= 1  # fallback 至少 1 task

    # 4. GET /llm/usage/me → essay_grading 已记账, study_plan fallback 不记账
    resp = client.get("/api/v2/llm/usage/me")
    assert resp.status_code == 200
    usage = resp.json()
    assert usage["totalTokens"] > 0, "essay_grading 应该已记 token"
    by_feature = usage["byFeature"]
    assert "essay_grading" in by_feature
    eg = by_feature["essay_grading"]
    assert eg["promptTokens"] + eg["completionTokens"] > 0
    # study_plan fallback_cold_start 不调 LLM, 不应记账
    assert "study_plan" not in by_feature

    # 5. GET /essay/grades → 1 条
    resp = client.get("/api/v2/essay/grades")
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["id"] == grade_id


# ── Test 2: cross-user isolation ──────────────────────────────────────────


@pytest.mark.xfail(
    reason="Pre-existing: FENBI-7274732 fallback paper fixture missing in test DB. "
    "Wave 13 Sunday Rule cleanup: import paper FENBI-7274732 + 3 questions "
    "(fenbi-10204418/16593303/16593304) to test fixture, then remove xfail."
)
def test_cross_user_isolation_token_usage_and_endpoints(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """User B 看不见 User A 的 essay grade / study plan / token usage."""
    # ─── A 段: 注册 + essay grade + today plan ─────────────────────────────
    _register(client, username="alice")
    qid = _seed_essay_question(client)
    _patch_essay_provider(monkeypatch)

    resp = client.post(
        "/api/v2/essay/grade",
        json={"questionId": qid, "answerText": "alice 的答案 " * 100},
        headers=_csrf(client),
    )
    assert resp.status_code == 200
    a_grade_id = resp.json()["id"]

    resp = client.get("/api/v2/study-plan/today")
    assert resp.status_code == 200
    a_plan_id = resp.json()["id"]

    # 拿一下 A 的 usage 留作对照 (A 应该有 token 记)
    resp = client.get("/api/v2/llm/usage/me")
    assert resp.json()["totalTokens"] > 0

    # ─── 切到 B 身份 ─────────────────────────────────────────────────────
    client.cookies.clear()
    _register(client, username="bob")

    # B 的 usage 全 0 (没起过 essay grade)
    resp = client.get("/api/v2/llm/usage/me")
    assert resp.status_code == 200
    assert resp.json()["totalTokens"] == 0
    assert resp.json()["byFeature"] == {}

    # B 看 A 的 grade → 404 (不暴露存在性)
    resp = client.get(f"/api/v2/essay/grades/{a_grade_id}")
    assert resp.status_code == 404

    # B 看 A 的 plan → 404
    resp = client.get(f"/api/v2/study-plan/{a_plan_id}")
    assert resp.status_code == 404

    # B 自己的 essay grade list 空
    resp = client.get("/api/v2/essay/grades")
    assert resp.status_code == 200
    assert resp.json() == []
