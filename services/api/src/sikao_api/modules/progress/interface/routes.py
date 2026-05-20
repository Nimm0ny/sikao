from __future__ import annotations

from fastapi import APIRouter

from sikao_api.db.schemas_v2 import DashboardProgressResponseV2, OverviewResponseV2
from sikao_api.modules.progress.application.service import build_progress_leaf, build_progress_overview

router = APIRouter(prefix="/api/v2/dashboard/progress", tags=["progress-v2"])


@router.get("", response_model=DashboardProgressResponseV2)
def get_progress_overview() -> DashboardProgressResponseV2:
    return build_progress_overview()


@router.get("/trend", response_model=OverviewResponseV2)
def get_progress_trend() -> OverviewResponseV2:
    return build_progress_leaf("能力趋势", "/dashboard/progress/trend")


@router.get("/weakness", response_model=OverviewResponseV2)
def get_progress_weakness() -> OverviewResponseV2:
    return build_progress_leaf("弱项提醒", "/dashboard/progress/weakness")


@router.get("/diagnosis", response_model=OverviewResponseV2)
def get_progress_diagnosis() -> OverviewResponseV2:
    return build_progress_leaf("最近诊断", "/dashboard/progress/diagnosis")
