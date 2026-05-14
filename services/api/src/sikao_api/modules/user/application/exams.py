"""SIKAO Wave 8 Phase B: 用户自定义考试 (Home block 1 "我的考试") CRUD.

5 endpoint 数据源:
  - GET  /api/v2/user-exams          → list_exams_by_user
  - POST /api/v2/user-exams          → create_exam
  - GET  /api/v2/user-exams/{id}     → get_exam_by_id (ownership 必检)
  - PATCH /api/v2/user-exams/{id}    → update_exam (ownership 必检)
  - DELETE /api/v2/user-exams/{id}   → delete_exam (ownership 必检)

跨用户 404 (跟 essay_v2 / llm_conversations_v2 一致): 别人的 exam 看 / 改 /
删都返 not_found 防 leak 存在性. ownership check 单点 (get_owned_or_raise),
不在 route 层重复.

days_until 派生 ((exam_date - today_local).days, Asia/Shanghai). 可负
(考试已过); FE 据此渲 "倒计时 X 天" / "已过 N 天".

Fail-Fast: 不存在 → NotFoundError 404. payload Pydantic 兜 validation (route
层 422 自动). exam_event_id / study_plan_id 是 nullable FK SET NULL, 引用
不存在的 id 让 DB IntegrityError 抛 (本 service 不预检, fail-fast 让 DB
报错信息更具体).
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db import schemas
from sikao_api.db.models import UserExam
from sikao_api.modules.system.application.errors import NotFoundError

_CN_TZ_OFFSET = timedelta(hours=8)  # Asia/Shanghai (无 DST)


def _today_local() -> date:
    """Today in Asia/Shanghai timezone (matches user's perceived "today")."""
    return (datetime.now(UTC) + _CN_TZ_OFFSET).date()


def _serialize(exam: UserExam) -> schemas.UserExamRead:
    return schemas.UserExamRead(
        id=exam.id,
        name=exam.name,
        exam_date=exam.exam_date,
        exam_event_id=exam.exam_event_id,
        study_plan_id=exam.study_plan_id,
        notes=exam.notes,
        created_at=exam.created_at,
        days_until=(exam.exam_date - _today_local()).days,
    )


def _get_owned_or_raise(
    session: Session, *, exam_id: int, user_id: int
) -> UserExam:
    """Lookup with ownership check. 404 if not found or owned by others."""
    exam = session.get(UserExam, exam_id)
    if exam is None or exam.user_id != user_id:
        raise NotFoundError(f"user_exam {exam_id} not found")
    return exam


def list_exams_by_user(
    session: Session, *, user_id: int
) -> schemas.UserExamList:
    """List user's exams, sorted by exam_date asc (近期在前).

    Home block 1 渲 ≤10 row 极少, 全量返不分页 (跟 UserExamList contract 一致).
    """
    stmt = (
        select(UserExam)
        .where(UserExam.user_id == user_id)
        .order_by(UserExam.exam_date.asc(), UserExam.id.asc())
    )
    rows = list(session.scalars(stmt).all())
    return schemas.UserExamList(
        exams=[_serialize(e) for e in rows],
        total=len(rows),
    )


def get_exam_by_id(
    session: Session, *, exam_id: int, user_id: int
) -> schemas.UserExamRead:
    """Get single exam with ownership check (404 if not owned)."""
    return _serialize(_get_owned_or_raise(session, exam_id=exam_id, user_id=user_id))


def create_exam(
    session: Session,
    *,
    user_id: int,
    payload: schemas.UserExamCreate,
) -> schemas.UserExamRead:
    """Create user_exam row. user_id binding 由 service 决定, payload 不带."""
    exam = UserExam(
        user_id=user_id,
        name=payload.name.strip(),
        exam_date=payload.exam_date,
        exam_event_id=payload.exam_event_id,
        study_plan_id=payload.study_plan_id,
        notes=payload.notes,
    )
    session.add(exam)
    session.flush()
    return _serialize(exam)


def update_exam(
    session: Session,
    *,
    exam_id: int,
    user_id: int,
    payload: schemas.UserExamUpdate,
) -> schemas.UserExamRead:
    """Partial patch. ownership 必检 (404 if not owned)."""
    exam = _get_owned_or_raise(session, exam_id=exam_id, user_id=user_id)
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        exam.name = data["name"].strip()
    if "exam_date" in data and data["exam_date"] is not None:
        exam.exam_date = data["exam_date"]
    if "exam_event_id" in data:
        exam.exam_event_id = data["exam_event_id"]
    if "study_plan_id" in data:
        exam.study_plan_id = data["study_plan_id"]
    if "notes" in data:
        exam.notes = data["notes"]
    session.flush()
    return _serialize(exam)


def delete_exam(
    session: Session, *, exam_id: int, user_id: int
) -> None:
    """Delete with ownership check. 404 if not owned. Returns None (204 body)."""
    exam = _get_owned_or_raise(session, exam_id=exam_id, user_id=user_id)
    session.delete(exam)
    session.flush()
