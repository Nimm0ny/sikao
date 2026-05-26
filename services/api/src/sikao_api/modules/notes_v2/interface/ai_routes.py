from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.core.deps import get_app_settings
from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import (
    NoteAiSummaryConfirmRequestV2,
    NoteAiSummaryConfirmResponseV2,
    NoteAiSummaryPreviewResponseV2,
    NoteWeeklyReviewGenerateRequestV2,
)
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import get_current_user_v2, verify_csrf_v2
from sikao_api.modules.llm.application.idempotency import (
    build_idempotent_request_hash,
    claim_idempotency_key,
    get_replay,
    release_idempotency_claim,
    store_replay,
    validate_idempotency_key,
)
from sikao_api.modules.llm.application.llm.prompts.note_summary_cards import (
    PROMPT_VERSION as NOTE_SUMMARY_PROMPT_VERSION,
)
from sikao_api.modules.notes_v2.application.ai_summary_service import AiSummaryServiceV2
from sikao_api.modules.notes_v2.application.weekly_review_service import (
    WeeklyReviewGenerationPrepV2,
    WeeklyReviewServiceV2,
)
from sikao_api.modules.system.application.errors import ServiceError


router = APIRouter(prefix="/api/v2/notes", tags=["notes-ai-v2"])

_WEEKLY_REVIEW_ENDPOINT = "POST /api/v2/notes/weekly-review/generate"


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


@router.post(
    "/weekly-review/generate",
    dependencies=[Depends(verify_csrf_v2)],
)
async def generate_weekly_review(
    payload: NoteWeeklyReviewGenerateRequestV2,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> StreamingResponse:
    resolved_key = idempotency_key or ""
    validate_idempotency_key(resolved_key)
    request_hash = build_idempotent_request_hash(payload={"week": payload.week})
    replay = get_replay(
        session,
        user_id=user.id,
        endpoint=_WEEKLY_REVIEW_ENDPOINT,
        idempotency_key=resolved_key,
        request_hash=request_hash,
    )
    if replay is not None:
        return _single_frame_stream(replay)

    claimed_replay = claim_idempotency_key(
        session,
        user_id=user.id,
        endpoint=_WEEKLY_REVIEW_ENDPOINT,
        idempotency_key=resolved_key,
        request_hash=request_hash,
    )
    if claimed_replay is not None:
        return _single_frame_stream(claimed_replay)

    service = WeeklyReviewServiceV2(session)
    try:
        prepared = service.prepare_generation(
            user=user,
            settings=settings,
            week=payload.week,
        )
    except ServiceError:
        release_idempotency_claim(
            session,
            user_id=user.id,
            endpoint=_WEEKLY_REVIEW_ENDPOINT,
            idempotency_key=resolved_key,
            request_hash=request_hash,
        )
        raise

    return StreamingResponse(
        _stream_weekly_review_frames(
            request=request,
            session=session,
            service=service,
            prepared=prepared,
            settings=settings,
            user_id=user.id,
            idempotency_key=resolved_key,
            request_hash=request_hash,
        ),
        media_type="text/event-stream",
    )


async def _stream_weekly_review_frames(
    *,
    request: Request,
    session: Session,
    service: WeeklyReviewServiceV2,
    prepared: WeeklyReviewGenerationPrepV2,
    settings: Settings,
    user_id: int,
    idempotency_key: str,
    request_hash: str,
) -> AsyncIterator[bytes]:
    try:
        async for frame in service.stream_generation(prepared=prepared, settings=settings):
            if await request.is_disconnected():
                session.rollback()
                release_idempotency_claim(
                    session,
                    user_id=user_id,
                    endpoint=_WEEKLY_REVIEW_ENDPOINT,
                    idempotency_key=idempotency_key,
                    request_hash=request_hash,
                )
                return
            payload = {"type": frame.type, **frame.payload}
            if frame.type == "done":
                store_replay(
                    session,
                    user_id=user_id,
                    endpoint=_WEEKLY_REVIEW_ENDPOINT,
                    idempotency_key=idempotency_key,
                    request_hash=request_hash,
                    response_body=payload,
                )
                session.commit()
            yield _sse_frame(payload)
    except (httpx.HTTPStatusError, httpx.TimeoutException, httpx.RequestError, ServiceError) as exc:
        session.rollback()
        release_idempotency_claim(
            session,
            user_id=user_id,
            endpoint=_WEEKLY_REVIEW_ENDPOINT,
            idempotency_key=idempotency_key,
            request_hash=request_hash,
        )
        if isinstance(exc, ServiceError):
            yield _sse_frame({"type": "error", "code": exc.code, "message": exc.message})
            return
        yield _sse_frame(
            {
                "type": "error",
                "code": "llm_service_unavailable",
                "message": str(exc),
            }
        )


def _single_frame_stream(payload: dict[str, object]) -> StreamingResponse:
    async def _single() -> AsyncIterator[bytes]:
        yield _sse_frame(payload)

    return StreamingResponse(_single(), media_type="text/event-stream")


def _sse_frame(payload: dict[str, object]) -> bytes:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n".encode()
