from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import UserV2
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import get_current_user_v2, verify_csrf_v2
from sikao_api.modules.timing.application.event_recorder import record_events
from sikao_api.modules.timing.interface.schemas import TimingEventBatchAckV2, TimingEventBatchRequestV2


router = APIRouter(prefix="/api/v2/practice/sessions", tags=["timing-v2"])


@router.post(
    "/{session_id}/timing/events",
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
