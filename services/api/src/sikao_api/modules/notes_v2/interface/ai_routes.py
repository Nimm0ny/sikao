from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.core.deps import get_app_settings
from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import (
    NoteAiSummaryConfirmRequestV2,
    NoteAiSummaryConfirmResponseV2,
    NoteAiSummaryPreviewResponseV2,
)
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import get_current_user_v2, verify_csrf_v2
from sikao_api.modules.llm.application.llm.prompts.note_summary_cards import PROMPT_VERSION as NOTE_SUMMARY_PROMPT_VERSION
from sikao_api.modules.notes_v2.application.ai_summary_service import AiSummaryServiceV2


router = APIRouter(prefix="/api/v2/notes", tags=["notes-ai-v2"])


@router.post("/{note_id}/ai-summary", response_model=NoteAiSummaryPreviewResponseV2, dependencies=[Depends(verify_csrf_v2)])
async def generate_ai_summary(
    note_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> NoteAiSummaryPreviewResponseV2:
    return await AiSummaryServiceV2(session).generate_preview(
        user=user,
        note_id=note_id,
        settings=settings,
    )


@router.post(
    "/{note_id}/ai-summary/confirm",
    response_model=NoteAiSummaryConfirmResponseV2,
    dependencies=[Depends(verify_csrf_v2)],
)
def confirm_ai_summary(
    note_id: int,
    payload: NoteAiSummaryConfirmRequestV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> NoteAiSummaryConfirmResponseV2:
    response = AiSummaryServiceV2(session).confirm_cards(
        user=user,
        note_id=note_id,
        cards=payload.cards,
        prompt_version=NOTE_SUMMARY_PROMPT_VERSION,
    )
    session.commit()
    return response
