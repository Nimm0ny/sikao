from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session as SqlAlchemySession

from sikao_api.db.models_v2 import IdempotencyKeyV2
from sikao_api.modules.llm.application.call_recording import persist_failed_call
from sikao_api.modules.llm.application.llm import LLMMessage
from sikao_api.modules.system.application.errors import ConflictError


def cleanup_aborted_stream(
    service,
    *,
    user_id: int,
    purpose: str,
    prompt_version: str,
    provider_name: str,
    model: str,
    messages: list[LLMMessage],
    raw_text: str,
    usage: dict[str, int | None],
    endpoint: str,
    idempotency_key: str,
    request_hash: str,
) -> None:
    cleanup_session = SqlAlchemySession(bind=service.session.get_bind())
    try:
        persist_failed_call(
            session=cleanup_session,
            settings=service.settings,
            user_id=user_id,
            purpose=purpose,
            prompt_version=prompt_version,
            provider=provider_name,
            model=model,
            messages=messages,
            raw_text=raw_text,
            usage=usage,
            error=ConnectionAbortedError("client disconnected before stream completed"),
            parse_status="client_disconnected",
        )
        row = cleanup_session.scalar(
            select(IdempotencyKeyV2).where(
                IdempotencyKeyV2.key == idempotency_key,
                IdempotencyKeyV2.user_id == user_id,
                IdempotencyKeyV2.endpoint == endpoint,
            )
        )
        if row is not None:
            if row.request_hash != request_hash:
                raise ConflictError(
                    "idempotency key was reused with a different payload",
                    code="idempotency_key_reused",
                )
            if row.response_status != 200:
                cleanup_session.delete(row)
        cleanup_session.commit()
    except Exception:
        cleanup_session.rollback()
        raise
    finally:
        cleanup_session.close()
