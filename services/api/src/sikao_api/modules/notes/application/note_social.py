"""SIKAO Wave 10 Phase B — 笔记本社交化 (public toggle + 单题视图 list).

跟 notebook.py 互补:
  - notebook.py   私人笔记本 CRUD + SM-2 (笔记是私有, 不带社交).
  - note_social.py 把 owner 的笔记切到 is_public=true 后, 单题视图聚合 "top
                    voted 公开笔记" 列表 (跟 question 关联, 不在 owner 笔记本里).

3 函数:
  - toggle_public(...) : owner-only, 翻转 is_public + display_anonymous + public_at.
  - list_public_notes_for_question(...) : top voted by likes_count + viewer-specific
                                          liked_by_me/favorited_by_me flag.
  - count_public_notes_for_question(...) : 单题视图 header 角标 "笔记 N 条".

跨用户 IDOR: toggle_public load_owned_note 防越权改别人 note (404).
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from sikao_api.db.models import Note, NoteFavorite, NoteLike, User, utc_now
from sikao_api.db.schemas import (
    NoteOutV2,
    NotePublicListItemV2,
    NotePublicListResponseV2,
)
from sikao_api.modules.system.application.errors import NotFoundError
from sikao_api.modules.system.application.errors import ValidationError as ServiceValidationError
from sikao_api.modules.notes.application.notebook import _to_note_out


def _load_owned_note(session: Session, *, user_id: int, note_id: int) -> Note:
    """Load note ensuring it belongs to user_id. Cross-user → 404."""
    row = session.get(Note, note_id)
    if row is None or row.user_id != user_id:
        raise NotFoundError("note not found")
    return row


def toggle_public(
    session: Session,
    *,
    user_id: int,
    note_id: int,
    is_public: bool,
    display_anonymous: bool,
) -> NoteOutV2:
    """Owner-only toggle is_public + display_anonymous. Returns NoteOutV2.

    First time setting is_public=true → set public_at=now. 后续 toggle 不刷
    public_at (保留首次公开时间, 列表排序 fallback 用).

    question_id NULL 的 note 仍可 is_public=true (跨题型 method/quote 仍能公开),
    但单题视图列表查不到它 (那条列表按 question_id 过滤).
    """
    row = _load_owned_note(session, user_id=user_id, note_id=note_id)

    if is_public and not row.is_public:
        row.public_at = utc_now()
    row.is_public = is_public
    row.display_anonymous = display_anonymous
    row.updated_at = utc_now()
    session.flush()
    session.refresh(row)
    return _to_note_out(row)


def _to_public_list_item(
    row: Note,
    *,
    owner_display_name: str | None,
    liked_by_me: bool,
    favorited_by_me: bool,
) -> NotePublicListItemV2:
    """Serialize Note row → NotePublicListItemV2.

    匿名模式 (display_anonymous=true): user_display_name=None, FE 渲染 '匿名用户'.
    """
    display_name = None if row.display_anonymous else owner_display_name
    return NotePublicListItemV2(
        id=row.id,
        type=row.type,  # type: ignore[arg-type]
        body=row.body_json,
        title=row.title,
        tags=list(row.tags),
        user_display_name=display_name,
        likes_count=row.likes_count,
        comments_count=row.comments_count,
        liked_by_me=liked_by_me,
        favorited_by_me=favorited_by_me,
        public_at=row.public_at,
        created_at=row.created_at,
    )


def list_public_notes_for_question(
    session: Session,
    *,
    question_id: int,
    viewer_user_id: int | None,
    limit: int = 3,
    offset: int = 0,
) -> NotePublicListResponseV2:
    """单题视图 GET /questions/{id}/public-notes.

    Top voted: ORDER BY likes_count DESC, public_at DESC, id DESC.
    viewer_user_id None (anonymous) → liked_by_me/favorited_by_me 全 false.
    """
    if limit < 1 or limit > 50:
        raise ServiceValidationError(
            "limit must be 1-50", code="note_public_limit_invalid"
        )
    if offset < 0:
        raise ServiceValidationError(
            "offset must be >= 0", code="note_public_offset_invalid"
        )

    total_stmt = (
        select(func.count(Note.id))
        .where(Note.question_id == question_id)
        .where(Note.is_public.is_(True))
    )
    total = int(session.scalar(total_stmt) or 0)

    rows_stmt = (
        select(Note)
        .where(Note.question_id == question_id)
        .where(Note.is_public.is_(True))
        .order_by(
            Note.likes_count.desc(), Note.public_at.desc(), Note.id.desc()
        )
        .offset(offset)
        .limit(limit)
    )
    rows = list(session.scalars(rows_stmt).all())

    # Owner display names — 单 query JOIN users 拉一批, 避免 N+1.
    owner_ids = list({r.user_id for r in rows})
    name_map: dict[int, str] = {}
    if owner_ids:
        name_rows = session.execute(
            select(User.id, User.display_name).where(User.id.in_(owner_ids))
        ).all()
        name_map = {int(uid): str(name) for uid, name in name_rows}

    # Viewer's liked / favorited sets — 两个轻量 query (note_likes / favorites).
    liked_ids: set[int] = set()
    favorited_ids: set[int] = set()
    if viewer_user_id is not None and rows:
        note_ids = [r.id for r in rows]
        liked_stmt = (
            select(NoteLike.note_id)
            .where(NoteLike.user_id == viewer_user_id)
            .where(NoteLike.note_id.in_(note_ids))
        )
        liked_ids = {int(nid) for nid in session.scalars(liked_stmt).all()}
        fav_stmt = (
            select(NoteFavorite.note_id)
            .where(NoteFavorite.user_id == viewer_user_id)
            .where(NoteFavorite.note_id.in_(note_ids))
        )
        favorited_ids = {int(nid) for nid in session.scalars(fav_stmt).all()}

    items = [
        _to_public_list_item(
            r,
            owner_display_name=name_map.get(r.user_id),
            liked_by_me=r.id in liked_ids,
            favorited_by_me=r.id in favorited_ids,
        )
        for r in rows
    ]
    return NotePublicListResponseV2(items=items, total=total)


def count_public_notes_for_question(
    session: Session, *, question_id: int
) -> int:
    """单题视图 header 角标 "笔记 N 条". Pure count, 不取 rows."""
    stmt = (
        select(func.count(Note.id))
        .where(Note.question_id == question_id)
        .where(Note.is_public.is_(True))
    )
    return int(session.scalar(stmt) or 0)
