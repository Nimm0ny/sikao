from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.core.deps import get_app_settings
from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import AiQuestionsGenerateResponseV2
from sikao_api.db.session import get_db_session
from sikao_api.modules.ai_questions.application.service import AiQuestionsService
from sikao_api.modules.ai_questions.domain.errors import IDEMPOTENCY_KEY_REQUIRED
from sikao_api.modules.ai_questions.interface.schemas import (
    AiQuestionRequestDetailV2,
    AiQuestionsGenerateRequestV2,
)
from sikao_api.modules.identity.application.security_v2 import get_current_user_v2, verify_csrf_v2
from sikao_api.modules.system.application.errors import ValidationError

router = APIRouter(prefix="/api/v2/practice/ai-questions", tags=["ai-questions-v2"])


@router.post(
    "/generate",
    response_model=AiQuestionsGenerateResponseV2,
    dependencies=[Depends(get_current_user_v2), Depends(verify_csrf_v2)],
)
def generate_ai_questions(
    payload: AiQuestionsGenerateRequestV2,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> AiQuestionsGenerateResponseV2:
    if not idempotency_key:
        raise ValidationError("Idempotency-Key is required", code=IDEMPOTENCY_KEY_REQUIRED)
    return AiQuestionsService(session, settings).generate(
        user=user,
        config=payload.config,
        idempotency_key=idempotency_key,
        request_id=getattr(request.state, "request_id", None),
    )


@router.get(
    "/requests/{request_id}",
    response_model=AiQuestionRequestDetailV2,
    dependencies=[Depends(get_current_user_v2)],
)
def get_ai_question_request(
    request_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> AiQuestionRequestDetailV2:
    return AiQuestionsService(session, settings).get_request_detail(
        user=user,
        request_id=request_id,
    )
