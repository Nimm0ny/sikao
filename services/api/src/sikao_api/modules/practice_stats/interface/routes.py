from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import UserV2
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import get_current_user_v2
from sikao_api.modules.practice_stats.application.cross import build_stats_cross
from sikao_api.modules.practice_stats.application.percentile import build_stats_percentile
from sikao_api.modules.practice_stats.application.realtime import build_realtime_stats
from sikao_api.modules.practice_stats.application.service import build_snapshot_stats
from sikao_api.modules.practice_stats.application.trend import build_stats_trend
from sikao_api.modules.practice_stats.interface.schemas import (
    DifficultyBucketV2,
    PeriodV2,
    PracticeStatsCrossResponseV2,
    PracticeStatsPercentileResponseV2,
    PracticeStatsResponseV2,
    PracticeStatsTrendResponseV2,
    PracticeTypeV2,
)


router = APIRouter(prefix="/api/v2/practice/stats", tags=["practice-stats-v2"], dependencies=[Depends(get_current_user_v2)])


@router.get("", response_model=PracticeStatsResponseV2)
def get_practice_stats(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    type_name: Annotated[PracticeTypeV2, Query(alias="type")],
) -> PracticeStatsResponseV2:
    return build_snapshot_stats(session, user=user, type_name=type_name)


@router.get("/realtime", response_model=PracticeStatsResponseV2)
def get_practice_stats_realtime(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    type_name: Annotated[PracticeTypeV2, Query(alias="type")],
    category: Annotated[str | None, Query(max_length=128)] = None,
) -> PracticeStatsResponseV2:
    return build_realtime_stats(session, user=user, type_name=type_name, category=category)


@router.get("/trend", response_model=PracticeStatsTrendResponseV2)
def get_practice_stats_trend(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    type_name: Annotated[PracticeTypeV2, Query(alias="type")],
    period: Annotated[PeriodV2, Query()] = "30d",
    category: Annotated[str | None, Query(max_length=128)] = None,
) -> PracticeStatsTrendResponseV2:
    return build_stats_trend(session, user=user, type_name=type_name, category=category, period=period)


@router.get("/percentile", response_model=PracticeStatsPercentileResponseV2)
def get_practice_stats_percentile(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    type_name: Annotated[PracticeTypeV2, Query(alias="type")],
    category: Annotated[str | None, Query(max_length=128)] = None,
) -> PracticeStatsPercentileResponseV2:
    return build_stats_percentile(session, user=user, type_name=type_name, category=category)


@router.get("/cross", response_model=PracticeStatsCrossResponseV2)
def get_practice_stats_cross(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    type_name: Annotated[PracticeTypeV2, Query(alias="type")],
    category: Annotated[str | None, Query(max_length=128)] = None,
    difficulty: Annotated[DifficultyBucketV2 | None, Query()] = None,
) -> PracticeStatsCrossResponseV2:
    return build_stats_cross(session, user=user, type_name=type_name, category=category, difficulty=difficulty)
