"""SIKAO Wave 10 Phase B — admin 审核 note/comment 举报 queue.

3 endpoints:
  GET   /api/v2/admin/note-reports?status=pending&limit=50&offset=0
    Pending FIFO queue + total + pending_count + target_preview.
  POST  /api/v2/admin/note-reports/{report_id}/dismiss
    改 status=dismissed, target 保留.
  POST  /api/v2/admin/note-reports/{report_id}/approve-delete
    cascade 删 target (note → comments/likes/favorites/reviews; comment →
    children) + 改 status=reviewed.

Auth: HTTP Basic via get_admin_principal (跟 admin_v2.py 同源). 当前
reviewed_by_admin_id 存 None (admin Basic 是 username str 不是 User.id); 未来
admin 切到 cookie session 后 service 接受 admin_user_id: int 不改 signature.

CSRF: mutating endpoints 走 verify_csrf_token_if_cookie_auth (admin HTTP Basic
没 cookie, dep skip; 未来 admin cookie 化时自动启用).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from sikao_api.db.session import get_db_session
from sikao_api.db import schemas
from sikao_api.modules.notes.application import note_reports
from sikao_api.modules.auth.application.security import (
    get_admin_principal,
    verify_csrf_token_if_cookie_auth,
)

router = APIRouter(prefix="/api/v2/admin", tags=["admin-note-reports-v2"])


@router.get(
    "/note-reports",
    response_model=schemas.NoteAdminQueueResponseV2,
)
def list_admin_note_reports(
    _admin: Annotated[str, Depends(get_admin_principal)],
    session: Annotated[Session, Depends(get_db_session)],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> schemas.NoteAdminQueueResponseV2:
    """Admin queue: status='pending' FIFO. items 拼 target_preview + reporter
    display_name. response 含 total (所有 status) + pending_count.
    """
    return note_reports.list_pending_reports(
        session, limit=limit, offset=offset
    )


@router.post(
    "/note-reports/{report_id}/dismiss",
    response_model=schemas.NoteReportOutV2,
    dependencies=[Depends(verify_csrf_token_if_cookie_auth)],
)
def dismiss_report(
    report_id: int,
    _admin: Annotated[str, Depends(get_admin_principal)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.NoteReportOutV2:
    """改 status=dismissed, target 保留. 已 review 的 report 重复 → 422."""
    return note_reports.review_report(
        session, admin_user_id=None, report_id=report_id, action="dismiss"
    )


@router.post(
    "/note-reports/{report_id}/approve-delete",
    response_model=schemas.NoteReportOutV2,
    dependencies=[Depends(verify_csrf_token_if_cookie_auth)],
)
def approve_delete_report(
    report_id: int,
    _admin: Annotated[str, Depends(get_admin_principal)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.NoteReportOutV2:
    """Cascade 删 target (note / comment) + 改 status=reviewed. 已 review → 422.

    note target → ORM cascade 带走 comments / likes / favorites / note_reviews.
    comment target → ORM cascade 带走 children. 同 transaction 维护 notes.comments_count.
    """
    return note_reports.review_report(
        session,
        admin_user_id=None,
        report_id=report_id,
        action="approve_delete",
    )
