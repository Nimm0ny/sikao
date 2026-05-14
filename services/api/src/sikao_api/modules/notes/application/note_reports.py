"""SIKAO Wave 10 Phase B — 举报 admin queue.

3 函数:
  - create_report(...)         : 任意 登录 user 可举报 note / comment. target 必
                                  存在; 重复举报 (同 reporter, 同 target) 仍接受
                                  (拒重复 → 422 反而拒了真实并发举报). admin
                                  queue 走 group by target.
  - list_pending_reports(...)  : admin only, status='pending' ORDER BY created_at
                                  ASC. 拼 target_preview (note: title+body_text;
                                  comment: note_id+content).
  - review_report(...)         : admin only. action ∈ {'dismiss', 'approve_delete'}.
                                  'dismiss' 改 status='dismissed'.
                                  'approve_delete' cascade 删 target (note / comment)
                                  + 改 status='reviewed'.

admin_user_id 入 reviewed_by_admin_id (审计保留).

⚠️ admin_v2.py 现在用 HTTP Basic, get_admin_principal 返 username str 而非
User.id. 本 service 接受 admin_user_id: int 让设计前向兼容 (未来 admin 切到
cookie session 后传 user.id). 当前 route 层做适配: HTTP Basic admin 走 None →
service 内 reviewed_by_admin_id 也存 None (SET NULL 兼容).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models import Note, NoteComment, NoteReport, User, utc_now
from sikao_api.db.schemas import (
    NoteAdminQueueItemV2,
    NoteAdminQueueResponseV2,
    NoteReportCreateV2,
    NoteReportOutV2,
)
from sikao_api.modules.system.application.errors import NotFoundError
from sikao_api.modules.system.application.errors import ValidationError as ServiceValidationError

ReportAction = str  # 'dismiss' | 'approve_delete'

_PREVIEW_LEN = 200


def _to_report_out(row: NoteReport) -> NoteReportOutV2:
    return NoteReportOutV2(
        id=row.id,
        target_type=row.target_type,  # type: ignore[arg-type]
        target_id=row.target_id,
        reporter_user_id=row.reporter_user_id,
        reason=row.reason,
        status=row.status,  # type: ignore[arg-type]
        reviewed_by_admin_id=row.reviewed_by_admin_id,
        created_at=row.created_at,
    )


def create_report(
    session: Session,
    *,
    reporter_user_id: int,
    payload: NoteReportCreateV2,
) -> NoteReportOutV2:
    """Create report. Validates target exists.

    note target: note 必存在 (不要求 is_public — owner 可举报自己未公开的笔记
    给 admin 走人工核查, 边缘 case 但允许).
    comment target: comment 必存在.
    """
    target_type = payload.target_type
    target_id = payload.target_id

    if target_type == "note":
        note = session.get(Note, target_id)
        if note is None:
            raise NotFoundError("target note not found")
    elif target_type == "comment":
        comment = session.get(NoteComment, target_id)
        if comment is None:
            raise NotFoundError("target comment not found")
    else:
        # schema Literal 已限制, defensive.
        raise ServiceValidationError(
            f"unsupported target_type: {target_type}",
            code="note_report_target_type_invalid",
        )

    row = NoteReport(
        target_type=target_type,
        target_id=target_id,
        reporter_user_id=reporter_user_id,
        reason=payload.reason,
        status="pending",
        reviewed_by_admin_id=None,
    )
    session.add(row)
    session.flush()
    session.refresh(row)
    return _to_report_out(row)


def _build_target_preview(
    session: Session, *, target_type: str, target_id: int
) -> dict[str, Any]:
    """Build inline preview for admin queue item.

    FE TS type 用 camelCase, 跟 CamelModel 输出对齐. 这里 dict 内层 key 服务端
    手动 camelCase (Pydantic 只对 model field 做 alias, 不递归 dict 值).

    note    -> { title: str, bodyText: str (≤200) }
    comment -> { noteId: int, content: str (≤200) }
    target 不在 (已被删) -> { deleted: True }
    """
    if target_type == "note":
        note = session.get(Note, target_id)
        if note is None:
            return {"deleted": True}
        body = note.body_json or {}
        body_text: str
        if isinstance(body.get("text"), str):
            body_text = body["text"]
        elif isinstance(body.get("title"), str):
            body_text = body["title"]
        else:
            body_text = ""
        return {
            "title": note.title,
            "bodyText": body_text[:_PREVIEW_LEN],
        }
    if target_type == "comment":
        comment = session.get(NoteComment, target_id)
        if comment is None:
            return {"deleted": True}
        return {
            "noteId": comment.note_id,
            "content": comment.content[:_PREVIEW_LEN],
        }
    return {}


def list_pending_reports(
    session: Session,
    *,
    limit: int = 50,
    offset: int = 0,
) -> NoteAdminQueueResponseV2:
    """Admin queue. status='pending' ORDER BY created_at ASC (FIFO).

    items 拼 target_preview + reporter display_name. total = 全部 (含 reviewed/
    dismissed), pending_count = status='pending' (FE 顶部角标).
    """
    if limit < 1 or limit > 200:
        raise ServiceValidationError(
            "limit must be 1-200", code="note_report_limit_invalid"
        )
    if offset < 0:
        raise ServiceValidationError(
            "offset must be >= 0", code="note_report_offset_invalid"
        )

    from sqlalchemy import func

    total = int(session.scalar(select(func.count(NoteReport.id))) or 0)
    pending_count = int(
        session.scalar(
            select(func.count(NoteReport.id)).where(
                NoteReport.status == "pending"
            )
        )
        or 0
    )

    rows = list(
        session.scalars(
            select(NoteReport)
            .where(NoteReport.status == "pending")
            .order_by(NoteReport.created_at.asc(), NoteReport.id.asc())
            .offset(offset)
            .limit(limit)
        ).all()
    )

    reporter_ids = list({r.reporter_user_id for r in rows})
    name_map: dict[int, str] = {}
    if reporter_ids:
        name_rows = session.execute(
            select(User.id, User.display_name).where(User.id.in_(reporter_ids))
        ).all()
        name_map = {int(uid): str(name) for uid, name in name_rows}

    items: list[NoteAdminQueueItemV2] = []
    for r in rows:
        preview = _build_target_preview(
            session, target_type=r.target_type, target_id=r.target_id
        )
        items.append(
            NoteAdminQueueItemV2(
                id=r.id,
                target_type=r.target_type,  # type: ignore[arg-type]
                target_id=r.target_id,
                target_preview=preview,
                reporter_user_id=r.reporter_user_id,
                reporter_display_name=name_map.get(r.reporter_user_id),
                reason=r.reason,
                status=r.status,  # type: ignore[arg-type]
                created_at=r.created_at,
            )
        )

    return NoteAdminQueueResponseV2(
        items=items, total=total, pending_count=pending_count
    )


def review_report(
    session: Session,
    *,
    admin_user_id: int | None,
    report_id: int,
    action: ReportAction,
) -> NoteReportOutV2:
    """Admin review. action ∈ {'dismiss', 'approve_delete'}.

    'dismiss': 改 status='dismissed', target 保留.
    'approve_delete': 改 status='reviewed' + cascade 删 target (note / comment).
                      删 note 通过 ORM cascade 带走 comments / likes / favorites
                      / note_reviews. 删 comment ORM cascade 带 children.
    重复 review (status != 'pending') → 422 (避免 idempotent confusion).
    """
    if action not in ("dismiss", "approve_delete"):
        raise ServiceValidationError(
            f"unsupported action: {action}",
            code="note_report_action_invalid",
        )

    row = session.get(NoteReport, report_id)
    if row is None:
        raise NotFoundError("report not found")
    if row.status != "pending":
        raise ServiceValidationError(
            f"report already reviewed (status={row.status})",
            code="note_report_already_reviewed",
        )

    if action == "dismiss":
        row.status = "dismissed"
        row.reviewed_by_admin_id = admin_user_id
        session.flush()
        session.refresh(row)
        return _to_report_out(row)

    # approve_delete: 删 target + 标 reviewed.
    if row.target_type == "note":
        target_note = session.get(Note, row.target_id)
        if target_note is not None:
            session.delete(target_note)
    elif row.target_type == "comment":
        target_comment = session.get(NoteComment, row.target_id)
        if target_comment is not None:
            parent_note = session.get(Note, target_comment.note_id)
            # 减 comments_count: 顶层 +children, child 单 1.
            delete_count = 1
            if target_comment.parent_comment_id is None:
                from sqlalchemy import func

                child_count = int(
                    session.scalar(
                        select(func.count(NoteComment.id)).where(
                            NoteComment.parent_comment_id == target_comment.id
                        )
                    )
                    or 0
                )
                delete_count = 1 + child_count
            session.delete(target_comment)
            if parent_note is not None:
                parent_note.comments_count = max(
                    0, parent_note.comments_count - delete_count
                )
                parent_note.updated_at = utc_now()

    row.status = "reviewed"
    row.reviewed_by_admin_id = admin_user_id
    session.flush()
    session.refresh(row)
    return _to_report_out(row)
