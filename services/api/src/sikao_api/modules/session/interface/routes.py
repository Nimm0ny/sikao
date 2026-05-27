from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from sikao_api.db.schemas_v2 import (
    OperationAckV2,
    PracticeAnswerFeedItemV2,
    PracticeAnswerFeedResponseV2,
    PracticeAnswerFlagRequestV2,
    PracticeAnswerUpsertRequestV2,
    PracticePersistentFlagRequestV2,
    PracticeSessionCreateRequestV2,
    PracticeSessionEnvelopeV2,
    PracticeSessionItemV2,
    PracticeSessionResultResponseV2,
)
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import get_current_user_v2, verify_csrf_v2
from sikao_api.modules.mock_exam.application.enforcer import resolve_force_submit_reason
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.modules.session.application.answer_flag_ops import (
    create_persistent_flag,
    set_answer_flag,
)
from sikao_api.modules.session.application.hooks import on_session_submit
from sikao_api.modules.session.application.service import SessionServiceV2
from sikao_api.modules.session.application.view_solution_ops import mark_view_solution
from sikao_api.db.models_v2 import PracticeSessionAnswerV2, PracticeSessionV2, UserV2

router = APIRouter(prefix="/api/v2/practice/sessions", tags=["session-v2"])
practice_router = APIRouter(prefix="/api/v2/practice", tags=["session-v2"])
_logger = logging.getLogger(__name__)


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
    request: Request,
    payload: PracticeAnswerUpsertRequestV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OperationAckV2:
    service = SessionServiceV2(session)
    practice_session = service.get_session(user=user, session_id=session_id)
    service.save_answers(
        practice_session=practice_session,
        answers=payload.answers,
        request_id=getattr(request.state, "request_id", None),
    )
    session.commit()
    return OperationAckV2(ok=True, status="saved")


@router.post(
    "/{session_id}/answers/{answer_id}/flag",
    response_model=PracticeSessionItemV2,
    dependencies=[Depends(verify_csrf_v2)],
)
def flag_answer(
    session_id: int,
    answer_id: int,
    payload: PracticeAnswerFlagRequestV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PracticeSessionItemV2:
    item = set_answer_flag(
        session,
        user=user,
        session_id=session_id,
        answer_id=answer_id,
        flagged=payload.flagged,
    )
    session.commit()
    return item


@router.post(
    "/{session_id}/answers/{answer_id}/view-solution",
    response_model=PracticeSessionItemV2,
    dependencies=[Depends(verify_csrf_v2)],
)
def view_solution(
    session_id: int,
    answer_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PracticeSessionItemV2:
    item = mark_view_solution(
        session,
        user=user,
        session_id=session_id,
        answer_id=answer_id,
    )
    session.commit()
    return item


@router.post(
    "/{session_id}/persistent-flag",
    response_model=PracticeSessionItemV2,
    dependencies=[Depends(verify_csrf_v2)],
)
def persistent_flag(
    session_id: int,
    payload: PracticePersistentFlagRequestV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PracticeSessionItemV2:
    item = create_persistent_flag(
        session,
        user=user,
        session_id=session_id,
        question_id=payload.question_id,
        reason=payload.reason,
    )
    session.commit()
    return item


@router.post("/{session_id}/submit", response_model=OperationAckV2, dependencies=[Depends(verify_csrf_v2)])
def submit_session(
    session_id: int,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OperationAckV2:
    service = SessionServiceV2(session)
    practice_session = service.get_session(user=user, session_id=session_id)
    force_submitted_reason = resolve_force_submit_reason(practice_session)
    service.submit(
        practice_session=practice_session,
        force_submitted_reason=force_submitted_reason,
    )
    if force_submitted_reason is not None:
        add_audit_log(
            session,
            user_id=user.id,
            actor_type="system",
            actor_id="mock_exam.submit_guard",
            action="mock_exam.force_submitted",
            target_type="practice_session_v2",
            target_id=practice_session.id,
            metadata={"reason": force_submitted_reason},
                request_id=getattr(request.state, "request_id", None),
                ip=None,
            )
    session.commit()
    on_session_submit(
        session_factory=request.app.state.db.session_factory,
        user_id=user.id,
        session_id=practice_session.id,
        request_id=getattr(request.state, "request_id", None),
        home_scheduler=getattr(request.app.state, "home_scheduler", None),
    )
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


@practice_router.get("/answers", response_model=PracticeAnswerFeedResponseV2)
def list_practice_answers(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    limit: int = Query(default=200, ge=1, le=200),
    include_confidence: bool = Query(default=False),
    include_duration: bool = Query(default=False),
) -> PracticeAnswerFeedResponseV2:
    base_stmt = (
        select(PracticeSessionAnswerV2)
        .join(PracticeSessionV2, PracticeSessionV2.id == PracticeSessionAnswerV2.session_id)
        .where(
            PracticeSessionV2.user_id == user.id,
            PracticeSessionAnswerV2.question_id.is_not(None),
            PracticeSessionV2.status == "submitted",
        )
    )
    rows = list(
        session.scalars(
            base_stmt.order_by(
                PracticeSessionAnswerV2.answered_at.desc(),
                PracticeSessionAnswerV2.id.desc(),
            ).limit(limit)
        )
    )
    total = int(session.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0)
    return PracticeAnswerFeedResponseV2(
        items=[
            PracticeAnswerFeedItemV2(
                question_id=row.question_id,
                session_id=row.session_id,
                is_correct=row.is_correct,
                answered_at=row.answered_at,
                # PracticeSessionAnswerV2 does not persist confidence yet.
                confidence=None if include_confidence else None,
                duration_seconds=row.duration_seconds if include_duration else None,
            )
            for row in rows
            if row.question_id is not None
        ],
        total=total,
        limit=limit,
    )
