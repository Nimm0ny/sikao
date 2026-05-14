"""Slice 3b · POST /api/v2/practice/study-plan/start route integration.

5 tests covering:
  - single paper happy path → paper_revision_id bound
  - cross-paper happy path → synthetic session marker
  - cross-paper with material question → 422 cross_paper_material_unsupported
  - empty questionIds → Pydantic 422
  - skips wrong-book validation (different from retry-batch endpoint)
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
    MaterialGroup,
    Paper,
    PaperBlock,
    PaperRevision,
    PaperSection,
    Question,
    QuestionOption,
)
from sikao_api.main import create_app
from sikao_api.modules.auth.application.security import hash_password

ANSWER_FIELD_KEYS = {"isCorrect", "answerKeys", "correctAnswerKeys", "explanation", "explanationText"}


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


def _collect_keys(payload: object) -> set[str]:
    if isinstance(payload, dict):
        keys = set(payload)
        for value in payload.values():
            keys.update(_collect_keys(value))
        return keys
    if isinstance(payload, list):
        keys: set[str] = set()
        for value in payload:
            keys.update(_collect_keys(value))
        return keys
    return set()


def _seed_paper(
    database_url: str,
    *,
    paper_code: str,
    n_questions: int = 1,
    set_material: bool = False,
    exam_year: int = 2024,
    top_type: str = "言语理解",
    subtype: str = "逻辑填空",
    second_subtype: str | None = None,
    is_gradable: bool = True,
    enabled: bool = True,
    material_group_size: int | None = None,
) -> list[int]:
    """Seed paper + revision + N questions, return question_ids.

    set_material=True 把全部 question 设 material_group_id=999 (sqlite 默认
    不强 FK, 不需要真 MaterialGroup 行).
    """
    engine = create_engine(database_url, future=True)
    SessionLocal = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False, future=True
    )
    db = SessionLocal()
    try:
        paper = Paper(paper_code=paper_code, paper_name=f"{paper_code} 套卷")
        db.add(paper)
        db.flush()
        revision = PaperRevision(
            paper_id=paper.id,
            revision_number=1,
            sort_order=1,
            paper_name=paper.paper_name,
            question_count=n_questions,
            exam_year=exam_year,
            source_hash=f"hash_{paper_code}",
            is_published=True,
        )
        db.add(revision)
        db.flush()
        paper.current_revision_id = revision.id
        section = PaperSection(
            paper_revision_id=revision.id,
            section_key=f"{paper_code}_S1",
            title="Section 1",
            instruction_text="",
            display_order=1,
            question_count=n_questions,
        )
        db.add(section)
        db.flush()
        material_group: MaterialGroup | None = None
        material_block: PaperBlock | None = None
        if material_group_size is not None:
            material_block = PaperBlock(
                paper_revision_id=revision.id,
                section_id=section.id,
                block_type="material_group",
                display_order=1,
            )
            db.add(material_block)
            db.flush()
            material_group = MaterialGroup(
                paper_revision_id=revision.id,
                block_id=material_block.id,
                source_group_uuid=f"mg_{paper_code}",
                group_kind="data_analysis",
                title="资料",
                material_text="材料原文",
                instruction_text="根据材料回答问题",
                display_order=1,
            )
            db.add(material_group)
            db.flush()
        qids: list[int] = []
        for i in range(n_questions):
            if material_group is None:
                block = PaperBlock(
                    paper_revision_id=revision.id,
                    section_id=section.id,
                    block_type="question",
                    display_order=i + 1,
                )
                db.add(block)
                db.flush()
            else:
                block = material_block
                assert block is not None
                set_material = True
            q = Question(
                paper_revision_id=revision.id,
                section_id=section.id,
                block_id=block.id,
                position=i + 1,
                source_uuid=f"q_{paper_code}_{i}",
                question_kind="single_choice",
                subtype_name=subtype,
                stem_text=f"{paper_code} 题 {i + 1}",
                answer_text="A",
                renderer_key="single_choice",
                exam_year=exam_year,
                is_gradable=is_gradable,
                enabled=enabled,
                subject=top_type,
                canonical_top_type=top_type,
                canonical_subtype=subtype,
                canonical_second_subtype=second_subtype,
                material_group_id=(
                    material_group.id
                    if material_group is not None
                    else 999
                    if set_material
                    else None
                ),
            )
            db.add(q)
            db.flush()
            for idx, key in enumerate(("A", "B", "C", "D")):
                db.add(
                    QuestionOption(
                        question_id=q.id,
                        option_key=key,
                        option_text=f"opt {key}",
                        display_order=idx,
                    )
                )
            db.flush()
            qids.append(q.id)
        db.commit()
        return qids
    finally:
        db.close()


# ── 5 BE pytest (Slice 3b plan §7) ────────────────────────────────────────


def test_start_single_paper_returns_session(client) -> None:
    c, s = client
    _register(c)
    qids = _seed_paper(s.database_url, paper_code="D1", n_questions=2)

    resp = c.post(
        "/api/v2/practice/study-plan/start",
        json={"paperCode": "D1", "questionIds": qids},
        headers=_csrf(c),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["paperCode"] == "D1"
    assert body["paperRevisionId"] is not None
    assert body["sessionId"] is not None


def test_start_cross_paper_returns_synthetic_session(client) -> None:
    c, s = client
    _register(c)
    qids_d1 = _seed_paper(s.database_url, paper_code="D1", n_questions=1)
    qids_d2 = _seed_paper(s.database_url, paper_code="D2", n_questions=1)

    resp = c.post(
        "/api/v2/practice/study-plan/start",
        json={"questionIds": qids_d1 + qids_d2},
        headers=_csrf(c),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["paperCode"] == "__cross_paper_retry__"
    # response_model_exclude_none=True → None 字段不序列化, get() 拿 None 即可
    assert body.get("paperRevisionId") is None
    assert len(body["sections"]) == 1
    leaks = _collect_keys(body) & ANSWER_FIELD_KEYS
    assert not leaks, f"cross-paper start payload leaks answer fields: {leaks}"


def test_start_cross_paper_material_returns_422(client) -> None:
    c, s = client
    _register(c)
    qids_d1 = _seed_paper(s.database_url, paper_code="D1", n_questions=1)
    qids_d2 = _seed_paper(
        s.database_url, paper_code="D2", n_questions=1, set_material=True
    )

    resp = c.post(
        "/api/v2/practice/study-plan/start",
        json={"questionIds": qids_d1 + qids_d2},
        headers=_csrf(c),
    )
    assert resp.status_code == 422
    detail = resp.json().get("detail", "")
    assert "材料题" in detail or "cross_paper_material_unsupported" in resp.text


def test_start_empty_question_ids_returns_422(client) -> None:
    c, _ = client
    _register(c)
    resp = c.post(
        "/api/v2/practice/study-plan/start",
        json={"questionIds": []},
        headers=_csrf(c),
    )
    assert resp.status_code == 422


def test_start_skips_wrong_book_validation(client) -> None:
    """retry-batch 强制题在 wrong-book; study_plan/start 不强制 (LLM 选新题)."""
    c, s = client
    _register(c)
    qids = _seed_paper(s.database_url, paper_code="D1", n_questions=1)
    # 故意不调 _seed_wrong_mastery, 题不在 user wrong-book

    resp = c.post(
        "/api/v2/practice/study-plan/start",
        json={"paperCode": "D1", "questionIds": qids},
        headers=_csrf(c),
    )
    assert resp.status_code == 200, resp.text


# ── 2 P1 review followup tests (paper_code_mismatch + question_not_found) ──


def test_start_paper_code_mismatch_returns_422(client) -> None:
    """单 revision 路径下 caller 传错配的 paperCode → 422 paper_code_mismatch."""
    c, s = client
    _register(c)
    qids_d1 = _seed_paper(s.database_url, paper_code="D1", n_questions=1)
    _seed_paper(s.database_url, paper_code="D2", n_questions=1)

    resp = c.post(
        "/api/v2/practice/study-plan/start",
        json={"paperCode": "D2", "questionIds": qids_d1},  # 题属 D1, 传 D2
        headers=_csrf(c),
    )
    assert resp.status_code == 422
    assert "paper_code_mismatch" in resp.text or "不一致" in resp.text


def test_start_unknown_question_returns_422(client) -> None:
    """questionIds 含不存在的 id → 422 question_not_found (非 404)."""
    c, _ = client
    _register(c)

    resp = c.post(
        "/api/v2/practice/study-plan/start",
        json={"questionIds": [99999]},
        headers=_csrf(c),
    )
    assert resp.status_code == 422
    assert "question_not_found" in resp.text or "不存在" in resp.text


# ── Custom practice classification + session start ───────────────────────


def test_custom_facets_returns_top_subtype_second_subtype_and_years(client) -> None:
    c, s = client
    _seed_paper(
        s.database_url,
        paper_code="C1",
        n_questions=2,
        exam_year=2025,
        top_type="政治理论",
        subtype="时政",
        second_subtype="党的创新理论",
    )
    _seed_paper(
        s.database_url,
        paper_code="C2",
        n_questions=1,
        exam_year=2024,
        top_type="判断推理",
        subtype="图形推理",
    )

    resp = c.get("/api/v2/practice/custom/facets")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["totalQuestions"] == 3
    assert body["years"] == [2025, 2024]
    political = next(item for item in body["topTypes"] if item["name"] == "政治理论")
    assert political["questionCount"] == 2
    assert political["years"] == [2025]
    assert political["subtypes"][0]["name"] == "时政"
    assert political["subtypes"][0]["secondSubtypes"][0]["name"] == "党的创新理论"


def test_custom_start_filters_by_top_type_years_and_count(client) -> None:
    c, s = client
    _register(c)
    _seed_paper(
        s.database_url,
        paper_code="C1",
        n_questions=2,
        exam_year=2025,
        top_type="政治理论",
        subtype="时政",
    )
    _seed_paper(
        s.database_url,
        paper_code="C2",
        n_questions=1,
        exam_year=2024,
        top_type="政治理论",
        subtype="时政",
    )
    _seed_paper(
        s.database_url,
        paper_code="C3",
        n_questions=1,
        exam_year=2025,
        top_type="言语理解",
        subtype="逻辑填空",
    )

    resp = c.post(
        "/api/v2/practice/custom/start",
        json={"topType": "政治理论", "years": [2025], "questionCount": 2},
        headers=_csrf(c),
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["paperCode"] == "__custom_practice__"
    assert body["paperName"] == "专项练习"
    assert body["sessionId"] is not None
    assert body["sections"][0]["questionCount"] == 2
    questions = [
        block["question"]
        for block in body["sections"][0]["blocks"]
        if block["type"] == "question"
    ]
    assert [q["canonicalTopType"] for q in questions] == ["政治理论", "政治理论"]
    assert [q["examYear"] for q in questions] == [2025, 2025]
    leaks = _collect_keys(body) & ANSWER_FIELD_KEYS
    assert not leaks, f"custom start payload leaks answer fields: {leaks}"


def test_custom_start_filters_by_subtype_and_second_subtype(client) -> None:
    c, s = client
    _register(c)
    _seed_paper(
        s.database_url,
        paper_code="C1",
        n_questions=1,
        exam_year=2025,
        top_type="政治理论",
        subtype="时政",
        second_subtype="党的创新理论",
    )
    _seed_paper(
        s.database_url,
        paper_code="C2",
        n_questions=1,
        exam_year=2025,
        top_type="政治理论",
        subtype="马克思主义哲学",
        second_subtype="唯物论",
    )

    resp = c.post(
        "/api/v2/practice/custom/start",
        json={
            "topType": "政治理论",
            "subtype": "时政",
            "secondSubtype": "党的创新理论",
            "questionCount": 1,
        },
        headers=_csrf(c),
    )

    assert resp.status_code == 200, resp.text
    question = resp.json()["sections"][0]["blocks"][0]["question"]
    assert question["canonicalTopType"] == "政治理论"
    assert question["canonicalSubtype"] == "时政"
    assert question["canonicalSecondSubtype"] == "党的创新理论"


def test_custom_start_returns_422_when_question_count_exceeds_matches(client) -> None:
    c, s = client
    _register(c)
    _seed_paper(
        s.database_url,
        paper_code="C1",
        n_questions=1,
        exam_year=2025,
        top_type="政治理论",
        subtype="时政",
    )

    resp = c.post(
        "/api/v2/practice/custom/start",
        json={"topType": "政治理论", "years": [2025], "questionCount": 2},
        headers=_csrf(c),
    )

    assert resp.status_code == 422
    assert "custom_practice_not_enough_questions" in resp.text


def test_custom_start_session_accepts_selected_question_answer(client) -> None:
    c, s = client
    _register(c)
    _seed_paper(
        s.database_url,
        paper_code="C1",
        n_questions=1,
        exam_year=2025,
        top_type="政治理论",
        subtype="时政",
    )

    start_resp = c.post(
        "/api/v2/practice/custom/start",
        json={"topType": "政治理论", "questionCount": 1},
        headers=_csrf(c),
    )
    assert start_resp.status_code == 200, start_resp.text
    body = start_resp.json()
    question_id = body["sections"][0]["blocks"][0]["questionId"]

    submit_resp = c.post(
        f"/api/v2/practice/sessions/{body['sessionId']}/submit",
        json={"questionId": question_id, "selectedAnswerKeys": ["A"]},
        headers=_csrf(c),
    )

    assert submit_resp.status_code == 200, submit_resp.text
    assert submit_resp.json()["completed"] is True


def test_custom_start_includes_whole_material_group_when_exact_count_matches(client) -> None:
    c, s = client
    _register(c)
    _seed_paper(
        s.database_url,
        paper_code="C1",
        n_questions=5,
        exam_year=2025,
        top_type="资料分析",
        subtype="文字资料",
        material_group_size=5,
    )

    resp = c.post(
        "/api/v2/practice/custom/start",
        json={"topType": "资料分析", "subtype": "文字资料", "questionCount": 5},
        headers=_csrf(c),
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    block = body["sections"][0]["blocks"][0]
    assert block["type"] == "material_group"
    assert block["materialGroup"]["materialText"] == "材料原文"
    assert len(block["materialGroup"]["questions"]) == 5
    leaks = _collect_keys(body) & ANSWER_FIELD_KEYS
    assert not leaks, f"custom material payload leaks answer fields: {leaks}"


def test_custom_start_material_group_returns_only_matching_selected_questions(client) -> None:
    c, s = client
    _register(c)
    qids = _seed_paper(
        s.database_url,
        paper_code="C1",
        n_questions=5,
        exam_year=2025,
        top_type="资料分析",
        subtype="文字资料",
        material_group_size=5,
    )
    engine = create_engine(s.database_url, future=True)
    SessionLocal = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False, future=True
    )
    db = SessionLocal()
    try:
        for qid in qids[2:]:
            question = db.get(Question, qid)
            assert question is not None
            question.exam_year = 2024
        db.commit()
    finally:
        db.close()

    resp = c.post(
        "/api/v2/practice/custom/start",
        json={
            "topType": "资料分析",
            "subtype": "文字资料",
            "years": [2025],
            "questionCount": 2,
        },
        headers=_csrf(c),
    )

    assert resp.status_code == 200, resp.text
    block = resp.json()["sections"][0]["blocks"][0]
    assert block["type"] == "material_group"
    assert block["questionIds"] == qids[:2]
    returned_questions = block["materialGroup"]["questions"]
    assert [q["questionId"] for q in returned_questions] == qids[:2]
    assert [q["examYear"] for q in returned_questions] == [2025, 2025]


def test_custom_start_skips_oversized_material_group_and_uses_later_questions(client) -> None:
    c, s = client
    _register(c)
    _seed_paper(
        s.database_url,
        paper_code="C1",
        n_questions=5,
        exam_year=2025,
        top_type="资料分析",
        subtype="文字资料",
        material_group_size=5,
    )
    independent_qids = _seed_paper(
        s.database_url,
        paper_code="C2",
        n_questions=3,
        exam_year=2025,
        top_type="资料分析",
        subtype="文字资料",
    )

    resp = c.post(
        "/api/v2/practice/custom/start",
        json={
            "topType": "资料分析",
            "subtype": "文字资料",
            "years": [2025],
            "questionCount": 3,
        },
        headers=_csrf(c),
    )

    assert resp.status_code == 200, resp.text
    blocks = resp.json()["sections"][0]["blocks"]
    assert [block["questionId"] for block in blocks] == independent_qids
