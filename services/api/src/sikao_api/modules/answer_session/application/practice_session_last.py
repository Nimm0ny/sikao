"""SIKAO Wave 8 Phase B: Home block "继续答题" 数据源.

GET /api/v2/practice/last-session 用此 service. 返回该 user 最近一个未完成
(completed_at IS NULL) practice session 的 summary, 让首页给 "继续答题"
入口直接跳过去, 不用先走 history 列表挑选.

约定 (跟 Phase A model 对齐):
  - "in_progress" 定义 = `PracticeSession.completed_at IS NULL`
  - "最近" 排序 = `started_at DESC, id DESC` (tiebreaker 拿最新创建)
  - cross-paper retry session 跨 paper (paper_id IS NULL) 也算 in_progress;
    paper_id NULL 时 paper_title 走特定文案 ("跨试卷批量复习" 跟
    exam_papers.py:2017 一致)
  - 无 in-progress session → 返 None (合法 empty state, 不抛)

current_question_id 推导:
  - session 内已答过的 answer 中, display_order 最大的 question_id (用户
    答到这道题之后该回来继续这道还是下一道, FE 决定 — 这里给最后一个
    答过的 question_id 作为锚点, FE 用 paperCode + questionId 跳合适页)
  - 一道都没答 → current_question_id = None (FE 跳第一题)
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from sikao_api.db import schemas
from sikao_api.db.models import (
    PracticeSession,
    PracticeSessionAnswer,
)

_PAPER_TITLE_CROSS_PAPER = "跨试卷批量复习"
_PAPER_TITLE_UNTITLED = "未命名练习"


def get_last_incomplete_session(
    session: Session,
    *,
    user_id: int,
) -> schemas.PracticeSessionSummary | None:
    """Find user's most recent in-progress practice session.

    Returns None if none — caller (route) returns 200 + null body. Fail-fast:
    SQL errors propagate (不 catch).
    """
    stmt = (
        select(PracticeSession)
        .where(
            PracticeSession.user_id == user_id,
            PracticeSession.completed_at.is_(None),
        )
        .options(joinedload(PracticeSession.paper))
        .order_by(
            PracticeSession.started_at.desc(),
            PracticeSession.id.desc(),
        )
        .limit(1)
    )
    practice_session = session.scalars(stmt).first()
    if practice_session is None:
        return None
    return _serialize_summary(session, practice_session)


def _serialize_summary(
    session: Session,
    practice_session: PracticeSession,
) -> schemas.PracticeSessionSummary:
    """Build summary DTO. answered_count + current_question_id from answers."""
    answered_count = _count_answered(session, session_id=practice_session.id)
    current_qid = _resolve_current_question_id(session, session_id=practice_session.id)
    paper_title = _resolve_paper_title(practice_session)
    return schemas.PracticeSessionSummary(
        id=practice_session.id,
        paper_id=practice_session.paper_id if practice_session.paper_id is not None else 0,
        paper_title=paper_title,
        current_question_id=current_qid,
        answered_count=answered_count,
        total=practice_session.total_questions,
        started_at=practice_session.started_at,
    )


def _count_answered(session: Session, *, session_id: int) -> int:
    """Count distinct PracticeSessionAnswer rows in this session."""
    from sqlalchemy import func as sqlfunc

    stmt = (
        select(sqlfunc.count(PracticeSessionAnswer.id))
        .where(PracticeSessionAnswer.session_id == session_id)
    )
    result = session.execute(stmt).scalar_one()
    return int(result)


def _resolve_current_question_id(
    session: Session, *, session_id: int
) -> int | None:
    """Last-answered question_id (highest display_order) — FE 用作 anchor."""
    stmt = (
        select(PracticeSessionAnswer.question_id)
        .where(PracticeSessionAnswer.session_id == session_id)
        .order_by(PracticeSessionAnswer.display_order.desc())
        .limit(1)
    )
    return session.execute(stmt).scalar_one_or_none()


def _resolve_paper_title(practice_session: PracticeSession) -> str:
    """Paper.paper_name with cross-paper / orphan fallback.

    paper_id IS NULL → cross-paper retry session (跨试卷批量复习).
    paper 行存在但 paper.paper_name 空 → 兜底 "未命名练习" (理论不该发生).
    """
    if practice_session.paper_id is None:
        return _PAPER_TITLE_CROSS_PAPER
    if practice_session.paper is None or not practice_session.paper.paper_name:
        return _PAPER_TITLE_UNTITLED
    return practice_session.paper.paper_name
