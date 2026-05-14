"""SIKAO Wave 8 Phase B: 用户自定义考试 (Home block 1 "我的考试") endpoints.

5 endpoint:
  GET    /api/v2/user-exams          → list
  POST   /api/v2/user-exams          → create
  GET    /api/v2/user-exams/{id}     → get one (ownership 404)
  PATCH  /api/v2/user-exams/{id}     → update (ownership 404)
  DELETE /api/v2/user-exams/{id}     → delete (ownership 404)

跨用户 404: ownership check 在 service 层 (_get_owned_or_raise). 401 兜
通过 Depends(get_current_user). CSRF 走 verify_csrf_token (state-mutating).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from sikao_api.db.session import get_db_session
from sikao_api.db import schemas
from sikao_api.db.models import User
from sikao_api.modules.auth.application.security import get_current_user, verify_csrf_token
from sikao_api.modules.user.application.exams import (
    create_exam,
    delete_exam,
    get_exam_by_id,
    list_exams_by_user,
    update_exam,
)

router = APIRouter(prefix="/api/v2/user-exams", tags=["user-exams-v2"])


@router.get("", response_model=schemas.UserExamList)
def list_user_exams(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.UserExamList:
    """List current user's exams, sorted by exam_date asc."""
    return list_exams_by_user(session, user_id=user.id)


@router.post(
    "",
    response_model=schemas.UserExamRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf_token)],
)
def create_user_exam(
    payload: schemas.UserExamCreate,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.UserExamRead:
    """Create a new user exam. user_id from auth, not payload."""
    return create_exam(session, user_id=user.id, payload=payload)


@router.get("/{exam_id}", response_model=schemas.UserExamRead)
def get_user_exam(
    exam_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.UserExamRead:
    """Get a single user exam by id (404 if not owned)."""
    return get_exam_by_id(session, exam_id=exam_id, user_id=user.id)


@router.patch(
    "/{exam_id}",
    response_model=schemas.UserExamRead,
    dependencies=[Depends(verify_csrf_token)],
)
def update_user_exam(
    exam_id: int,
    payload: schemas.UserExamUpdate,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.UserExamRead:
    """Patch user exam fields (404 if not owned)."""
    return update_exam(
        session, exam_id=exam_id, user_id=user.id, payload=payload
    )


@router.delete(
    "/{exam_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_csrf_token)],
)
def delete_user_exam(
    exam_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> None:
    """Delete user exam (404 if not owned)."""
    delete_exam(session, exam_id=exam_id, user_id=user.id)
