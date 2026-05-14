"""Phase 3.7 + 3.8 (fenbi-merge) — 题级笔记 endpoints.

  GET    /api/v2/notes/{question_id}    取笔记 (没 → has_note=False)
  PUT    /api/v2/notes/{question_id}    upsert 笔记 (markdown content)
  DELETE /api/v2/notes/{question_id}    删笔记 (idempotent: 没 row 也 200)

所有 endpoint 需登录. 一人一题一行 (UNIQUE on (user_id, question_id)).
笔记是题级数据 (跨 paper / 跨 session 共享同一笔记), 不挂 /papers 或
/practice 路由, 用独立 /notes namespace.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from sikao_api.db.session import get_db_session
from sikao_api.db import schemas
from sikao_api.db.models import User
from sikao_api.modules.notes.application.question_notes import (
    delete_question_note,
    get_question_note,
    upsert_question_note,
)
from sikao_api.modules.auth.application.security import get_current_user

router = APIRouter(prefix="/api/v2/notes", tags=["notes-v2"])


@router.get("/{question_id}", response_model=schemas.QuestionNoteV2)
def notes_get(
    question_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.QuestionNoteV2:
    return get_question_note(session, user_id=user.id, question_id=question_id)


@router.put("/{question_id}", response_model=schemas.QuestionNoteV2)
def notes_put(
    question_id: int,
    payload: schemas.QuestionNoteUpdateV2,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.QuestionNoteV2:
    return upsert_question_note(
        session, user_id=user.id, question_id=question_id, payload=payload
    )


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def notes_delete(
    question_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> None:
    delete_question_note(session, user_id=user.id, question_id=question_id)
