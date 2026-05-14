"""SIKAO Wave 8 Phase B: Home block 3 "薄弱模块" 数据源.

GET /api/v2/wrong-questions/weakness?limit=2 用此 service. 算出该 user
top-N 薄弱学科 (行测 5 模块 + 申论 — 但 MVP 只考虑行测 5 模块, 跟 heatmap
对齐).

算法 (Phase B v1, 简单可解释):
  score = wrong_rate × (1 - completion_rate) × subject_weight × 100
  - wrong_rate       : 该 subject 用户错题数 / 该 subject 用户总答题数 (0-1)
  - completion_rate  : 该 subject 用户已答题数 / 该 subject 全库题目数 (0-1)
  - subject_weight   : 默认 1.0, hardcode (v2 接 user_goals.module_targets 后再调)
  - 答题 0 题 → wrong_rate=0 → score=0 (新用户冷启不推荐, 让 cold_start path 兜)

排序 desc, top limit 行返. 学科 bucket 复用 wrong_book_heatmap._bucket_subject_short
(行测 5 短名固定顺序).

Fail-Fast: limit ∉ [1, 5] → ValidationError 422 (route 层兜).

suggested_action 三态 (按 wrong_rate 分):
  - wrong_rate >= 0.5  → "重做错题"
  - wrong_rate >= 0.3  → "继续复盘"
  - else               → "去练习"  (默认 / 完成率低)
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from sikao_api.db import schemas
from sikao_api.db.models import (
    PracticeSession,
    PracticeSessionAnswer,
    Question,
)
from sikao_api.modules.system.application.errors import ValidationError
from sikao_api.modules.wrong_book.application.wrong_book_heatmap import (
    _HEATMAP_SUBJECT_KEYWORDS,
    _HEATMAP_SUBJECT_ORDER,
    _bucket_subject_short,
)

_DEFAULT_SUBJECT_WEIGHT = 1.0
_WEAKNESS_LIMIT_MIN = 1
_WEAKNESS_LIMIT_MAX = 5

_THRESHOLD_REDO = 0.5
_THRESHOLD_REVIEW = 0.3
_ACTION_REDO = "重做错题"
_ACTION_REVIEW = "继续复盘"
_ACTION_PRACTICE = "去练习"


def _utc_now_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _suggested_action(wrong_rate: float) -> str:
    """Map wrong_rate → 三态 action label (FE 显示用)."""
    if wrong_rate >= _THRESHOLD_REDO:
        return _ACTION_REDO
    if wrong_rate >= _THRESHOLD_REVIEW:
        return _ACTION_REVIEW
    return _ACTION_PRACTICE


def compute_weakness(
    session: Session,
    *,
    user_id: int,
    limit: int = 2,
) -> schemas.WeakModuleListResponse:
    """Top-N 薄弱模块. score 降序排, limit 截.

    Fail-Fast: limit ∉ [1, 5] → ValidationError 422.
    """
    if limit < _WEAKNESS_LIMIT_MIN or limit > _WEAKNESS_LIMIT_MAX:
        raise ValidationError(
            f"limit must be in [{_WEAKNESS_LIMIT_MIN}, {_WEAKNESS_LIMIT_MAX}]",
            code="invalid_limit",
        )

    user_buckets = _query_user_answer_buckets(session, user_id=user_id)
    total_buckets = _query_total_question_buckets(session)
    modules = _build_module_scores(user_buckets=user_buckets, total_buckets=total_buckets)
    modules.sort(key=lambda m: m.score, reverse=True)
    return schemas.WeakModuleListResponse(
        modules=modules[:limit],
        generated_at=_utc_now_naive(),
    )


def _query_user_answer_buckets(
    session: Session, *, user_id: int
) -> dict[schemas.WrongBookHeatmapSubject, tuple[int, int]]:
    """User 答过的 (subject_short) → (wrong_count, total_count).

    JOIN Question + Question.subject is_not None. 应用层 bucket subject_short.
    """
    stmt = (
        select(
            Question.subject,
            PracticeSessionAnswer.is_correct,
            func.count(PracticeSessionAnswer.id),
        )
        .join(Question, PracticeSessionAnswer.question_id == Question.id)
        .join(
            PracticeSession, PracticeSessionAnswer.session_id == PracticeSession.id
        )
        .where(
            PracticeSession.user_id == user_id,
            Question.subject.is_not(None),
        )
        .group_by(Question.subject, PracticeSessionAnswer.is_correct)
    )
    wrong: dict[schemas.WrongBookHeatmapSubject, int] = {}
    total: dict[schemas.WrongBookHeatmapSubject, int] = {}
    for subject_raw, is_correct, count in session.execute(stmt).all():
        short = _bucket_subject_short(subject_raw)
        if short is None:
            continue
        total[short] = total.get(short, 0) + int(count)
        if not is_correct:
            wrong[short] = wrong.get(short, 0) + int(count)
    return {
        short: (wrong.get(short, 0), total.get(short, 0))
        for short in _HEATMAP_SUBJECT_ORDER
    }


def _query_total_question_buckets(
    session: Session,
) -> dict[schemas.WrongBookHeatmapSubject, int]:
    """全库 question 按 subject_short bucket 计数 (completion_rate 分母)."""
    stmt = (
        select(Question.subject, func.count(Question.id))
        .where(Question.subject.is_not(None), Question.enabled.is_(True))
        .group_by(Question.subject)
    )
    totals: dict[schemas.WrongBookHeatmapSubject, int] = {}
    for subject_raw, count in session.execute(stmt).all():
        short = _bucket_subject_short(subject_raw)
        if short is None:
            continue
        totals[short] = totals.get(short, 0) + int(count)
    return totals


def _build_module_scores(
    *,
    user_buckets: dict[schemas.WrongBookHeatmapSubject, tuple[int, int]],
    total_buckets: dict[schemas.WrongBookHeatmapSubject, int],
) -> list[schemas.WeakModule]:
    """组装每 subject 的 WeakModule (score / wrong_rate / completion_rate)."""
    modules: list[schemas.WeakModule] = []
    for subject in _HEATMAP_SUBJECT_ORDER:
        wrong_count, user_total = user_buckets.get(subject, (0, 0))
        bank_total = total_buckets.get(subject, 0)
        wrong_rate = (wrong_count / user_total) if user_total > 0 else 0.0
        completion_rate = (
            (user_total / bank_total) if bank_total > 0 else 0.0
        )
        # cap completion_rate at 1.0 (用户重做错题会让 user_total 超过 bank).
        completion_rate = min(completion_rate, 1.0)
        score = (
            wrong_rate
            * (1.0 - completion_rate)
            * _DEFAULT_SUBJECT_WEIGHT
            * 100.0
        )
        modules.append(
            schemas.WeakModule(
                subject=subject,
                score=round(score, 2),
                wrong_rate=round(wrong_rate, 4),
                completion_rate=round(completion_rate, 4),
                suggested_action=_suggested_action(wrong_rate),
            )
        )
    return modules


# Re-export keywords so callers don't need direct heatmap module import.
__all__ = ["compute_weakness", "_HEATMAP_SUBJECT_KEYWORDS"]
