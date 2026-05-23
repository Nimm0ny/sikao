from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from sikao_api.db.schemas_v2 import (
    QuestionReportAdminItemV2,
    QuestionReportAdminListResponseV2,
    QuestionReportAdminUpdateRequestV2,
    QuestionReportApplyFixRequestV2,
)
from sikao_api.db.session import get_db_session
from sikao_api.modules.auth.application.security import (
    get_admin_principal,
    verify_csrf_token_if_cookie_auth,
)
from sikao_api.modules.question_reports.application.admin_service import (
    QuestionReportAdminService,
)
from sikao_api.modules.question_reports.domain.types import (
    QuestionReportCategory,
    QuestionReportStatus,
)

router = APIRouter(prefix="/api/v2/admin/practice", tags=["question-reports-admin-v2"])


@router.get("/reports", response_model=QuestionReportAdminListResponseV2)
def list_question_reports_admin(
    admin_username: Annotated[str, Depends(get_admin_principal)],
    session: Annotated[Session, Depends(get_db_session)],
    status: Annotated[QuestionReportStatus | None, Query()] = None,
    category: Annotated[QuestionReportCategory | None, Query()] = None,
    question_id: Annotated[int | None, Query(alias="question_id")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> QuestionReportAdminListResponseV2:
    _ = admin_username
    return QuestionReportAdminService(session).list_reports(
        status=status,
        category=category,
        question_id=question_id,
        limit=limit,
        offset=offset,
    )


@router.patch(
    "/reports/{report_id}",
    response_model=QuestionReportAdminItemV2,
    dependencies=[Depends(verify_csrf_token_if_cookie_auth)],
)
def patch_question_report_admin(
    report_id: int,
    payload: QuestionReportAdminUpdateRequestV2,
    request: Request,
    admin_username: Annotated[str, Depends(get_admin_principal)],
    session: Annotated[Session, Depends(get_db_session)],
) -> QuestionReportAdminItemV2:
    return QuestionReportAdminService(session).update_status(
        admin_username=admin_username,
        report_id=report_id,
        payload=payload,
        request_id=getattr(request.state, "request_id", None),
    )


@router.post(
    "/reports/{report_id}/apply-fix",
    response_model=QuestionReportAdminItemV2,
    dependencies=[Depends(verify_csrf_token_if_cookie_auth)],
)
def post_question_report_apply_fix_admin(
    report_id: int,
    payload: QuestionReportApplyFixRequestV2,
    request: Request,
    admin_username: Annotated[str, Depends(get_admin_principal)],
    session: Annotated[Session, Depends(get_db_session)],
) -> QuestionReportAdminItemV2:
    return QuestionReportAdminService(session).apply_fix(
        admin_username=admin_username,
        report_id=report_id,
        payload=payload,
        request_id=getattr(request.state, "request_id", None),
    )
