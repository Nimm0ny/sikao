from __future__ import annotations

from fastapi import APIRouter

from sikao_api.db.schemas_v2 import DashboardTodayResponseV2, DashboardWeeklyPlanResponseV2, OverviewResponseV2
from sikao_api.modules.planning.application.service import build_dashboard_overview, build_dashboard_today, build_dashboard_weekly_plan

router = APIRouter(prefix="/api/v2/dashboard", tags=["planning-v2"])


@router.get("/overview", response_model=OverviewResponseV2)
def get_dashboard_overview() -> OverviewResponseV2:
    return build_dashboard_overview()


@router.get("/today", response_model=DashboardTodayResponseV2)
def get_dashboard_today() -> DashboardTodayResponseV2:
    return build_dashboard_today()


@router.get("/today/must-do", response_model=OverviewResponseV2)
def get_dashboard_today_must_do() -> OverviewResponseV2:
    return build_dashboard_overview()


@router.get("/today/continue", response_model=OverviewResponseV2)
def get_dashboard_today_continue() -> OverviewResponseV2:
    return build_dashboard_overview()


@router.get("/today/review", response_model=OverviewResponseV2)
def get_dashboard_today_review() -> OverviewResponseV2:
    return build_dashboard_overview()


@router.get("/weekly-plan", response_model=DashboardWeeklyPlanResponseV2)
def get_dashboard_weekly_plan() -> DashboardWeeklyPlanResponseV2:
    return build_dashboard_weekly_plan()


@router.get("/weekly-plan/goal", response_model=OverviewResponseV2)
def get_dashboard_weekly_goal() -> OverviewResponseV2:
    return build_dashboard_overview()


@router.get("/weekly-plan/today-completion", response_model=OverviewResponseV2)
def get_dashboard_weekly_completion() -> OverviewResponseV2:
    return build_dashboard_overview()


@router.get("/weekly-plan/adjust", response_model=OverviewResponseV2)
def get_dashboard_weekly_adjust() -> OverviewResponseV2:
    return build_dashboard_overview()
