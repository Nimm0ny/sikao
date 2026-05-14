"""Slice 2b · aipta plain text import 路由 + 服务 e2e tests.

- 服务层: import_aipta_text → ingest 整链路 (parser + compose + ExamPaperService).
- 路由层: POST /api/v2/admin/essay-papers/import-aipta-text — admin auth +
  body 校验 + happy path + ValidationError(422) 路径.
- 真样本回归: skipif `.claude/aipta-samples/samples.txt` 缺失 — 验证 parser
  对真 aipta 真题保留有效, 防 future regex 调整破真数据.
"""

from __future__ import annotations

import base64
from contextlib import contextmanager
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from sikao_api.core.config import Settings
from sikao_api.db.base import Base
from sikao_api.db.models import Paper, PaperRevision, Question
from sikao_api.main import create_app
from sikao_api.modules.question_bank.application.aipta_import import import_aipta_text
from sikao_api.modules.auth.application.security import hash_password

# ── Fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture
def db_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False, future=True
    )
    return SessionLocal()


@contextmanager
def _client(tmp_path: Path):
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'exam-api.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        admin_username="admin",
        admin_password_hash=hash_password("adminpass"),
        jwt_secret="test-secret-0123456789-test-secret",
        app_version="test-version",
        git_sha="test-sha",
        image_tag="test-tag",
        build_time="2026-04-22T00:00:00Z",
        schema_version="test-schema",
    )
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as client:
        yield client


def _admin_headers() -> dict[str, str]:
    token = base64.b64encode(b"admin:adminpass").decode("ascii")
    return {"Authorization": f"Basic {token}"}


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

要求：字数500-800字。

