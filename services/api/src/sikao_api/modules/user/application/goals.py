"""Phase 5.5 (fenbi-merge) — 用户目标分服务.

GET: 老 user 没 row → has_goal=False (前端引导设置), 不报错.
PUT: upsert 语义, 单 row per user (UNIQUE on user_id). 并发兼容: catch
IntegrityError + 重试 SELECT-then-UPDATE (review #3, 跨方言通用方案).
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from sikao_api.db.models import UserGoal
from sikao_api.db.schemas import UserGoalUpdateV2, UserGoalV2


def get_user_goal(session: Session, *, user_id: int) -> UserGoalV2:
    row = session.scalar(select(UserGoal).where(UserGoal.user_id == user_id))
    if row is None:
        return UserGoalV2(has_goal=False, target_score=None)
    return UserGoalV2(has_goal=True, target_score=row.target_score)


def upsert_user_goal(
    session: Session, *, user_id: int, payload: UserGoalUpdateV2
) -> UserGoalV2:
    """Upsert single row per user.

    Cross-dialect safe (no PG-specific ON CONFLICT). 极少并发场景下 (同一
    user 同时两次 PUT) IntegrityError → rollback partial state + 重试一次
    SELECT-then-UPDATE; 第二次必命中 row 走 update path. 真撞两次 race 直接
    抛 (调用方收 500), 触发监控.
    """
    row = session.scalar(select(UserGoal).where(UserGoal.user_id == user_id))
    if row is not None:
        row.target_score = payload.target_score
        session.flush()
        return UserGoalV2(has_goal=True, target_score=row.target_score)

    row = UserGoal(user_id=user_id, target_score=payload.target_score)
    session.add(row)
    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        existing = session.scalar(
            select(UserGoal).where(UserGoal.user_id == user_id)
        )
        if existing is None:
            raise  # 真撞 race, 抛给上游
        existing.target_score = payload.target_score
        session.flush()
        return UserGoalV2(has_goal=True, target_score=existing.target_score)
    return UserGoalV2(has_goal=True, target_score=row.target_score)
