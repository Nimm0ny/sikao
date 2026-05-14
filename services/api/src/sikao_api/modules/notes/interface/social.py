"""SIKAO Wave 10 Phase B — 笔记本社交化 user-facing endpoints.

跟 notebook_v2.py 互补:
  - notebook_v2.py    私人笔记本 CRUD + SM-2.
  - note_social_v2.py public toggle + 单题视图 list / count + comments + likes
                      / favorites + report.

8 个 endpoint:
  PATCH /api/v2/notebook/notes/{note_id}/public-toggle
    owner-only, 翻 is_public + display_anonymous, 首次 set public_at=now.
  GET   /api/v2/questions/{question_id}/public-notes
    单题视图 list (top voted, viewer-specific liked/favorited flag).
  POST  /api/v2/notebook/notes/{note_id}/comments              (rate 10/min/user)
  GET   /api/v2/notebook/notes/{note_id}/comments
  DELETE /api/v2/notebook/comments/{comment_id}                (owner only)
  POST  /api/v2/notebook/notes/{note_id}/likes                 (rate 30/min/user)
  POST  /api/v2/notebook/notes/{note_id}/favorites             (rate 30/min/user)
  POST  /api/v2/notebook/reports                               (rate 5/min/user)

Auth:
  - public-notes GET: 允许匿名 (用 optional current user 解析 liked/favorited).
  - 其他: 强制登录 (get_current_user, 401 if missing).

CSRF: 所有 mutating (PATCH/POST/DELETE) 走 verify_csrf_token_if_cookie_auth.

Rate-limit: 用 identifier_by_user_id (Phase B 本文件内定义) — 区别于 identifier_by_ip,
让单用户跨 IP 也能正确节流 (LAN / IPv6 公网共享场景).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.orm import Session

from sikao_api.core.limiter import identifier_by_ip, make_limiter
from sikao_api.db.session import get_db_session
from sikao_api.db import schemas
from sikao_api.db.models import User
from sikao_api.modules.notes.application import (
    note_comments,
    note_likes_favorites,
    note_reports,
    note_social,
)
from sikao_api.modules.auth.application.security import (
    get_current_user,
    get_optional_current_user,
    verify_csrf_token_if_cookie_auth,
)

router = APIRouter(prefix="/api/v2", tags=["notebook-social-v2"])


# ─── Rate-limit identifier: per-user (cookie/Bearer 解析后用 user.id) ─────────


async def identifier_by_user_id(request: Request) -> str:
    """Per-user rate-limit key.

    若 Authorization Bearer / cookie 解析出 user.id, 用 `user:{id}`. 解析失败
    fallback IP — 跟 identifier_by_body_phone 同 defensive pattern (绝不 raise,
    fastapi-limiter swallow 会让 limit 失效).

    实现走 try/except: 不重 deps 实例 (rate limiter 是早期阶段, get_current_user
    deps 有 db session 复杂副作用; 复用其内部解码逻辑解析 token → id).
    """
    try:
        from sikao_api.modules.auth.application.security import (
            _get_token_from_request,
            decode_access_token,
        )

        # Bearer header 解析 (cookie 解析在 _get_token_from_request 内部已支持).
        token = _get_token_from_request(request, None)
        if token is None:
            auth = request.headers.get("Authorization", "")
            if auth.startswith("Bearer "):
                token = auth.removeprefix("Bearer ").strip()
        if token:
            # Settings 走 app.state (lifespan startup 时挂上).
            settings = request.app.state.settings
            payload = decode_access_token(token, settings)
            user_id = int(payload["user_id"])
            return f"user:{user_id}"
    except Exception:  # noqa: BLE001 — must not raise inside identifier
        pass
    return await identifier_by_ip(request)


# ─── Public toggle ────────────────────────────────────────────────────────────


@router.patch(
    "/notebook/notes/{note_id}/public-toggle",
    response_model=schemas.NoteOutV2,
    status_code=status.HTTP_200_OK,
)
def patch_public_toggle(
    note_id: int,
    payload: schemas.NotePublicToggleV2,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    _csrf: Annotated[None, Depends(verify_csrf_token_if_cookie_auth)],
) -> schemas.NoteOutV2:
    """Owner-only toggle is_public + display_anonymous. Cross-user → 404."""
    return note_social.toggle_public(
        session,
        user_id=user.id,
        note_id=note_id,
        is_public=payload.is_public,
        display_anonymous=payload.display_anonymous,
    )


# ─── 单题视图 公开笔记 list / count ────────────────────────────────────────


@router.get(
    "/questions/{question_id}/public-notes",
    response_model=schemas.NotePublicListResponseV2,
    status_code=status.HTTP_200_OK,
)
def get_public_notes_for_question(
    question_id: int,
    session: Annotated[Session, Depends(get_db_session)],
    viewer: Annotated[User | None, Depends(get_optional_current_user)],
    limit: Annotated[int, Query(ge=1, le=50)] = 3,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> schemas.NotePublicListResponseV2:
    """单题视图 "下方公开笔记" top voted. 匿名访问允许 (liked_by_me/favorited_by_me
    全 false). limit ≤50, 默认 3 (头屏精简).
    """
    return note_social.list_public_notes_for_question(
        session,
        question_id=question_id,
        viewer_user_id=viewer.id if viewer is not None else None,
        limit=limit,
        offset=offset,
    )


# ─── Comments ────────────────────────────────────────────────────────────────


@router.post(
    "/notebook/notes/{note_id}/comments",
    response_model=schemas.NoteCommentOutV2,
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(
            make_limiter(times=10, minutes=1, identifier=identifier_by_user_id)
        ),
    ],
)
def post_comment(
    note_id: int,
    payload: schemas.NoteCommentCreateV2,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    _csrf: Annotated[None, Depends(verify_csrf_token_if_cookie_auth)],
) -> schemas.NoteCommentOutV2:
    """Create comment (一级嵌套). Rate-limit 10/min/user.

    Note 必须 is_public=true (404 不公开). parent_comment_id 非空时校验 一级
    嵌套, 否则 422.
    """
    return note_comments.create_comment(
        session, user_id=user.id, note_id=note_id, payload=payload
    )


@router.get(
    "/notebook/notes/{note_id}/comments",
    response_model=schemas.NoteCommentListV2,
    status_code=status.HTTP_200_OK,
)
def list_comments(
    note_id: int,
    session: Annotated[Session, Depends(get_db_session)],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> schemas.NoteCommentListV2:
    """List comments on a public note. 不要求登录 (公开内容).

    顶层 + child 一起返, ORDER BY created_at ASC. FE 按 parent_comment_id
    grouping 渲染嵌套.
    """
    return note_comments.list_comments(session, note_id=note_id, limit=limit)


@router.delete(
    "/notebook/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_comment(
    comment_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    _csrf: Annotated[None, Depends(verify_csrf_token_if_cookie_auth)],
) -> Response:
    """Owner-only delete. 跨用户 → 404."""
    note_comments.delete_comment(session, user_id=user.id, comment_id=comment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ─── Likes ───────────────────────────────────────────────────────────────────


@router.post(
    "/notebook/notes/{note_id}/likes",
    response_model=schemas.NoteLikeToggleResponseV2,
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(
            make_limiter(times=30, minutes=1, identifier=identifier_by_user_id)
        ),
    ],
)
def toggle_like(
    note_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    _csrf: Annotated[None, Depends(verify_csrf_token_if_cookie_auth)],
) -> schemas.NoteLikeToggleResponseV2:
    """Toggle like idempotent. Rate-limit 30/min/user. Note 不公开 → 404."""
    return note_likes_favorites.toggle_like(
        session, user_id=user.id, note_id=note_id
    )


# ─── Favorites ───────────────────────────────────────────────────────────────


@router.post(
    "/notebook/notes/{note_id}/favorites",
    response_model=schemas.NoteFavoriteToggleResponseV2,
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(
            make_limiter(times=30, minutes=1, identifier=identifier_by_user_id)
        ),
    ],
)
def toggle_favorite(
    note_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    _csrf: Annotated[None, Depends(verify_csrf_token_if_cookie_auth)],
) -> schemas.NoteFavoriteToggleResponseV2:
    """Toggle favorite idempotent. Rate-limit 30/min/user. Note 不公开 → 404."""
    return note_likes_favorites.toggle_favorite(
        session, user_id=user.id, note_id=note_id
    )


# ─── Report ──────────────────────────────────────────────────────────────────


@router.post(
    "/notebook/reports",
    response_model=schemas.NoteReportOutV2,
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(
            make_limiter(times=5, minutes=1, identifier=identifier_by_user_id)
        ),
    ],
)
def create_report(
    payload: schemas.NoteReportCreateV2,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    _csrf: Annotated[None, Depends(verify_csrf_token_if_cookie_auth)],
) -> schemas.NoteReportOutV2:
    """举报 note / comment. Rate-limit 5/min/user. Target 不存在 → 404."""
    return note_reports.create_report(
        session, reporter_user_id=user.id, payload=payload
    )
