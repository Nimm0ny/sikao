from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import (
    DashboardContinueResponseV2,
    DashboardFullPlanResponseV2,
    DashboardReviewResponseV2,
    DashboardTodayCompletionResponseV2,
    DashboardTodayResponseV2,
    DashboardWeeklyAdjustRequestV2,
    DashboardWeeklyPlanResponseV2,
    OverviewResponseV2,
    PlanReadV2,
)
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import get_current_user_v2, verify_csrf_v2
from sikao_api.modules.planning.application.service import (
    build_dashboard_continue,
    build_dashboard_full_plan,
    build_dashboard_overview,
    build_dashboard_review,
    build_dashboard_today,
    build_dashboard_today_completion,
    build_dashboard_weekly_plan,
    get_dashboard_weekly_goal as load_dashboard_weekly_goal,
    update_dashboard_weekly_adjust,
)
from sikao_api.modules.progress.application.aggregates import today_cn

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


@router.get("/today/continue", response_model=DashboardContinueResponseV2)
def get_dashboard_today_continue(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> DashboardContinueResponseV2:
    return build_dashboard_continue(session, user=user)


@router.get("/today/review", response_model=DashboardReviewResponseV2)
def get_dashboard_today_review(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> DashboardReviewResponseV2:
    return build_dashboard_review(session, user=user)


@router.get("/weekly-plan", response_model=DashboardWeeklyPlanResponseV2)
def get_dashboard_weekly_plan(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    anchor_date: date | None = Query(default=None, alias="anchorDate"),
) -> DashboardWeeklyPlanResponseV2:
    return build_dashboard_weekly_plan(session, user=user, anchor_date=anchor_date)


@router.get("/weekly-plan/goal", response_model=PlanReadV2)
def get_dashboard_weekly_goal(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PlanReadV2:
    return load_dashboard_weekly_goal(session, user=user)


@router.get("/weekly-plan/today-completion", response_model=DashboardTodayCompletionResponseV2)
def get_dashboard_weekly_completion(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> DashboardTodayCompletionResponseV2:
    return build_dashboard_today_completion(session, user=user)


@router.put("/weekly-plan/adjust", response_model=PlanReadV2, dependencies=[Depends(verify_csrf_v2)])
def put_dashboard_weekly_adjust(
    payload: DashboardWeeklyAdjustRequestV2,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PlanReadV2:
    result = update_dashboard_weekly_adjust(
        session,
        user=user,
        payload=payload,
        request_id=getattr(request.state, "request_id", None),
        ip=request.client.host if request.client else None,
    )
    session.commit()
    return result


@router.get("/full-plan", response_model=DashboardFullPlanResponseV2)
def get_dashboard_full_plan(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    view: str = "today",
    anchor_date: date | None = Query(default=None, alias="anchorDate"),
) -> DashboardFullPlanResponseV2:
    return build_dashboard_full_plan(
        session,
        user=user,
        view=view,
        anchor_date=anchor_date or today_cn(),
    )
