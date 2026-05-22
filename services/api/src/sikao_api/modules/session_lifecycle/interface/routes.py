from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import ActiveSessionsResponseV2, SessionLifecycleResponseV2
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import get_current_user_v2
from sikao_api.modules.session_lifecycle.application.active_session_query import build_active_sessions
from sikao_api.modules.session_lifecycle.application.lifecycle_query import build_session_lifecycle


router = APIRouter(prefix="/api/v2/practice/sessions", tags=["session-lifecycle-v2"])


@router.get("/active", response_model=ActiveSessionsResponseV2, dependencies=[Depends(get_current_user_v2)])
def get_active_sessions(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ActiveSessionsResponseV2:
    return build_active_sessions(session, user=user)


@router.get("/{session_id}/lifecycle", response_model=SessionLifecycleResponseV2, dependencies=[Depends(get_current_user_v2)])
def get_session_lifecycle(
    session_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> SessionLifecycleResponseV2:
    return build_session_lifecycle(session, user=user, session_id=session_id)
