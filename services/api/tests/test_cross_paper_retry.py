"""Cross-paper retry session tests — ARCH §7.2 Pages P2.

In-memory sqlite + ORM 直接 seed 两个 paper revisions 各一题 + 用户 wrong-book
记录, 调 ExamPaperService.start_retry_wrong_batch 验证:
  - 跨 revision 的 batch → cross-paper session (paper_revision_id NULL)
  - 单 revision 的 batch → 老路径 (paper_revision_id 绑该 revision)
  - cross-paper session submit → wrong-book 校验代替 revision 匹配
  - cross-paper session result → flat questions, no section_summaries
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from sikao_api.db.base import Base
from sikao_api.db import schemas
from sikao_api.db.models import (
    Paper,
    PaperBlock,
    PaperRevision,
    PaperSection,
    PracticeSession,
    Question,
    QuestionOption,
    User,
    WrongQuestionMastery,
)
from sikao_api.modules.question_bank.application.exam_papers import ExamPaperService
from sikao_api.modules.auth.application.security import hash_password


@pytest.fixture
def session() -> Iterator[Session]:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False, future=True
    )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _seed_user(session: Session) -> User:
    u = User(
        username="alice",
        password_hash=hash_password("OrigPass!"),
        display_name="Alice",
        is_active=True,
    )
    session.add(u)
    session.flush()
    return u


def _seed_paper_with_one_question(
    session: Session, *, paper_code: str, stem: str
) -> tuple[Paper, PaperRevision, Question]:
    paper = Paper(paper_code=paper_code, paper_name=f"{paper_code} 套卷")
    session.add(paper)
    session.flush()
    revision = PaperRevision(
        paper_id=paper.id,
        revision_number=1,
        sort_order=1,
        paper_name=paper.paper_name,
        question_count=1,
        source_hash=f"hash_{paper_code}",
        is_published=True,
    )
    session.add(revision)
    session.flush()
    paper.current_revision_id = revision.id
    section = PaperSection(
        paper_revision_id=revision.id,
        section_key=f"{paper_code}_S1",
        title="Section 1",
        instruction_text="",
        display_order=1,
        question_count=1,
    )
    session.add(section)
    session.flush()
    block = PaperBlock(
        paper_revision_id=revision.id,
        section_id=section.id,
        block_type="question",
        display_order=1,
    )
    session.add(block)
    session.flush()
    q = Question(
        paper_revision_id=revision.id,
        section_id=section.id,
        block_id=block.id,
        position=1,
        source_uuid=f"q_{paper_code}",
        question_kind="single_choice",
        subtype_name="逻辑填空",
        stem_text=stem,
        answer_text="A",
        renderer_key="single_choice",
        subject="言语理解",
        canonical_top_type="言语理解",
        canonical_subtype="逻辑填空",
    )
    session.add(q)
    session.flush()
    for idx, key in enumerate(("A", "B", "C", "D")):
        session.add(
            QuestionOption(
                question_id=q.id,
                option_key=key,
                option_text=f"option {key}",
                display_order=idx,
            )
        )
    session.flush()
    return paper, revision, q


def _seed_wrong_mastery(
    session: Session, user_id: int, question_id: int
) -> WrongQuestionMastery:
    m = WrongQuestionMastery(
        user_id=user_id,
        question_id=question_id,
        mastery_level="not_mastered",
        last_wrong_time=datetime.utcnow(),
        consecutive_correct_count=0,
    )
    session.add(m)
    session.flush()
    return m


# ─── start_retry_wrong_batch path dispatch ────────────────────────────────


def test_single_revision_batch_uses_legacy_path(session: Session) -> None:
    from sqlalchemy import select

    user = _seed_user(session)
    _, revision, q = _seed_paper_with_one_question(
        session, paper_code="D1", stem="题目 1"
    )
    _seed_wrong_mastery(session, user.id, q.id)
    session.commit()

    service = ExamPaperService(session)
    result = service.start_retry_wrong_batch([q.id], user=user)

    assert result.paper_revision_id == revision.id
    assert result.paper_code == "D1"
    # session DB row 也绑 revision
    s = session.scalar(
        select(PracticeSession).where(PracticeSession.id == result.session_id)
    )
    assert s is not None
    assert s.paper_revision_id == revision.id


def test_multi_revision_batch_creates_cross_paper_session(session: Session) -> None:
    user = _seed_user(session)
    _, _, q1 = _seed_paper_with_one_question(session, paper_code="D1", stem="d1 q1")
    _, _, q2 = _seed_paper_with_one_question(session, paper_code="D2", stem="d2 q1")
    _seed_wrong_mastery(session, user.id, q1.id)
    _seed_wrong_mastery(session, user.id, q2.id)
    session.commit()

    service = ExamPaperService(session)
    result = service.start_retry_wrong_batch([q1.id, q2.id], user=user)

    # cross-paper marker: paper_revision_id is None, paper_code 是 marker.
    assert result.paper_revision_id is None
    assert result.paper_code == "__cross_paper_retry__"
    assert result.paper_name == "跨试卷批量复习"
    assert len(result.sections) == 1
    section = result.sections[0]
    assert section.title == "跨试卷批量复习"
    assert section.question_count == 2
    # 题目按 paper_code 排序: D1 在 D2 之前
    block_qids = [b.question_id for b in section.blocks]
    assert block_qids == [q1.id, q2.id]

    # session DB row paper_revision_id NULL
    from sqlalchemy import select

    s = session.scalar(
        select(PracticeSession).where(PracticeSession.id == result.session_id)
    )
    assert s is not None
    assert s.paper_revision_id is None
    assert s.paper_id is None
    # 独立 review KEY OBS #1 修: 显式 cross-paper mode (而非 in-band marker).
    assert s.mode == "retry_wrong_cross_paper"


# ─── submit + complete + result on cross-paper session ────────────────────


def test_cross_paper_submit_validates_against_batch_allowlist(session: Session) -> None:
    """B-review B4 修: cross-paper session submit 检查 question 在创建时
    的 batch allowlist 内, 不是只 user 的 wrong-book (防 user 提 batch 外题)."""
    user = _seed_user(session)
    _, _, q1 = _seed_paper_with_one_question(session, paper_code="D1", stem="d1 q1")
    _, _, q2 = _seed_paper_with_one_question(session, paper_code="D2", stem="d2 q1")
    _, _, q3 = _seed_paper_with_one_question(session, paper_code="D3", stem="d3 q1")
    _seed_wrong_mastery(session, user.id, q1.id)
    _seed_wrong_mastery(session, user.id, q2.id)
    _seed_wrong_mastery(session, user.id, q3.id)  # q3 在 wrong-book 但**不在** batch
    session.commit()

    service = ExamPaperService(session)
    cross_session = service.start_retry_wrong_batch([q1.id, q2.id], user=user)
    sid = cross_session.session_id
    assert sid is not None

    # q1 在 batch, submit OK
    result_q1 = service.submit_session_answer(
        sid,
        schemas.PracticeSessionAnswerSubmissionV2(
            question_id=q1.id, selected_answer_keys=["A"]
        ),
        user=user,
    )
    assert result_q1.question_id == q1.id

    # q3 在 wrong book 但不在 batch, submit 必须拒.
    from sikao_api.modules.system.application.errors import ValidationError

    with pytest.raises(ValidationError, match="not in this cross-paper retry batch"):
        service.submit_session_answer(
            sid,
            schemas.PracticeSessionAnswerSubmissionV2(
                question_id=q3.id, selected_answer_keys=["A"]
            ),
            user=user,
        )


def test_cross_paper_rejects_material_bound_questions(session: Session) -> None:
    """B-review B2 修: cross-paper batch 含 material question 应 fail-fast.

    资料分析 / 阅读理解 等 material_group_id 非空的题, 在 cross-paper 路径下
    读不到原文 (合成 blueprint 不带 material), 用户答不了. ship 前先拦掉.

    简化 seed: 直接 set q.material_group_id = 999 (FK ON DELETE SET NULL,
    nullable, 没真 MaterialGroup 行也通过 FK check 在 sqlite 默认关闭).
    """
    from sikao_api.modules.system.application.errors import ValidationError

    user = _seed_user(session)
    _, _, q1 = _seed_paper_with_one_question(session, paper_code="D1", stem="d1 q1")
    _, _, q2 = _seed_paper_with_one_question(session, paper_code="D2", stem="d2 q1")
    # Mock material binding: 直接 set FK 字段, sqlite default 不强制 FK 检查.
    # 真实场景: import_standard_json 时材料题会带 material_group_id.
    from sqlalchemy import update as sa_update

    from sikao_api.db.models import Question as QuestionModel

    session.execute(
        sa_update(QuestionModel)
        .where(QuestionModel.id == q2.id)
        .values(material_group_id=999)
    )
    _seed_wrong_mastery(session, user.id, q1.id)
    _seed_wrong_mastery(session, user.id, q2.id)
    session.commit()

    service = ExamPaperService(session)
    with pytest.raises(ValidationError, match="不支持含材料题"):
        service.start_retry_wrong_batch([q1.id, q2.id], user=user)


def test_cross_paper_result_returns_flat_questions(session: Session) -> None:
    user = _seed_user(session)
    _, _, q1 = _seed_paper_with_one_question(session, paper_code="D1", stem="d1 q1")
    _, _, q2 = _seed_paper_with_one_question(session, paper_code="D2", stem="d2 q1")
    _seed_wrong_mastery(session, user.id, q1.id)
    _seed_wrong_mastery(session, user.id, q2.id)
    session.commit()

    service = ExamPaperService(session)
    cross_session = service.start_retry_wrong_batch([q1.id, q2.id], user=user)
    sid = cross_session.session_id
    assert sid is not None

    # 提交两题
    service.submit_session_answer(
        sid,
        schemas.PracticeSessionAnswerSubmissionV2(question_id=q1.id, selected_answer_keys=["A"]),
        user=user,
    )
    service.submit_session_answer(
        sid,
        schemas.PracticeSessionAnswerSubmissionV2(question_id=q2.id, selected_answer_keys=["B"]),
        user=user,
    )
    service.complete_session(sid, user=user)

    res = service.get_session_result(sid, user=user)
    assert res.total_questions == 2
    assert res.correct_count == 1  # q1 答 A 是对的, q2 答 B 错
    assert res.incorrect_count == 1
    # cross-paper: section_summaries 空, subject_summaries 按 question.subject 聚合
    assert res.section_summaries == []
    assert len(res.subject_summaries) >= 1  # 言语理解 至少一档
    # 题目 questions 包含 q1 + q2
    qids = [q.question_id for q in res.questions or []]
    assert q1.id in qids and q2.id in qids
