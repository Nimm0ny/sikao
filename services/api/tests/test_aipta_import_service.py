"""AIPTA plain-text import service tests."""

from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from sikao_api.db.base import Base
from sikao_api.db.models import Paper, PaperRevision, Question
from sikao_api.modules.question_bank.application.aipta_import import import_aipta_text


_DEMO_TEXT = """2026 申论 demo

一、注意事项
1.本题本由给定资料与作答要求两部分构成。
二、给定材料
材料1

材料一第一段。
材料一第二段。
材料2

材料二只一段。
三、作答要求
1.请概括材料一。（10分）

要求：不超过200字。
2.请就材料二谈谈你的看法。（25分）

要求：字数 500-800字。
注：篇幅有限，答案及解析请下载试卷后查看。
"""

_REAL_SAMPLE = (
    Path(__file__).resolve().parents[3] / ".claude" / "aipta-samples" / "samples.txt"
)


@pytest.fixture
def db_session() -> Session:
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


def test_import_aipta_text_creates_paper_with_essay_questions(
    db_session: Session,
) -> None:
    summary = import_aipta_text(
        db_session,
        paper_code="aipta-demo-001",
        paper_name="2026 申论 demo",
        exam_year=2026,
        source_kind="国考",
        raw_text=_DEMO_TEXT,
        created_by="admin",
    )
    assert summary.status == "completed"
    assert summary.imported_papers == 1
    assert summary.imported_questions == 2

    paper = db_session.scalars(select(Paper)).one()
    assert paper.paper_code == "AIPTA-DEMO-001"

    revision = db_session.scalars(select(PaperRevision)).one()
    assert revision.paper_name == "2026 申论 demo"
    assert revision.exam_year == 2026
    assert revision.source_provider == "aipta"
    assert revision.source_kind == "国考"

    questions = db_session.scalars(select(Question).order_by(Question.position)).all()
    assert [question.position for question in questions] == [1, 2]
    for question in questions:
        assert question.question_kind == "essay"
        assert question.renderer_key == "essay"
        assert question.is_gradable is False
        assert question.answer_text == ""
        assert len(question.options) == 0


def test_import_aipta_text_idempotent_same_hash(db_session: Session) -> None:
    first = import_aipta_text(
        db_session,
        paper_code="aipta-idem-001",
        paper_name="2026 idem",
        exam_year=2026,
        source_kind="国考",
        raw_text=_DEMO_TEXT,
        created_by="admin",
    )
    assert first.status == "completed"
    revision_first = db_session.scalars(select(PaperRevision)).one()

    second = import_aipta_text(
        db_session,
        paper_code="aipta-idem-001",
        paper_name="2026 idem",
        exam_year=2026,
        source_kind="国考",
        raw_text=_DEMO_TEXT,
        created_by="admin",
    )
    assert second.status == "completed"
    revisions = db_session.scalars(select(PaperRevision)).all()
    assert len(revisions) == 1
    assert revisions[0].id == revision_first.id


def test_import_aipta_text_parse_error_raises_422(db_session: Session) -> None:
    from sikao_api.modules.system.application.errors import ValidationError

    bad_text = "标题\n\n二、给定材料\n\n材料1\n\n内容\n"
    with pytest.raises(ValidationError) as exc_info:
        import_aipta_text(
            db_session,
            paper_code="aipta-bad",
            paper_name="bad",
            exam_year=2026,
            source_kind="国考",
            raw_text=bad_text,
            created_by="admin",
        )
    assert exc_info.value.status_code == 422
    assert exc_info.value.code == "aipta_parse_error"


def test_import_aipta_text_empty_text_raises(db_session: Session) -> None:
    from sikao_api.modules.system.application.errors import ValidationError

    with pytest.raises(ValidationError, match="rawText is empty"):
        import_aipta_text(
            db_session,
            paper_code="x",
            paper_name="x",
            exam_year=2026,
            source_kind="国考",
            raw_text="   ",
            created_by="admin",
        )


@pytest.mark.skipif(
    not _REAL_SAMPLE.is_file(),
    reason="real aipta sample missing (.claude/aipta-samples/samples.txt)",
)
def test_real_aipta_sample_parses_into_5_essay_questions(
    db_session: Session,
) -> None:
    raw = _REAL_SAMPLE.read_text(encoding="utf-8")
    summary = import_aipta_text(
        db_session,
        paper_code="AIPTA-2026-GUOKAO-XINGZHENGZHIFA",
        paper_name="2026国考申论真题（行政执法卷）",
        exam_year=2026,
        source_kind="国考",
        raw_text=raw,
        created_by="admin",
    )
    assert summary.status == "completed"
    assert summary.imported_questions == 5

    questions = db_session.scalars(select(Question).order_by(Question.position)).all()
    scores = [question.type_payload_json.get("fullScore") for question in questions]
    assert scores == [15, 10, 20, 20, 35]
    payloads = [question.type_payload_json for question in questions]
    assert payloads[0]["wordLimitMax"] == 300
    assert payloads[4]["wordLimitMin"] == 1000
    assert payloads[4]["wordLimitMax"] == 1200
    for payload in payloads:
        assert len(payload["materialTexts"]) == 5
