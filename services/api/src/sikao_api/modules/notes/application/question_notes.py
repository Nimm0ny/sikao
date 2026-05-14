"""Phase 3.7 (fenbi-merge) — 题级笔记服务.

GET: 没 note → has_note=False + content="" + updated_at=None (FE 不需 二次判 null).
PUT: upsert 语义, 一人一题一行 (UNIQUE on (user_id, question_id)).
DELETE: 删 row → 下次 GET 回退 has_note=False.

并发兼容: catch IntegrityError + 重试 SELECT-then-UPDATE (跨方言通用,
不靠 PG ON CONFLICT). 沿用 user_goals 同款 pattern.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from sikao_api.db.models import QuestionNote
from sikao_api.db.schemas import QuestionNoteUpdateV2, QuestionNoteV2


def get_question_note(
    session: Session, *, user_id: int, question_id: int
) -> QuestionNoteV2:
    row = session.scalar(
        select(QuestionNote).where(
            QuestionNote.user_id == user_id,
            QuestionNote.question_id == question_id,
        )
    )
    if row is None:
        return QuestionNoteV2(has_note=False, content="", updated_at=None)
    return QuestionNoteV2(
        has_note=True, content=row.content, updated_at=row.updated_at
    )


def upsert_question_note(
    session: Session,
    *,
    user_id: int,
    question_id: int,
    payload: QuestionNoteUpdateV2,
) -> QuestionNoteV2:
    row = session.scalar(
        select(QuestionNote).where(
            QuestionNote.user_id == user_id,
            QuestionNote.question_id == question_id,
        )
    )
    if row is not None:
        row.content = payload.content
        session.flush()
        return QuestionNoteV2(
            has_note=True, content=row.content, updated_at=row.updated_at
        )

    row = QuestionNote(
        user_id=user_id, question_id=question_id, content=payload.content
    )
    session.add(row)
    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        existing = session.scalar(
            select(QuestionNote).where(
                QuestionNote.user_id == user_id,
                QuestionNote.question_id == question_id,
            )
        )
        if existing is None:
            raise  # 真撞 race, 抛给上游
        existing.content = payload.content
        session.flush()
        return QuestionNoteV2(
            has_note=True, content=existing.content, updated_at=existing.updated_at
        )
    return QuestionNoteV2(
        has_note=True, content=row.content, updated_at=row.updated_at
    )


def delete_question_note(
    session: Session, *, user_id: int, question_id: int
) -> bool:
    """Returns True if a row was deleted, False if no note existed (idempotent)."""
    row = session.scalar(
        select(QuestionNote).where(
            QuestionNote.user_id == user_id,
            QuestionNote.question_id == question_id,
        )
    )
    if row is None:
        return False
    session.delete(row)
    session.flush()
    return True
