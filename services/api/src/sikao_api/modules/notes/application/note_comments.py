"""SIKAO Wave 10 Phase B — 笔记评论 (一级嵌套).

3 函数:
  - create_comment(...)  : 创建 comment. parent_comment_id 非空 时校验 parent
                            的 parent_comment_id IS NULL (拒 grand-child).
                            同 transaction 维护 notes.comments_count.
  - list_comments(...)   : 列出 note 下所有 comment (顶层 + 一级 child), 顶层
                            排前, child 按 parent grouping (FE 渲染嵌套).
  - delete_comment(...)  : owner-only 删 comment. CASCADE: 删顶层带走 children.
                            同 transaction 维护 notes.comments_count.

display_name resolution: comment 本身存 user_id, 渲染时按 parent note 的
display_anonymous 决定是否露名 (跟 owner 公开笔记同步匿名/具名).
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models import Note, NoteComment, User, utc_now
from sikao_api.db.schemas import (
    NoteCommentCreateV2,
    NoteCommentListV2,
    NoteCommentOutV2,
)
from sikao_api.modules.system.application.errors import NotFoundError
from sikao_api.modules.system.application.errors import ValidationError as ServiceValidationError


def _to_comment_out(row: NoteComment, *, display_name: str | None) -> NoteCommentOutV2:
    return NoteCommentOutV2(
        id=row.id,
        note_id=row.note_id,
        user_id=row.user_id,
        user_display_name=display_name,
        content=row.content,
        parent_comment_id=row.parent_comment_id,
        likes_count=row.likes_count,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def create_comment(
    session: Session,
    *,
    user_id: int,
    note_id: int,
    payload: NoteCommentCreateV2,
) -> NoteCommentOutV2:
    """创建 comment.

    Note 必须存在 + is_public=true (不允许给私笔记评论, 404). parent_comment_id
    非空时校验 parent 存在 + parent 属于同 note + parent.parent_comment_id IS NULL
    (一级嵌套). 违反 → 422.

    同 transaction 维护 notes.comments_count.
    """
    note = session.get(Note, note_id)
    if note is None or not note.is_public:
        raise NotFoundError("note not found")

    parent_id = payload.parent_comment_id
    if parent_id is not None:
        parent = session.get(NoteComment, parent_id)
        if (
            parent is None
            or parent.note_id != note_id
            or parent.parent_comment_id is not None
        ):
            raise ServiceValidationError(
                "parent_comment_id must reference a top-level comment on this note",
                code="note_comment_parent_invalid",
            )

    row = NoteComment(
        note_id=note_id,
        user_id=user_id,
        content=payload.content,
        parent_comment_id=parent_id,
        likes_count=0,
    )
    session.add(row)
    note.comments_count = note.comments_count + 1
    note.updated_at = utc_now()
    session.flush()
    session.refresh(row)

    display_name = _resolve_display_name(session, note=note, user_id=user_id)
    return _to_comment_out(row, display_name=display_name)


def _resolve_display_name(
    session: Session, *, note: Note, user_id: int
) -> str | None:
    """Return display name if note is non-anonymous else None.

    note.display_anonymous=true → None (FE 渲染 '匿名用户').
    """
    if note.display_anonymous:
        return None
    user = session.get(User, user_id)
    return user.display_name if user is not None else None


def list_comments(
    session: Session,
    *,
    note_id: int,
    limit: int = 50,
) -> NoteCommentListV2:
    """List comments on a note. Note 必须 is_public=true (跟 create 同 gate).

    Order: 顶层 comment ASC by created_at, 然后 child comment ASC by created_at
    紧跟在 parent 后. FE 按 parent_comment_id grouping 渲染嵌套.

    limit 上限 = 50, 防一次拉太多 (note 下评论 ≥50 走 follow-up cursor pagination,
    本 wave 不做).
    """
    note = session.get(Note, note_id)
    if note is None or not note.is_public:
        raise NotFoundError("note not found")

    if limit < 1 or limit > 200:
        raise ServiceValidationError(
            "limit must be 1-200", code="note_comments_limit_invalid"
        )

    rows = list(
        session.scalars(
            select(NoteComment)
            .where(NoteComment.note_id == note_id)
            .order_by(NoteComment.created_at.asc(), NoteComment.id.asc())
            .limit(limit)
        ).all()
    )

    # Single JOIN users to resolve display_names (avoid N+1).
    user_ids = list({r.user_id for r in rows})
    name_map: dict[int, str] = {}
    if user_ids:
        name_rows = session.execute(
            select(User.id, User.display_name).where(User.id.in_(user_ids))
        ).all()
        name_map = {int(uid): str(name) for uid, name in name_rows}

    items: list[NoteCommentOutV2] = []
    for r in rows:
        display = None if note.display_anonymous else name_map.get(r.user_id)
        items.append(_to_comment_out(r, display_name=display))

    return NoteCommentListV2(items=items, total=len(items))


def delete_comment(
    session: Session, *, user_id: int, comment_id: int
) -> None:
    """Owner-only delete. 同 transaction 维护 notes.comments_count.

    顶层 comment 删除会 CASCADE 带走 children. comments_count 减去 (1 + child 数).
    """
    row = session.get(NoteComment, comment_id)
    if row is None or row.user_id != user_id:
        raise NotFoundError("comment not found")

    note = session.get(Note, row.note_id)
    if note is None:
        # Defensive: note 不存在 但 comment 存在 = data corruption,
        # 让上游看到 404 (不 silent recover).
        raise NotFoundError("note not found")

    # 统计本次删的总数 (本 comment + children 若顶层).
    delete_count = 1
    if row.parent_comment_id is None:
        children = list(
            session.scalars(
                select(NoteComment).where(
                    NoteComment.parent_comment_id == comment_id
                )
            ).all()
        )
        delete_count = 1 + len(children)

    session.delete(row)
    note.comments_count = max(0, note.comments_count - delete_count)
    note.updated_at = utc_now()
    session.flush()
