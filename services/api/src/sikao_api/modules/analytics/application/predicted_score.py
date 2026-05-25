"""Phase 5.2 (fenbi-merge) — 用户中心预测分服务.

D4 算法 (见 docs/plan/fenbi-merge-prototype-vs-reality.md):
  - 取该用户近 N=30 套 paper-bound 已交卷 session (排除单题练习 / 自定义练习)
  - 每套 score = is_correct count / total_questions × 100  (0-100)
  - 加权: w_i = 0.85^i (i=0 最近), 自动归一: w_i / sum(w)
  - predicted_score = sum(w_i_normalized * score_i)
  - sample_size < 3 时 is_reference_only=True

不做的 (推 follow-up):
  - 击败 % (需要全站同卷分数分布, 大查询)
  - 趋势 (FE 用 trend endpoint 已有)
"""

from __future__ import annotations

import logging
from datetime import datetime

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from sikao_api.db.models import (
    Paper,
    PracticeSession,
    PracticeSessionAnswer,
)
from sikao_api.db.schemas import (
    PredictedScorePaperEntryV2,
    PredictedScoreV2,
)

_logger = logging.getLogger(__name__)

# Paper-bound mode constant — 跟 exam_papers.py 保持一致 (避免循环引用先复用值).
# TODO(2026-06-01 lhr): 抽到 app/domain/constants.py 让 exam_papers / 此处 / route 共享.
_MODE_PAPER = "paper"

# 加权窗口 + 衰减系数 (D4).
_WINDOW_N = 30
_DECAY = 0.85
_REFERENCE_THRESHOLD = 3
_RECENT_FOR_DISPLAY = 5


def get_predicted_score(session: Session, *, user_id: int) -> PredictedScoreV2:
    """Compute predicted score from recent paper-bound completed sessions.

    Empty sample → predicted_score=None, sample_size=0.
    """
    # 一次 JOIN 拉 session + answer 聚合 + paper meta. GROUP BY session.
    correct_expr = func.sum(
        case((PracticeSessionAnswer.is_correct.is_(True), 1), else_=0)
    )
    answered_expr = func.count(PracticeSessionAnswer.id)
    stmt = (
        select(
            PracticeSession.id,
            PracticeSession.completed_at,
            PracticeSession.total_questions,
            Paper.paper_code,
            Paper.paper_name,
            correct_expr.label("correct_count"),
            answered_expr.label("answered_count"),
        )
        .join(Paper, Paper.id == PracticeSession.paper_id)
        .join(
            PracticeSessionAnswer,
            PracticeSessionAnswer.session_id == PracticeSession.id,
            isouter=True,
        )
        .where(
            PracticeSession.user_id == user_id,
            PracticeSession.mode == _MODE_PAPER,
            PracticeSession.completed_at.is_not(None),
            PracticeSession.paper_id.is_not(None),
        )
        .group_by(
            PracticeSession.id,
            PracticeSession.completed_at,
            PracticeSession.total_questions,
            Paper.paper_code,
            Paper.paper_name,
        )
        # Tiebreaker on id desc — completed_at 同秒提交两套时给确定顺序,
        # 让加权结果可重现 (review #1).
        .order_by(PracticeSession.completed_at.desc(), PracticeSession.id.desc())
        .limit(_WINDOW_N)
    )
    rows = session.execute(stmt).all()

    if not rows:
        return PredictedScoreV2(
            predicted_score=None,
            sample_size=0,
            is_reference_only=True,
            recent_papers=[],
        )

    scored: list[tuple[float, str, str, datetime]] = []
    for row in rows:
        # 用 total_questions (session 快照) 而非 answered_count — 后者在中途
        # 弃考的 session 会偏高. 只数 paper-bound completed 已经过滤了未交卷,
        # 但 total_questions 是 session.start 时的 paper.questions 快照, 更稳.
        total = row.total_questions
        if total <= 0:
            # 数据异常 — paper-bound completed session 应永远 total > 0.
            # 静默跳过会让预测分忽视真实数据问题, fail-fast 要求至少日志报警
            # (不抛: 单条异常不应让整 endpoint 500, 但 ops 要可见).
            _logger.warning(
                "predicted_score.skip_zero_total session_id=%s paper=%s total_questions=%s",
                row.id, row.paper_code, total,
            )
            continue
        correct = row.correct_count
        if correct is None:
            # LEFT OUTER JOIN + 0 answer 的 paper-bound completed session 也是
            # 数据异常 (交卷必有 answer 记录); 同样日志不抛, 跳过该样本.
            _logger.warning(
                "predicted_score.skip_zero_answers session_id=%s paper=%s",
                row.id, row.paper_code,
            )
            continue
        score = correct / total * 100.0
        scored.append((score, row.paper_code, row.paper_name, row.completed_at))

    if not scored:
        return PredictedScoreV2(
            predicted_score=None,
            sample_size=0,
            is_reference_only=True,
            recent_papers=[],
        )

    weights = [_DECAY**i for i in range(len(scored))]
    weight_sum = sum(weights)
    weighted = sum(w * s[0] for w, s in zip(weights, scored)) / weight_sum

    recent = [
        PredictedScorePaperEntryV2(
            paper_code=code,
            paper_name=name,
            score=round(score, 1),
            completed_at=completed_at,
        )
        for score, code, name, completed_at in scored[:_RECENT_FOR_DISPLAY]
    ]

    return PredictedScoreV2(
        predicted_score=round(weighted, 1),
        sample_size=len(scored),
        is_reference_only=len(scored) < _REFERENCE_THRESHOLD,
        recent_papers=recent,
    )
