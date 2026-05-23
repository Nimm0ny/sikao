from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import (
    OperationAckV2,
    QuestionReportCreateRequestV2,
    QuestionReportEnvelopeV2,
    QuestionReportListResponseV2,
    QuestionReportUpdateRequestV2,
)
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import (
    get_current_user_v2,
    verify_csrf_v2,
)
from sikao_api.modules.question_reports.application.service import QuestionReportService

router = APIRouter(prefix="/api/v2/practice", tags=["question-reports-v2"])


@router.post(
    "/questions/{question_id}/reports",
    response_model=QuestionReportEnvelopeV2,
    dependencies=[Depends(verify_csrf_v2)],
)
def post_question_report(
    question_id: int,
    payload: QuestionReportCreateRequestV2,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> QuestionReportEnvelopeV2:
    return QuestionReportService(session).create_report(
        user=user,
        question_id=question_id,
        payload=payload,
        request_id=getattr(request.state, "request_id", None),
    )


@router.get(
    "/questions/{question_id}/reports",
    response_model=QuestionReportListResponseV2,
)
def get_question_reports(
    question_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> QuestionReportListResponseV2:
    return QuestionReportService(session).list_user_reports(
        user=user,
        question_id=question_id,
    )


@router.patch(
    "/reports/{report_id}",
    response_model=QuestionReportEnvelopeV2,
    dependencies=[Depends(verify_csrf_v2)],
)
def patch_question_report(
    report_id: int,
    payload: QuestionReportUpdateRequestV2,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> QuestionReportEnvelopeV2:
    return QuestionReportService(session).update_pending(
        user=user,
        report_id=report_id,
        payload=payload,
        request_id=getattr(request.state, "request_id", None),
    )


@router.delete(
    "/reports/{report_id}",
    response_model=OperationAckV2,
    dependencies=[Depends(verify_csrf_v2)],
)
def delete_question_report(
    report_id: int,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OperationAckV2:
    return QuestionReportService(session).soft_delete_pending(
        user=user,
        report_id=report_id,
        request_id=getattr(request.state, "request_id", None),
    )
