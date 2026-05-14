from __future__ import annotations

import hashlib
import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models import IdempotencyKey
from sikao_api.modules.system.application.errors import ConflictError


def build_request_hash(payload: Any) -> str:
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()


def load_idempotent_response(session: Session, *, scope: str, key: str, request_hash: str) -> tuple[int, bytes] | None:
    record = session.scalar(
        select(IdempotencyKey).where(IdempotencyKey.scope == scope, IdempotencyKey.idempotency_key == key)
    )
    if record is None:
        return None
    if record.request_hash != request_hash:
        raise ConflictError("idempotency key reused with different payload", code="idempotency_conflict")
    return record.response_code, record.response_body


def store_idempotent_response(
    session: Session,
    *,
    scope: str,
    key: str,
    request_hash: str,
    response_code: int,
    response_body: bytes,
) -> None:
    session.add(
        IdempotencyKey(
            scope=scope,
            idempotency_key=key,
            request_hash=request_hash,
            response_code=response_code,
            response_body=response_body,
        )
    )
    session.flush()
