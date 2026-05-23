from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import (
    ActiveSessionsResponseV2,
    SessionDiscardRequestV2,
    SessionHeartbeatRequestV2,
    SessionHeartbeatResponseV2,
    SessionLifecycleResponseV2,
)
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import get_current_user_v2, verify_csrf_v2
from sikao_api.modules.session_lifecycle.application.active_session_query import build_active_sessions
from sikao_api.modules.session_lifecycle.application.discard import discard_session
from sikao_api.modules.session_lifecycle.application.heartbeat import receive_heartbeat
from sikao_api.modules.session_lifecycle.application.lifecycle_query import build_session_lifecycle
from sikao_api.modules.session_lifecycle.application.pause_resume import pause_session, resume_session
from sikao_api.modules.session_lifecycle.application.start_endpoint import start_session


router = APIRouter(prefix="/api/v2/practice/sessions", tags=["session-lifecycle-v2"])


@router.get("/active", response_model=ActiveSessionsResponseV2, dependencies=[Depends(get_current_user_v2)])
def get_active_sessions(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ActiveSessionsResponseV2:
    return build_active_sessions(session, user=user)


@router.post("/{session_id}/start", response_model=SessionLifecycleResponseV2, dependencies=[Depends(get_current_user_v2), Depends(verify_csrf_v2)])
def post_session_start(
    session_id: int,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> SessionLifecycleResponseV2:
    result = start_session(session, user=user, session_id=session_id, request_id=getattr(request.state, "request_id", None))
    session.commit()
    return result


@router.post("/{session_id}/pause", response_model=SessionLifecycleResponseV2, dependencies=[Depends(get_current_user_v2), Depends(verify_csrf_v2)])
def post_session_pause(
    session_id: int,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> SessionLifecycleResponseV2:
    result = pause_session(session, user=user, session_id=session_id, request_id=getattr(request.state, "request_id", None))
    session.commit()
    return result


@router.post("/{session_id}/resume", response_model=SessionLifecycleResponseV2, dependencies=[Depends(get_current_user_v2), Depends(verify_csrf_v2)])
def post_session_resume(
    session_id: int,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> SessionLifecycleResponseV2:
    result = resume_session(session, user=user, session_id=session_id, request_id=getattr(request.state, "request_id", None))
    session.commit()
    return result


@router.post("/{session_id}/heartbeat", response_model=SessionHeartbeatResponseV2, dependencies=[Depends(get_current_user_v2), Depends(verify_csrf_v2)])
def post_session_heartbeat(
    session_id: int,
    payload: SessionHeartbeatRequestV2,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> SessionHeartbeatResponseV2:
    practice_session, server_ts = receive_heartbeat(
        session,
        user=user,
        session_id=session_id,
        current_question_id=payload.current_question_id,
        request_id=getattr(request.state, "request_id", None),
    )
    session.commit()
    return SessionHeartbeatResponseV2(server_ts=server_ts, status=practice_session.status)


@router.post("/{session_id}/discard", response_model=SessionLifecycleResponseV2, dependencies=[Depends(get_current_user_v2), Depends(verify_csrf_v2)])
def post_session_discard(
    session_id: int,
    payload: SessionDiscardRequestV2,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> SessionLifecycleResponseV2:
    result = discard_session(
        session,
        user=user,
        session_id=session_id,
        reason=payload.reason,
        request_id=getattr(request.state, "request_id", None),
    )
    session.commit()
    return result


@router.get("/{session_id}/lifecycle", response_model=SessionLifecycleResponseV2, dependencies=[Depends(get_current_user_v2)])
def get_session_lifecycle(
    session_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> SessionLifecycleResponseV2:
    return build_session_lifecycle(session, user=user, session_id=session_id)
