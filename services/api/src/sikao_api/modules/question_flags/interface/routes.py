from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import OperationAckV2
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import (
    get_current_user_v2,
    verify_csrf_v2,
)
from sikao_api.modules.question_flags.application.create import create_question_flag
from sikao_api.modules.question_flags.application.lifecycle import delete_question_flag, resolve_question_flag
from sikao_api.modules.question_flags.application.queries import list_question_flags
from sikao_api.modules.question_flags.interface.schemas import (
    FlagReasonV2,
    QuestionFlagCreateV2,
    QuestionFlagItemV2,
    QuestionFlagListV2,
)


router = APIRouter(prefix="/api/v2/practice", tags=["question-flags-v2"])


@router.post(
    "/questions/{question_id}/flag",
    response_model=QuestionFlagItemV2,
    dependencies=[Depends(get_current_user_v2), Depends(verify_csrf_v2)],
)
def post_question_flag(
    question_id: int,
    payload: QuestionFlagCreateV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> QuestionFlagItemV2:
    return create_question_flag(session, user=user, question_id=question_id, payload=payload)


@router.delete(
    "/questions/{question_id}/flag",
    response_model=OperationAckV2,
    dependencies=[Depends(get_current_user_v2), Depends(verify_csrf_v2)],
)
def remove_question_flag(
    question_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> OperationAckV2:
    return delete_question_flag(session, user=user, question_id=question_id)


@router.patch(
    "/questions/{question_id}/flag/resolve",
    response_model=QuestionFlagItemV2,
    dependencies=[Depends(get_current_user_v2), Depends(verify_csrf_v2)],
)
def patch_question_flag_resolve(
    question_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> QuestionFlagItemV2:
    return resolve_question_flag(session, user=user, question_id=question_id)


@router.get(
    "/flags",
    response_model=QuestionFlagListV2,
    dependencies=[Depends(get_current_user_v2)],
)
def get_question_flags(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    reason_filter: Annotated[FlagReasonV2 | None, Query(alias="reason")] = None,
) -> QuestionFlagListV2:
    return list_question_flags(session, user=user, reason_filter=reason_filter)
