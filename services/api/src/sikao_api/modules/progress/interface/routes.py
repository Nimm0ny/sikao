from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import (
    DashboardProgressResponseV2,
    ProgressDiagnosisResponseV2,
    ProgressTimeseriesResponseV2,
    ProgressWeaknessResponseV2,
)
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import get_current_user_v2
from sikao_api.modules.progress.application.service import (
    build_progress_diagnosis,
    build_progress_overview,
    build_progress_timeseries,
    build_progress_weakness,
)

router = APIRouter(
    prefix="/api/v2/dashboard/progress",
    tags=["progress-v2"],
    dependencies=[Depends(get_current_user_v2)],
)


@router.get("", response_model=DashboardProgressResponseV2)
def get_progress_overview(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    plan_id: int | None = None,
) -> DashboardProgressResponseV2:
    return build_progress_overview(session, user=user, plan_id=plan_id)


@router.get("/timeseries", response_model=ProgressTimeseriesResponseV2)
def get_progress_timeseries(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    from_date: Annotated[date, Query(alias="from")],
    to_date: Annotated[date, Query(alias="to")],
    granularity: str = "day",
) -> ProgressTimeseriesResponseV2:
    return build_progress_timeseries(
        session,
        user=user,
        from_date=from_date,
        to_date=to_date,
        granularity=granularity,
    )


@router.get("/weakness", response_model=ProgressWeaknessResponseV2)
def get_progress_weakness(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ProgressWeaknessResponseV2:
    return build_progress_weakness(session, user=user)


@router.get("/diagnosis", response_model=ProgressDiagnosisResponseV2)
def get_progress_diagnosis(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ProgressDiagnosisResponseV2:
    return build_progress_diagnosis(session, user=user)
