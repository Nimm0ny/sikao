"""PR-6 + PR-8 MVP: progress dashboard endpoints + analytics event ingest.

PR-6:
  GET /api/v2/progress/weekly            Weekly summary (xingce + essay + tasks + streak)
  GET /api/v2/progress/accuracy-trend    Per-day accuracy for last N days

PR-8:
  POST /api/v2/analytics/event           Client-side event ingest (fire-and-forget, always 202)
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from sikao_api.db.session import get_db_session
from sikao_api.db import schemas
from sikao_api.db.models import User
from sikao_api.modules.auth.application.security import get_current_user, verify_csrf_token

router = APIRouter(tags=["progress-v2"])


@router.get("/api/v2/progress/weekly", response_model=schemas.WeeklyProgressSummaryV2)
def get_weekly_progress(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.WeeklyProgressSummaryV2:
    """PR-6: Weekly progress summary for the progress dashboard."""
    from sikao_api.modules.analytics.application.progress import get_weekly_progress as _get

    return _get(session, user_id=user.id)


@router.get("/api/v2/progress/accuracy-trend", response_model=schemas.AccuracyTrendResponseV2)
def get_accuracy_trend(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    days: int = Query(default=30, ge=7, le=180),
) -> schemas.AccuracyTrendResponseV2:
    """PR-6: Per-day accuracy trend for the last N days.

    days must be 7, 30, 90, or 180. 422 for other values.
    """
    from sikao_api.modules.analytics.application.progress import get_accuracy_trend as _get
    from sikao_api.modules.system.application.errors import ServiceError

    try:
        return _get(session, user_id=user.id, days=days)
    except ValueError as exc:
        raise ServiceError(422, str(exc)) from exc


@router.post(
    "/api/v2/analytics/event",
    response_model=schemas.AnalyticsEventAckV2,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(verify_csrf_token)],
)
def ingest_analytics_event(
    payload: schemas.AnalyticsEventPayloadV2,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.AnalyticsEventAckV2:
    """PR-8: Fire-and-forget client event ingest.

    Accepts any valid event. Currently logs to the server logger for
    processing by the analytics pipeline. Returns 202 always so that
    FE can send events without blocking the UI.
    """
    import logging

    logger = logging.getLogger("sikao.analytics")
    logger.info(
        "analytics_event user_id=%s event=%s session_id=%s properties_keys=%s",
        user.id,
        payload.event_name,
        payload.session_id,
        list(payload.properties.keys()),
    )
    return schemas.AnalyticsEventAckV2(received=True)
