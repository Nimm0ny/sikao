from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import (
    DashboardTodayResponseV2,
    DashboardWeeklyPlanResponseV2,
    OverviewResponseV2,
)
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import get_current_user_v2
from sikao_api.modules.planning.application.service import (
    build_dashboard_continue,
    build_dashboard_overview,
    build_dashboard_today,
    build_dashboard_today_leaf,
    build_dashboard_weekly_leaf,
    build_dashboard_weekly_plan,
)

router = APIRouter(
    prefix="/api/v2/dashboard",
    tags=["planning-v2"],
    dependencies=[Depends(get_current_user_v2)],
)


@router.get("/overview", response_model=OverviewResponseV2)
def get_dashboard_overview(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OverviewResponseV2:
    return build_dashboard_overview(session, user=user)


@router.get("/today", response_model=DashboardTodayResponseV2)
def get_dashboard_today(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> DashboardTodayResponseV2:
    return build_dashboard_today(session, user=user)


@router.get("/today/must-do", response_model=OverviewResponseV2)
def get_dashboard_today_must_do(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OverviewResponseV2:
    return build_dashboard_today_leaf(session, user=user, key="practice", title="今日必做")


@router.get("/today/continue", response_model=OverviewResponseV2)
def get_dashboard_today_continue(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OverviewResponseV2:
    return build_dashboard_continue(session, user=user)


@router.get("/today/review", response_model=OverviewResponseV2)
def get_dashboard_today_review(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OverviewResponseV2:
    return build_dashboard_today_leaf(session, user=user, key="review_wrong", title="推荐复盘")


@router.get("/weekly-plan", response_model=DashboardWeeklyPlanResponseV2)
def get_dashboard_weekly_plan(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> DashboardWeeklyPlanResponseV2:
    return build_dashboard_weekly_plan(session, user=user)


@router.get("/weekly-plan/goal", response_model=OverviewResponseV2)
def get_dashboard_weekly_goal(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OverviewResponseV2:
    return build_dashboard_weekly_leaf(session, user=user, key="goal", title="本周目标")


@router.get("/weekly-plan/today-completion", response_model=OverviewResponseV2)
def get_dashboard_weekly_completion(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OverviewResponseV2:
    return build_dashboard_weekly_leaf(
        session,
        user=user,
        key="completion",
        title="今日完成度",
    )


@router.get("/weekly-plan/adjust", response_model=OverviewResponseV2)
def get_dashboard_weekly_adjust(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OverviewResponseV2:
    return build_dashboard_weekly_leaf(session, user=user, key="adjust", title="调整计划")
