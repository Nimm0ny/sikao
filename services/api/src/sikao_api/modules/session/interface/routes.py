from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from sikao_api.db.schemas_v2 import OperationAckV2, PracticeAnswerUpsertRequestV2, PracticeSessionCreateRequestV2, PracticeSessionEnvelopeV2, PracticeSessionResultResponseV2
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import get_current_user_v2, verify_csrf_v2
from sikao_api.modules.session.application.service import SessionServiceV2
from sikao_api.db.models_v2 import UserV2

router = APIRouter(prefix="/api/v2/practice/sessions", tags=["session-v2"])


@router.post("", response_model=PracticeSessionEnvelopeV2, dependencies=[Depends(verify_csrf_v2)])
def create_session(
    payload: PracticeSessionCreateRequestV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PracticeSessionEnvelopeV2:
    service = SessionServiceV2(session)
    practice_session = service.create_session(user=user, payload=payload)
    session.commit()
    session.refresh(practice_session)
    return service.build_session_response(practice_session=practice_session)


@router.get("/{session_id}", response_model=PracticeSessionEnvelopeV2)
def get_session(
    session_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PracticeSessionEnvelopeV2:
    service = SessionServiceV2(session)
    practice_session = service.get_session(user=user, session_id=session_id)
    return service.build_session_response(practice_session=practice_session)


@router.post("/{session_id}/answers", response_model=OperationAckV2, dependencies=[Depends(verify_csrf_v2)])
def save_answers(
    session_id: int,
    payload: PracticeAnswerUpsertRequestV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OperationAckV2:
    service = SessionServiceV2(session)
    practice_session = service.get_session(user=user, session_id=session_id)
    service.save_answers(practice_session=practice_session, answers=payload.answers)
    session.commit()
    return OperationAckV2(ok=True, status="saved")


@router.post("/{session_id}/submit", response_model=OperationAckV2, dependencies=[Depends(verify_csrf_v2)])
def submit_session(
    session_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OperationAckV2:
    service = SessionServiceV2(session)
    practice_session = service.get_session(user=user, session_id=session_id)
    service.submit(practice_session=practice_session)
    session.commit()
    return OperationAckV2(ok=True, status="submitted")


@router.get("/{session_id}/result", response_model=PracticeSessionResultResponseV2)
def get_result(
    session_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PracticeSessionResultResponseV2:
    service = SessionServiceV2(session)
    practice_session = service.get_session(user=user, session_id=session_id)
    return service.build_result_response(practice_session=practice_session)
