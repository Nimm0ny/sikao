"""Slice 2a · 申论题型 ingest + serialize 端到端测试.

验证:
- essay payload (0 options + empty answer_keys + type_payload 含申论 metadata) 不被
  现有 single/multi/fill_blank 校验拒.
- 落库后 question.renderer_key='essay', answer_text='', options=[].
- type_payload_json 序列化往返 (材料文本 / 字数限制 / 满分).
- _serialize_question_detail 把 essay metadata 抽到 content.essayMetadata, 字段过滤
  白名单 (内部 type_payload 调试字段不泄给前端).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from sikao_api.db.base import Base
from sikao_api.db.models import Paper, PaperRevision, Question
from sikao_api.modules.question_bank.application.exam_papers import ExamPaperService


@pytest.fixture
def db_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False, future=True
    )
    return SessionLocal()


def _build_essay_paper_payload() -> dict[str, Any]:
    """1 section / 1 question block, question 是申论 essay."""
    return {
        "paperCode": "ESSAY-DEMO-001",
        "paperName": "申论 demo 试卷",
        "examYear": 2024,
        "sourceProvider": "aipta",
        "sourceKind": "demo",
        "sortOrder": 202400,
        "visibleInPublic": True,
        "sections": [
            {
                "key": "section-1",
                "title": "申论",
                "instructionText": "根据给定材料作答",
                "blocks": [
                    {
                        "type": "question",
                        "sourceUuid": "essay-demo-q1",
                        "questionKind": "essay",
                        "subtypeName": "申论大作文",
                        "stemText": "<p>结合给定材料, 谈谈你的理解...</p>",
                        "answerKeys": [],
                        "options": [],
                        "explanationText": "",
                        "difficultyCode": "unknown",
                        "rendererKey": "essay",
                        "isGradable": False,
                        "typePayload": {
                            "materialTexts": [
                                "材料一: 近年来, 公考改革...",
                                "材料二: 备考阶段, 候选人...",
                            ],
                            "wordLimitMin": 800,
                            "wordLimitMax": 1000,
                            "suggestedMinutes": 60,
                            "fullScore": 40,
                            # 故意夹杂内部字段, 验证序列化时被白名单过滤
                            "_internalNote": "scraped 2026-04-29",
                        },
                        "tags": [],
                    }
                ],
            }
        ],
    }


def test_essay_ingest_round_trip(tmp_path: Path, db_session: Session) -> None:
    """ingest essay paper → DB row 字段对齐 + serialize content.essayMetadata 白名单."""
    paper_payload = _build_essay_paper_payload()
    paper_json = tmp_path / "essay.standard.json"
    paper_json.write_text(json.dumps(paper_payload, ensure_ascii=False), encoding="utf-8")

    service = ExamPaperService(db_session)
    summary = service.import_standard_json_files(
        files=[(paper_json.name, paper_json.read_bytes())],
        base_dir=tmp_path,
        created_by="test-user",
    )

    assert summary.status == "completed"
    assert summary.imported_papers == 1
    assert summary.imported_questions == 1

    # ── DB 行验证 ──
    question = db_session.scalars(select(Question)).one()
    assert question.question_kind == "essay"
    assert question.renderer_key == "essay"
    assert question.answer_text == ""  # 申论无 expected answer
    assert len(question.options) == 0
    assert question.is_gradable is False

    # type_payload_json 保留全部传入字段 (含内部字段, 序列化层才过滤).
    # alembic 0012 后列是 JSONB, ORM 直接拿 dict.
    type_payload = question.type_payload_json
    assert type_payload["materialTexts"] == [
        "材料一: 近年来, 公考改革...",
        "材料二: 备考阶段, 候选人...",
    ]
    assert type_payload["wordLimitMin"] == 800
    assert type_payload["wordLimitMax"] == 1000
    assert type_payload["suggestedMinutes"] == 60
    assert type_payload["fullScore"] == 40
    assert type_payload["_internalNote"] == "scraped 2026-04-29"

    # ── serialize 验证 ──
    paper = db_session.scalars(select(Paper)).one()
    revision = db_session.scalars(select(PaperRevision)).one()
    detail = service._serialize_question_detail(question, paper, revision)

    assert detail.renderer_key == "essay"
    assert detail.options == []
    assert detail.content is not None
    essay_meta = detail.content["essayMetadata"]
    # 白名单字段全部出现, 内部字段被过滤
    assert essay_meta == {
        "materialTexts": [
            "材料一: 近年来, 公考改革...",
            "材料二: 备考阶段, 候选人...",
        ],
        "wordLimitMin": 800,
        "wordLimitMax": 1000,
        "suggestedMinutes": 60,
        "fullScore": 40,
    }
    assert "_internalNote" not in essay_meta


def test_essay_is_gradable_forced_false_even_when_payload_omits_flag(
    tmp_path: Path, db_session: Session
) -> None:
    """Subagent review P1-2: essay 必须 is_gradable=False 不依赖 payload 显式 flag.

    revision.is_gradable=True (默认) + ingest payload 缺 isGradable → 必须 False
    (essay 无 expected answer, 不能 auto-grade).
    """
    payload = _build_essay_paper_payload()
    # 关键: 移除 explicit isGradable, 看 backend 是否强制 False
    del payload["sections"][0]["blocks"][0]["isGradable"]
    paper_json = tmp_path / "essay-no-flag.standard.json"
    paper_json.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    service = ExamPaperService(db_session)
    service.import_standard_json_files(
        files=[(paper_json.name, paper_json.read_bytes())],
        base_dir=tmp_path,
        created_by="test-user",
    )

    question = db_session.scalars(select(Question)).one()
    assert question.renderer_key == "essay"
    assert question.is_gradable is False  # 即使 payload 没写 isGradable=False


def test_essay_submit_via_session_answer_rejected(tmp_path: Path, db_session: Session) -> None:
    """Subagent review P1-3: 防止 essay 答案误走 session answer 路径; 必须明确报错
    指向 LLM 评分 endpoint (Slice 2c), 不能默默 422.
    """
    from sikao_api.modules.system.application.errors import ValidationError

    payload = _build_essay_paper_payload()
    paper_json = tmp_path / "essay-submit.standard.json"
    paper_json.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    service = ExamPaperService(db_session)
    service.import_standard_json_files(
        files=[(paper_json.name, paper_json.read_bytes())],
        base_dir=tmp_path,
        created_by="test-user",
    )
    question = db_session.scalars(select(Question)).one()

    with pytest.raises(ValidationError, match=r"/api/v2/essay/grade"):
        service._validate_selected_answer_keys(
            question, selected_answer_keys=["这是用户写的申论作答全文..."], allow_empty=True
        )

    # 空 (清空) 仍 allow_empty 通过, 不阻止用户清空作答 store
    service._validate_selected_answer_keys(question, selected_answer_keys=[], allow_empty=True)


def test_essay_submit_rejected_through_real_session_flow(
    tmp_path: Path, db_session: Session
) -> None:
    """2nd review P3: 路由级 / 服务级 stack 是否真把 essay submit 拒掉.

    helper 单测覆盖不到 'submit_session_answer 实际会调到 _validate_selected_answer_keys'
    这条线; 添 service 层端到端 (start session → submit essay) 抓将来 refactor 把
    validator bypass 掉的回归.
    """
    from sikao_api.modules.system.application.errors import ValidationError

    payload = _build_essay_paper_payload()
    paper_json = tmp_path / "essay-flow.standard.json"
    paper_json.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    service = ExamPaperService(db_session)
    service.import_standard_json_files(
        files=[(paper_json.name, paper_json.read_bytes())],
        base_dir=tmp_path,
        created_by="test-user",
    )
    # Import 完是 draft revision; start_paper_session 要求 current_revision 已发布.
    # 测试简化 — 直接手动绑 current_revision (跟 release_paper_revision 等价的最简
    # 子集), 不引入 admin 发布全套 fixture.
    paper = db_session.scalars(select(Paper)).one()
    revision = db_session.scalars(select(PaperRevision)).one()
    paper.current_revision = revision
    revision.is_published = True
    db_session.flush()

    session_start = service.start_paper_session("ESSAY-DEMO-001", user=None)
    block = session_start.sections[0].blocks[0]
    assert block.question is not None
    question_id = int(block.question.question_id)

    from sikao_api.db import schemas as s

    submission = s.PracticeSessionAnswerSubmissionV2(
        question_id=question_id,
        selected_answer_keys=["这是用户写的申论..."],
    )
    with pytest.raises(ValidationError, match=r"/api/v2/essay/grade"):
        service.submit_session_answer(
            int(session_start.session_id), submission, user=None
        )


def test_essay_ingest_rejects_non_list_material_texts(
    tmp_path: Path, db_session: Session
) -> None:
    """2nd review P2: essay typePayload.materialTexts 必须 list[str]; ingest 时
    fail-fast 抛错, 不让 bad shape 进 DB 后到 serialize/FE 才暴露 (CLAUDE.md §4).
    """
    payload = _build_essay_paper_payload()
    payload["sections"][0]["blocks"][0]["typePayload"]["materialTexts"] = "误传成字符串"
    paper_json = tmp_path / "essay-bad-mat.standard.json"
    paper_json.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    service = ExamPaperService(db_session)
    summary = service.import_standard_json_files(
        files=[(paper_json.name, paper_json.read_bytes())],
        base_dir=tmp_path,
        created_by="test-user",
    )
    # ingest 整体失败 + 错误信息含 materialTexts 关键字
    assert summary.status == "failed"
    assert any(
        "materialTexts" in (item.error_message or "") for item in summary.items
    )
    # DB 没写入任何 essay question
    assert db_session.scalars(select(Question)).first() is None


@pytest.mark.parametrize("bad_value", ["1000", 1000.0, True, None])
def test_essay_ingest_rejects_non_int_word_limit(
    tmp_path: Path, db_session: Session, bad_value: object
) -> None:
    """2nd+3rd review P2/P3: 数值字段 wordLimitMax 必须是 int (非 float / bool / str / None).

    JSON 解析后 1000 → int 通过, 1000.0 → float 拒, "1000" → str 拒, true → bool 拒.
    """
    payload = _build_essay_paper_payload()
    payload["sections"][0]["blocks"][0]["typePayload"]["wordLimitMax"] = bad_value
    paper_json = tmp_path / "essay-bad-num.standard.json"
    paper_json.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    service = ExamPaperService(db_session)
    summary = service.import_standard_json_files(
        files=[(paper_json.name, paper_json.read_bytes())],
        base_dir=tmp_path,
        created_by="test-user",
    )
    assert summary.status == "failed"
    assert any(
        "wordLimitMax" in (item.error_message or "") for item in summary.items
    )


def test_non_essay_question_no_essay_metadata_in_content(
    tmp_path: Path, db_session: Session
) -> None:
    """单选题 serialize 时 content.essayMetadata 字段必须缺省, 不能误塞 None."""
    paper_payload: dict[str, Any] = {
        "paperCode": "MCQ-DEMO-001",
        "paperName": "MCQ demo",
        "examYear": 2024,
        "sourceProvider": "test",
        "sourceKind": "test",
        "sortOrder": 1,
        "visibleInPublic": True,
        "sections": [
            {
                "key": "s1",
                "title": "section",
                "instructionText": "",
                "blocks": [
                    {
                        "type": "question",
                        "sourceUuid": "mcq-q1",
                        "questionKind": "single_choice",
                        "subtypeName": "单选",
                        "stemText": "1+1=?",
                        "answerKeys": ["B"],
                        "options": [
                            {"key": "A", "text": "1"},
                            {"key": "B", "text": "2"},
                        ],
                        "explanationText": "",
                        "difficultyCode": "easy",
                        "rendererKey": "single_choice",
                        "tags": [],
                    }
                ],
            }
        ],
    }
    paper_json = tmp_path / "mcq.standard.json"
    paper_json.write_text(json.dumps(paper_payload, ensure_ascii=False), encoding="utf-8")

    service = ExamPaperService(db_session)
    service.import_standard_json_files(
        files=[(paper_json.name, paper_json.read_bytes())],
        base_dir=tmp_path,
        created_by="test-user",
    )

    question = db_session.scalars(select(Question)).one()
    paper = db_session.scalars(select(Paper)).one()
    revision = db_session.scalars(select(PaperRevision)).one()
    detail = service._serialize_question_detail(question, paper, revision)
    assert detail.content is not None
    assert "essayMetadata" not in detail.content


def _build_mcq_paper_payload() -> dict[str, Any]:
    """非 essay 卷: 1 道单选, 用于 list_public_papers(kind='essay') 排除测试."""
    return {
        "paperCode": "MCQ-DEMO-002",
        "paperName": "选择题 demo",
        "examYear": 2024,
        "sourceProvider": "test",
        "sourceKind": "test",
        "sortOrder": 1,
        "visibleInPublic": True,
        "sections": [
            {
                "key": "s1",
                "title": "选择",
                "instructionText": "",
                "blocks": [
                    {
                        "type": "question",
                        "sourceUuid": "mcq-only-q1",
                        "questionKind": "single_choice",
                        "subtypeName": "单选",
                        "stemText": "1+1=?",
                        "answerKeys": ["B"],
                        "options": [
                            {"key": "A", "text": "1"},
                            {"key": "B", "text": "2"},
                        ],
                        "explanationText": "",
                        "difficultyCode": "easy",
                        "rendererKey": "single_choice",
                        "tags": [],
                    }
                ],
            }
        ],
    }


def _ingest_and_publish(
    service: ExamPaperService,
    db_session: Session,
    tmp_path: Path,
    payload: dict[str, Any],
    file_name: str,
) -> None:
    """helper: ingest + publish first revision so list_public_papers 看得见."""
    paper_json = tmp_path / file_name
    paper_json.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    service.import_standard_json_files(
        files=[(paper_json.name, paper_json.read_bytes())],
        base_dir=tmp_path,
        created_by="test-user",
    )
    db_session.flush()
    paper = db_session.scalars(
        select(Paper).where(Paper.paper_code == payload["paperCode"])
    ).one()
    # ingest 出的 revision 默认 not published; manual publish 让 list 看得见
    revision = paper.revisions[-1]
    service.publish_revision(
        paper_code=paper.paper_code,
        revision_id=revision.id,
        released_by="test-user",
    )
    db_session.flush()


def test_list_public_papers_kind_essay_filter(
    tmp_path: Path, db_session: Session
) -> None:
    """Slice 2d D7: ?kind=essay 过滤含 essay 题的 paper.

    申论 paper (renderer_key='essay') + 选择题 paper (renderer_key=
    'single_choice') 各 ingest+publish 一份, 然后:
      kind=None      → 列两份 (现行行为不变)
      kind='essay'   → 仅列申论卷
    """
    service = ExamPaperService(db_session)
    _ingest_and_publish(
        service, db_session, tmp_path, _build_essay_paper_payload(), "essay.standard.json"
    )
    _ingest_and_publish(
        service,
        db_session,
        tmp_path,
        _build_mcq_paper_payload(),
        "mcq.standard.json",
    )

    all_papers = service.list_public_papers()
    codes_all = {p.paper_code for p in all_papers}
    assert codes_all == {"ESSAY-DEMO-001", "MCQ-DEMO-002"}

    essay_only = service.list_public_papers(kind="essay")
    codes_essay = {p.paper_code for p in essay_only}
    assert codes_essay == {"ESSAY-DEMO-001"}

    # explicit None kind 行为跟省略一致
    explicit_none = service.list_public_papers(kind=None)
    assert {p.paper_code for p in explicit_none} == codes_all