注：篇幅有限，答案及解析请下载试卷后查看。
"""


# ── 服务层 e2e ──────────────────────────────────────────────────────────────


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

    # paper code 强制 upper-case
    paper = db_session.scalars(select(Paper)).one()
    assert paper.paper_code == "AIPTA-DEMO-001"

    revision = db_session.scalars(select(PaperRevision)).one()
    assert revision.paper_name == "2026 申论 demo"
    assert revision.exam_year == 2026
    assert revision.source_provider == "aipta"
    assert revision.source_kind == "国考"

    questions = db_session.scalars(select(Question).order_by(Question.position)).all()
    assert [q.position for q in questions] == [1, 2]
    for q in questions:
        assert q.question_kind == "essay"
        assert q.renderer_key == "essay"
        assert q.is_gradable is False
        assert q.answer_text == ""
        assert len(q.options) == 0


def test_import_aipta_text_idempotent_same_hash(db_session: Session) -> None:
    """同 raw_text 二次 import → source_hash 命中, 不创建新 revision (复用同一行).

    1st review P2 #10: 直接断言 revision id 不变, 防 future regression 创建
    duplicate-rejected revision (满足行数等但其实生了新行被 unique 拒).
    """
    s1 = import_aipta_text(
        db_session,
        paper_code="aipta-idem-001",
        paper_name="2026 idem",
        exam_year=2026,
        source_kind="国考",
        raw_text=_DEMO_TEXT,
        created_by="admin",
    )
    assert s1.status == "completed"
    rev_1st = db_session.scalars(select(PaperRevision)).one()

    s2 = import_aipta_text(
        db_session,
        paper_code="aipta-idem-001",
        paper_name="2026 idem",
        exam_year=2026,
        source_kind="国考",
        raw_text=_DEMO_TEXT,
        created_by="admin",
    )
    assert s2.status == "completed"
    revisions_after_2nd = db_session.scalars(select(PaperRevision)).all()
    assert len(revisions_after_2nd) == 1
    assert revisions_after_2nd[0].id == rev_1st.id  # 同一 revision, 不是新建


def test_import_aipta_text_parse_error_raises_422(db_session: Session) -> None:
    from sikao_api.modules.system.application.errors import ValidationError

    bad_text = "标题\n\n二、给定材料\n\n材料1\n\n内容\n"  # 缺 三、作答要求
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
    assert "三、作答要求" in exc_info.value.message


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


# ── 路由层 ────────────────────────────────────────────────────────────────


def test_route_admin_auth_required(tmp_path: Path) -> None:
    with _client(tmp_path) as client:
        resp = client.post(
            "/api/v2/admin/essay-papers/import-aipta-text",
            json={
                "paperCode": "AIPTA-X",
                "paperName": "x",
                "examYear": 2026,
                "sourceKind": "国考",
                "rawText": _DEMO_TEXT,
            },
        )
        # 无 Basic auth → 401
        assert resp.status_code == 401


def test_route_happy_path(tmp_path: Path) -> None:
    with _client(tmp_path) as client:
        resp = client.post(
            "/api/v2/admin/essay-papers/import-aipta-text",
            json={
                "paperCode": "aipta-route-001",
                "paperName": "2026 route demo",
                "examYear": 2026,
                "sourceKind": "国考",
                "rawText": _DEMO_TEXT,
            },
            headers=_admin_headers(),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["status"] == "completed"
        assert body["importedPapers"] == 1
        assert body["importedQuestions"] == 2


def test_route_parse_error_returns_422(tmp_path: Path) -> None:
    with _client(tmp_path) as client:
        resp = client.post(
            "/api/v2/admin/essay-papers/import-aipta-text",
            json={
                "paperCode": "AIPTA-BAD",
                "paperName": "bad",
                "examYear": 2026,
                "sourceKind": "国考",
                "rawText": "标题\n\n二、给定材料\n\n材料1\n\n内容\n",
            },
            headers=_admin_headers(),
        )
        assert resp.status_code == 422
        body = resp.json()
        assert body["code"] == "aipta_parse_error"


def test_route_body_validation_empty_paper_code(tmp_path: Path) -> None:
    """Pydantic min_length=1 拒空 paperCode (3rd review P3 polish)."""
    with _client(tmp_path) as client:
        resp = client.post(
            "/api/v2/admin/essay-papers/import-aipta-text",
            json={
                "paperCode": "",
                "paperName": "x",
                "examYear": 2026,
                "sourceKind": "国考",
                "rawText": _DEMO_TEXT,
            },
            headers=_admin_headers(),
        )
        assert resp.status_code == 422


def test_route_body_validation_examYear_out_of_range(tmp_path: Path) -> None:
    """Pydantic 校验 ge=2000 le=2100 — 1999 / 2200 拒."""
    with _client(tmp_path) as client:
        resp = client.post(
            "/api/v2/admin/essay-papers/import-aipta-text",
            json={
                "paperCode": "X",
                "paperName": "x",
                "examYear": 1999,
                "sourceKind": "国考",
                "rawText": _DEMO_TEXT,
            },
            headers=_admin_headers(),
        )
        # FastAPI 422 with detail array
        assert resp.status_code == 422


# ── 真样本回归 ────────────────────────────────────────────────────────────


_REAL_SAMPLE = (
    Path(__file__).resolve().parents[3] / ".claude" / "aipta-samples" / "samples.txt"
)


@pytest.mark.skipif(
    not _REAL_SAMPLE.is_file(),
    reason="real aipta sample missing (.claude/aipta-samples/samples.txt)",
)
def test_real_aipta_sample_parses_into_5_essay_questions(
    db_session: Session,
) -> None:
    """真 aipta 样本回归 — 5 段材料 + 5 道 essay; future regex 调动破真数据自爆.
    parser 调过, 这条用真样本兜底."""
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
    # 真样本分值 15 / 10 / 20 / 20 / 35
    # alembic 0012 后 type_payload_json 列是 JSONB, ORM 直接拿 dict.
    scores = [q.type_payload_json.get("fullScore") for q in questions]
    assert scores == [15, 10, 20, 20, 35]
    # Q5 字数 1000-1200, 其他都只 max
    word_payloads = [q.type_payload_json for q in questions]
    assert word_payloads[0]["wordLimitMax"] == 300
    assert word_payloads[4]["wordLimitMin"] == 1000
    assert word_payloads[4]["wordLimitMax"] == 1200
    # 每题携全 5 段材料 (Slice 2a EssayMetadata contract)
    for payload in word_payloads:
        assert len(payload["materialTexts"]) == 5
