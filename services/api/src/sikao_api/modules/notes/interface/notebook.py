"""SIKAO Wave 4 Phase 2B (notebook module) — 跨领域笔记本 endpoints.

9 个 endpoint:
  POST   /api/v2/notebook/notes                创建 note
  GET    /api/v2/notebook/notes                list with filters + cursor
  GET    /api/v2/notebook/notes/{id}           单 note
  PUT    /api/v2/notebook/notes/{id}           update partial
  DELETE /api/v2/notebook/notes/{id}           删
  POST   /api/v2/notebook/notes/{id}/reviews   提交 SM-2 quality + 重算 next_review
  GET    /api/v2/notebook/notes/{id}/reviews   audit 历史
  GET    /api/v2/notebook/reviews/due          due queue (NULL 或 next_review_at <= now)
  GET    /api/v2/notebook/stats                total / due_count / by_type / by_source_domain

跟 /api/v2/notes/{question_id} (notes_v2.py, 题级 markdown) 是 **不同 namespace**:
  notes_v2.py     一题一行 markdown (粒度 = question, 0014 schema).
  notebook_v2.py  用户自由创建 N 张卡 (粒度 = user, 0018 schema, SM-2 复习).
两套并存, 不合并 (语义不同, 接入点不同).

Auth: 全部 endpoint Bearer / cookie 任一. 跨用户 → 404 (NotFoundError, 防 leak).
CSRF: 所有 mutating (POST/PUT/DELETE) cookie-auth 走 verify_csrf_token_if_cookie_auth.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from sikao_api.db.session import get_db_session
from sikao_api.db import schemas
from sikao_api.db.models import User
from sikao_api.modules.notes.application import notebook
from sikao_api.modules.auth.application.security import (
    get_current_user,
    verify_csrf_token_if_cookie_auth,
)

router = APIRouter(prefix="/api/v2/notebook", tags=["notebook-v2"])


# ── Notes CRUD ─────────────────────────────────────────────────────────────


@router.post(
    "/notes",
    response_model=schemas.NoteOutV2,
    status_code=status.HTTP_201_CREATED,
)
def create_note(
    payload: schemas.NoteCreateV2,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    _csrf: Annotated[None, Depends(verify_csrf_token_if_cookie_auth)],
) -> schemas.NoteOutV2:
    return notebook.create_note(session, user_id=user.id, payload=payload)


@router.get(
    "/notes",
    response_model=schemas.NoteListOutV2,
    status_code=status.HTTP_200_OK,
)
def list_notes(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    type: Annotated[schemas.NoteType | None, Query()] = None,
    source_domain: Annotated[
        schemas.NoteSourceDomain | None, Query(alias="sourceDomain")
    ] = None,
    tag: Annotated[str | None, Query(max_length=50)] = None,
    cursor: Annotated[int | None, Query(ge=1)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> schemas.NoteListOutV2:
    return notebook.list_notes(
        session,
        user_id=user.id,
        type=type,
        source_domain=source_domain,
        tag=tag,
        cursor=cursor,
        limit=limit,
    )


@router.get(
    "/notes/{note_id}",
    response_model=schemas.NoteOutV2,
    status_code=status.HTTP_200_OK,
)
def get_note(
    note_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.NoteOutV2:
    return notebook.get_note(session, user_id=user.id, note_id=note_id)


@router.put(
    "/notes/{note_id}",
    response_model=schemas.NoteOutV2,
    status_code=status.HTTP_200_OK,
)
def update_note(
    note_id: int,
    payload: schemas.NoteUpdateV2,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    _csrf: Annotated[None, Depends(verify_csrf_token_if_cookie_auth)],
) -> schemas.NoteOutV2:
    return notebook.update_note(
        session, user_id=user.id, note_id=note_id, payload=payload
    )


@router.delete(
    "/notes/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_note(
    note_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    _csrf: Annotated[None, Depends(verify_csrf_token_if_cookie_auth)],
) -> Response:
    notebook.delete_note(session, user_id=user.id, note_id=note_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Reviews (SM-2) ─────────────────────────────────────────────────────────


@router.post(
    "/notes/{note_id}/reviews",
    response_model=schemas.NoteOutV2,
    status_code=status.HTTP_200_OK,
)
def submit_review(
    note_id: int,
    payload: schemas.NoteReviewSubmitV2,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    _csrf: Annotated[None, Depends(verify_csrf_token_if_cookie_auth)],
) -> schemas.NoteOutV2:
    """提交 SM-2 quality 0-5 → 重算 ease/interval/next_review_at + audit row.
    返 updated note. 跨用户 → 404. quality 不在 0-5 → 422.
    """
    return notebook.submit_review(
        session, user_id=user.id, note_id=note_id, payload=payload
    )


@router.get(
    "/notes/{note_id}/reviews",
    response_model=schemas.NoteReviewListOutV2,
    status_code=status.HTTP_200_OK,
)
def list_reviews(
    note_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.NoteReviewListOutV2:
    """Audit history. 跨用户 → 404."""
    return notebook.list_reviews(session, user_id=user.id, note_id=note_id)


@router.get(
    "/reviews/due",
    response_model=schemas.NoteListOutV2,
    status_code=status.HTTP_200_OK,
)
def get_due_reviews(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    cursor: Annotated[int | None, Query(ge=1)] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 5,
) -> schemas.NoteListOutV2:
    """Due queue: next_review_at IS NULL OR next_review_at <= now. ORDER BY
    next_review_at ASC (NULLS first via CASE). 默认 limit=5 (一日复习包大小).
    """
    return notebook.get_due_reviews(
        session, user_id=user.id, limit=limit, cursor=cursor
    )


# ── Stats ──────────────────────────────────────────────────────────────────


@router.get(
    "/stats",
    response_model=schemas.NoteStatsV2,
    status_code=status.HTTP_200_OK,
)
def get_stats(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.NoteStatsV2:
    """Aggregate counts (total / due_count / by_type / by_source_domain)."""
    return notebook.get_stats(session, user_id=user.id)
