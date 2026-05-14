"""Phase 5.2 + 5.5 (fenbi-merge) — 用户中心 /me/* endpoints.

  GET  /api/v2/me/predicted-score   预测分 (D4 加权算法)
  GET  /api/v2/me/goals             用户目标分 (D5 minimal: target_score)
  PUT  /api/v2/me/goals             upsert 目标分 (target_score 0-150)

所有 endpoint 需登录. /me/* 命名空间预留: 后续 follow-up 加 module_targets /
exam_track / 击败 % 等都挂这里, 不再污染 /papers 或 /dashboard 路由.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from sikao_api.db.session import get_db_session
from sikao_api.db import schemas
from sikao_api.db.models import User
from sikao_api.modules.analytics.application.predicted_score import get_predicted_score
from sikao_api.modules.auth.application.security import get_current_user
from sikao_api.modules.user.application.goals import get_user_goal, upsert_user_goal

router = APIRouter(prefix="/api/v2/me", tags=["me-v2"])


@router.get("/predicted-score", response_model=schemas.PredictedScoreV2)
def me_predicted_score(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.PredictedScoreV2:
    return get_predicted_score(session, user_id=user.id)


@router.get("/goals", response_model=schemas.UserGoalV2)
def me_get_goals(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.UserGoalV2:
    return get_user_goal(session, user_id=user.id)


@router.put("/goals", response_model=schemas.UserGoalV2)
def me_put_goals(
    payload: schemas.UserGoalUpdateV2,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.UserGoalV2:
    return upsert_user_goal(session, user_id=user.id, payload=payload)


@router.get("/onboarding-status", response_model=schemas.OnboardingStatusV2)
def me_onboarding_status(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.OnboardingStatusV2:
    """PR-1: Check whether current user has completed onboarding.

    Returns has_goal (UserGoal row exists) + has_exam (any UserExam row exists)
    + is_onboarded (both). FE uses this on /dashboard mount to redirect to
    /study/onboarding when is_onboarded=False.
    """
    from sikao_api.modules.user.application.onboarding import get_onboarding_status

    return get_onboarding_status(session, user_id=user.id)
