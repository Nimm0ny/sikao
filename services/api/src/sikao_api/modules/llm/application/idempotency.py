from __future__ import annotations

import hashlib
import json
import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import IdempotencyKeyV2
from sikao_api.modules.plans.application.helpers import now_utc
from sikao_api.modules.system.application.errors import ConflictError, ValidationError


def build_idempotent_request_hash(*, payload: dict[str, Any]) -> str:
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def get_replay(
    session: Session,
    *,
    user_id: int,
    endpoint: str,
    idempotency_key: str,
    request_hash: str,
) -> dict[str, Any] | None:
    row = session.scalar(
        select(IdempotencyKeyV2).where(
            IdempotencyKeyV2.key == idempotency_key,
            IdempotencyKeyV2.user_id == user_id,
            IdempotencyKeyV2.endpoint == endpoint,
        )
    )
    if row is None:
        return None
    if row.request_hash != request_hash:
        raise ConflictError(
            "idempotency key was reused with a different payload",
            code="idempotency_key_reused",
        )
    return row.response_body


def claim_idempotency_key(
    session: Session,
    *,
    user_id: int,
    endpoint: str,
    idempotency_key: str,
    request_hash: str,
) -> dict[str, Any] | None:
    try:
        session.add(
            IdempotencyKeyV2(
                key=idempotency_key,
                user_id=user_id,
                endpoint=endpoint,
                request_hash=request_hash,
                response_status=202,
                response_body={"status": "in_progress"},
                created_at=now_utc(),
                expires_at=now_utc() + timedelta(hours=24),
            )
        )
        session.commit()
        return None
    except IntegrityError:
        session.rollback()
    row = get_replay(
        session,
        user_id=user_id,
        endpoint=endpoint,
        idempotency_key=idempotency_key,
        request_hash=request_hash,
    )
    existing = session.scalar(
        select(IdempotencyKeyV2).where(
            IdempotencyKeyV2.key == idempotency_key,
            IdempotencyKeyV2.user_id == user_id,
            IdempotencyKeyV2.endpoint == endpoint,
        )
    )
    if existing is None:
        raise ConflictError("idempotency claim disappeared", code="idempotency_claim_missing")
    if existing.response_status == 200:
        return row
    raise ConflictError(
        "idempotency request is already in progress",
        code="idempotency_request_in_progress",
    )


def release_idempotency_claim(
    session: Session,
    *,
    user_id: int,
    endpoint: str,
    idempotency_key: str,
    request_hash: str,
) -> None:
    row = session.scalar(
        select(IdempotencyKeyV2).where(
            IdempotencyKeyV2.key == idempotency_key,
            IdempotencyKeyV2.user_id == user_id,
            IdempotencyKeyV2.endpoint == endpoint,
        )
    )
    if row is None:
        return
    if row.request_hash != request_hash:
        raise ConflictError(
            "idempotency key was reused with a different payload",
            code="idempotency_key_reused",
        )
    if row.response_status == 200:
        return
    session.delete(row)
    session.commit()


def store_replay(
    session: Session,
    *,
    user_id: int,
    endpoint: str,
    idempotency_key: str,
    request_hash: str,
    response_body: dict[str, Any],
) -> None:
    row = session.scalar(
        select(IdempotencyKeyV2).where(
            IdempotencyKeyV2.key == idempotency_key,
            IdempotencyKeyV2.user_id == user_id,
            IdempotencyKeyV2.endpoint == endpoint,
        )
    )
    if row is None:
        raise ConflictError("idempotency claim missing", code="idempotency_claim_missing")
    if row.request_hash != request_hash:
        raise ConflictError(
            "idempotency key was reused with a different payload",
            code="idempotency_key_reused",
        )
    row.response_status = 200
    row.response_body = response_body
    row.expires_at = now_utc() + timedelta(hours=24)


def validate_idempotency_key(key: str) -> None:
    if not key:
        raise ValidationError("Idempotency-Key is required", code="idempotency_key_required")
    try:
        uuid.UUID(key)
    except ValueError as exc:
        raise ValidationError("Idempotency-Key must be a UUID", code="idempotency_key_invalid") from exc
