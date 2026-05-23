from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, Request, status
from fastapi.responses import Response as RawResponse
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import MockExamComparisonResponseV2, MockExamCountdownResponseV2, MockExamCreateRequestV2, MockExamCreateResponseV2, MockExamHistoryResponseV2
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import get_current_user_v2, verify_csrf_v2
from sikao_api.modules.mock_exam.application.countdown import get_mock_exam_countdown
from sikao_api.modules.mock_exam.application.service import build_mock_exam_comparison, create_mock_exam, list_mock_exam_history
from sikao_api.modules.mock_exam.domain.errors import IDEMPOTENCY_KEY_REQUIRED
from sikao_api.modules.system.application.errors import ValidationError
from sikao_api.modules.system.application.idempotency import build_request_hash, load_idempotent_response, store_idempotent_response


router = APIRouter(prefix="/api/v2/practice", tags=["mock-exam-v2"])


@router.post(
    "/mock-exams",
    response_model=MockExamCreateResponseV2,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_user_v2), Depends(verify_csrf_v2)],
)
def post_create_mock_exam(
    payload: MockExamCreateRequestV2,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> MockExamCreateResponseV2 | RawResponse:
    if not idempotency_key:
        raise ValidationError("Idempotency-Key is required", code=IDEMPOTENCY_KEY_REQUIRED)

    request_hash = build_request_hash(payload.model_dump(mode="json"))
    replay = load_idempotent_response(
        session,
        scope=f"mock_exam_create:{user.id}",
        key=idempotency_key,
        request_hash=request_hash,
    )
    if replay is not None:
        code, body = replay
        return RawResponse(content=body, media_type="application/json", status_code=code)

    result = create_mock_exam(
        session,
        user=user,
        payload=payload,
        request_id=getattr(request.state, "request_id", None),
        idempotency_key=idempotency_key,
    )
    store_idempotent_response(
        session,
        scope=f"mock_exam_create:{user.id}",
        key=idempotency_key,
        request_hash=request_hash,
        response_code=status.HTTP_201_CREATED,
        response_body=result.model_dump_json(by_alias=True).encode("utf-8"),
    )
    session.commit()
    return result


@router.get(
    "/sessions/{session_id}/countdown",
    response_model=MockExamCountdownResponseV2,
    dependencies=[Depends(get_current_user_v2)],
)
def get_session_countdown(
    session_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> MockExamCountdownResponseV2:
    return get_mock_exam_countdown(session, user=user, session_id=session_id)


@router.get(
    "/mock-exams/history",
    response_model=MockExamHistoryResponseV2,
    dependencies=[Depends(get_current_user_v2)],
)
def get_mock_exam_history(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    period: str = Query(default="30d"),
    paper_code: str | None = Query(default=None),
) -> MockExamHistoryResponseV2:
    return list_mock_exam_history(
        session,
        user=user,
        period=period,
        paper_code=paper_code,
    )


@router.get(
    "/mock-exams/{session_id}/comparison",
    response_model=MockExamComparisonResponseV2,
    dependencies=[Depends(get_current_user_v2)],
)
def get_mock_exam_comparison(
    session_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> MockExamComparisonResponseV2:
    return build_mock_exam_comparison(session, user=user, session_id=session_id)
