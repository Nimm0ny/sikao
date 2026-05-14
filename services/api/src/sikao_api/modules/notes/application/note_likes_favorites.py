"""SIKAO Wave 10 Phase B — 笔记点赞 + 收藏.

2 函数 (both toggle / idempotent):
  - toggle_like(...)     : INSERT or DELETE NoteLike (UNIQUE note_id,user_id).
                           同 transaction 维护 notes.likes_count.
  - toggle_favorite(...) : INSERT or DELETE NoteFavorite. 不维护 cached count
                           (NoteFavorite docstring: 不缓存 favorites_count).

Note 必须 is_public=true (不允许给私笔记 like/favorite, 404).

跨方言 (PG + SQLite) 走 SELECT-then-INSERT/DELETE 模式, 不靠 ON CONFLICT
(SQLite ON CONFLICT 跟 PG 语法略差). Catch IntegrityError 兜底 race condition.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from sikao_api.db.models import Note, NoteFavorite, NoteLike, utc_now
from sikao_api.db.schemas import (
    NoteFavoriteToggleResponseV2,
    NoteLikeToggleResponseV2,
)
from sikao_api.modules.system.application.errors import NotFoundError


def _load_public_note(session: Session, note_id: int) -> Note:
    """Load public note. Note 不存在 / 不公开 → 404 (防 enumerate)."""
    note = session.get(Note, note_id)
    if note is None or not note.is_public:
        raise NotFoundError("note not found")
    return note


def toggle_like(
    session: Session, *, user_id: int, note_id: int
) -> NoteLikeToggleResponseV2:
    """Toggle like idempotent. 同 transaction +/-1 notes.likes_count.

    Returns liked + likes_count (post-toggle truth).
    """
    note = _load_public_note(session, note_id)

    existing = session.scalar(
        select(NoteLike)
        .where(NoteLike.note_id == note_id)
        .where(NoteLike.user_id == user_id)
    )

    if existing is not None:
        # Already liked → unlike.
        session.delete(existing)
        note.likes_count = max(0, note.likes_count - 1)
        note.updated_at = utc_now()
        session.flush()
        return NoteLikeToggleResponseV2(liked=False, likes_count=note.likes_count)

    # Not yet → insert.
    row = NoteLike(note_id=note_id, user_id=user_id)
    session.add(row)
    note.likes_count = note.likes_count + 1
    note.updated_at = utc_now()
    try:
        session.flush()
    except IntegrityError:
        # Race: 另一请求并发 INSERT 同 (note_id,user_id). 回滚 + 重读 + idempotent.
        session.rollback()
        existing = session.scalar(
            select(NoteLike)
            .where(NoteLike.note_id == note_id)
            .where(NoteLike.user_id == user_id)
        )
        if existing is None:
            raise
        # 重读 note 再返 current count.
        note = _load_public_note(session, note_id)
        return NoteLikeToggleResponseV2(liked=True, likes_count=note.likes_count)
    return NoteLikeToggleResponseV2(liked=True, likes_count=note.likes_count)


def toggle_favorite(
    session: Session, *, user_id: int, note_id: int
) -> NoteFavoriteToggleResponseV2:
    """Toggle favorite idempotent. 不维护 cached count (NoteFavorite model 设计).

    Returns favorited (post-toggle).
    """
    _ = _load_public_note(session, note_id)

    existing = session.scalar(
        select(NoteFavorite)
        .where(NoteFavorite.note_id == note_id)
        .where(NoteFavorite.user_id == user_id)
    )

    if existing is not None:
        session.delete(existing)
        session.flush()
        return NoteFavoriteToggleResponseV2(favorited=False)

    row = NoteFavorite(note_id=note_id, user_id=user_id)
    session.add(row)
    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        existing = session.scalar(
            select(NoteFavorite)
            .where(NoteFavorite.note_id == note_id)
            .where(NoteFavorite.user_id == user_id)
        )
        if existing is None:
            raise
        return NoteFavoriteToggleResponseV2(favorited=True)
    return NoteFavoriteToggleResponseV2(favorited=True)
