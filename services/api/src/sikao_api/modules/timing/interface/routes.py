from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import PracticeStatsTimingResponseV2, SessionTimingReportV2
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import get_current_user_v2, verify_csrf_v2
from sikao_api.modules.practice_stats.interface.schemas import PeriodV2
from sikao_api.modules.timing.application.event_recorder import record_events
from sikao_api.modules.timing.application.reporting import build_session_timing_report, build_timing_stats, get_question_timing_baseline
from sikao_api.modules.timing.interface.schemas import TimingBaselineResponseV2, TimingEventBatchAckV2, TimingEventBatchRequestV2


router = APIRouter(prefix="/api/v2/practice", tags=["timing-v2"])


@router.post(
    "/sessions/{session_id}/timing/events",
    response_model=TimingEventBatchAckV2,
    dependencies=[Depends(get_current_user_v2), Depends(verify_csrf_v2)],
)
def post_timing_events(
    session_id: int,
    payload: TimingEventBatchRequestV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> TimingEventBatchAckV2:
    result = record_events(
        session,
        user=user,
        session_id=session_id,
        payload=payload,
    )
    session.commit()
    return result


@router.get(
    "/questions/{question_id}/timing-baseline",
    response_model=TimingBaselineResponseV2,
    dependencies=[Depends(get_current_user_v2)],
)
def get_timing_baseline(
    question_id: int,
    session: Annotated[Session, Depends(get_db_session)],
) -> TimingBaselineResponseV2:
    return get_question_timing_baseline(session, question_id=question_id)


@router.get(
    "/sessions/{session_id}/timing-report",
    response_model=SessionTimingReportV2,
    dependencies=[Depends(get_current_user_v2)],
)
def get_timing_report(
    session_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> SessionTimingReportV2:
    return build_session_timing_report(session, user=user, session_id=session_id)


@router.get(
    "/stats/timing",
    response_model=PracticeStatsTimingResponseV2,
    dependencies=[Depends(get_current_user_v2)],
)
def get_timing_stats(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    type_name: str = Query(alias="type"),
    period: PeriodV2 = Query(default="30d"),
    category: str | None = Query(default=None),
) -> PracticeStatsTimingResponseV2:
    return build_timing_stats(
        session,
        user=user,
        type_name=type_name,
        period=period,
        category=category,
    )
