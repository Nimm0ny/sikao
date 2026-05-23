from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.core.deps import get_app_settings
from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import DailyPracticeResponseV2, PracticeSessionEnvelopeV2
from sikao_api.db.session import get_db_session
from sikao_api.modules.daily_practice.application.service import (
    get_or_create_daily,
    list_daily_history,
    start_daily,
)
from sikao_api.modules.identity.application.security_v2 import (
    get_current_user_v2,
    verify_csrf_v2,
)

router = APIRouter(prefix="/api/v2/practice/daily", tags=["daily-practice-v2"])


@router.get(
    "",
    response_model=DailyPracticeResponseV2,
    dependencies=[Depends(get_current_user_v2)],
)
def get_daily_practice(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    type: Literal["xingce", "essay"] = Query(),
) -> DailyPracticeResponseV2:
    return get_or_create_daily(
        session,
        settings=settings,
        user=user,
        type_name=type,
    )


@router.post(
    "/{daily_id}/start",
    response_model=PracticeSessionEnvelopeV2,
    dependencies=[Depends(get_current_user_v2), Depends(verify_csrf_v2)],
)
def start_daily_practice(
    daily_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PracticeSessionEnvelopeV2:
    return start_daily(session, user=user, daily_id=daily_id)


@router.get(
    "/history",
    response_model=list[DailyPracticeResponseV2],
    dependencies=[Depends(get_current_user_v2)],
)
def get_daily_practice_history(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    period: Literal["7d", "30d"] = Query(default="7d"),
    type: Literal["xingce", "essay"] | None = Query(default=None),
) -> list[DailyPracticeResponseV2]:
    return list_daily_history(
        session,
        user=user,
        period=period,
        type_name=type,
    )
