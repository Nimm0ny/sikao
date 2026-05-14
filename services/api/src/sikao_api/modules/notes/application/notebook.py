"""SIKAO Wave 4 Phase 2B (notebook module): 跨领域笔记本 service.

CRUD + SM-2 spaced repetition + due-queue + stats. 9 个 public 函数对应 9 个
endpoint, 加上算法 helper (`_update_sm2`).

并发: list / get 路径只读, 不加锁. write 路径 (create/update/delete/review)
由路由层每请求一 session 控制, 单 user 同时多 tab 写 last-writer-wins (业务可
接受, 不引悲观锁).

跨用户 IDOR: 所有 single-note 读写都先 SELECT id+user_id, 不命中 raise
NotFoundError → 路由层 404. 不让 attacker 用 ID 探别人 note 存在性.

Fail-fast: validation 失败 raise ServiceValidationError (422). 不存在 raise
NotFoundError (404). 不 silent fallback / dict.get default 兜底.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import case as sql_case
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from sikao_api.db.models import Note, NoteReview, utc_now
from sikao_api.db.schemas import (
    NoteAttachedToV2,
    NoteCreateV2,
    NoteListOutV2,
    NoteOutV2,
    NoteReviewListOutV2,
    NoteReviewOutV2,
    NoteReviewSubmitV2,
    NoteStatsV2,
    NoteUpdateV2,
)
from sikao_api.modules.system.application.errors import NotFoundError
from sikao_api.modules.system.application.errors import ValidationError as ServiceValidationError

logger = logging.getLogger(__name__)


# ── SM-2 spaced repetition 算法 ──────────────────────────────────────────────

# SM-2 ease 下限. 低于此值 quality<3 也不再下降, 防 ease 跌穿.
_SM2_MIN_EASE = 1.3
# SM-2 推荐 default ease (新 note initial).
_SM2_DEFAULT_EASE = 2.5


def _update_sm2(
    *,
    ease: float,
    review_count: int,
    recall_quality: int,
) -> tuple[float, int, datetime]:
    """SM-2 simplified algorithm.

    Returns (new_ease, interval_days, next_review_at).

    Rules:
      - quality < 3 (recall failed): reset interval=1d, ease -= 0.2 (clamp 1.3).
      - quality >= 3 (recall succeeded):
          - ease += 0.1 - (5-q) * (0.08 + (5-q) * 0.02)
          - interval = 1 (first review) / 6 (second) / round(prev_interval * ease).
      - 本简化版用 review_count 替代严格 prev_interval, 主流 anki-like 实现兼容.

    Raises:
        ServiceValidationError: recall_quality 不在 0-5.
    """
    if not 0 <= recall_quality <= 5:
        raise ServiceValidationError(
            f"recall_quality must be 0-5 (got {recall_quality})",
            code="note_review_invalid_quality",
        )

    if recall_quality < 3:
        new_ease = max(_SM2_MIN_EASE, ease - 0.2)
        interval = 1
    else:
        delta = 0.1 - (5 - recall_quality) * (
            0.08 + (5 - recall_quality) * 0.02
        )
        new_ease = max(_SM2_MIN_EASE, ease + delta)
        if review_count == 0:
            interval = 1
        elif review_count == 1:
            interval = 6
        else:
            # 简化: review_count * new_ease (rounding).
            # 严格 SM-2 用 prev_interval * new_ease — 这里牺牲精确换 schema 简洁.
            interval = max(1, int(round((review_count + 1) * new_ease)))

    next_at = utc_now() + timedelta(days=interval)
    return new_ease, interval, next_at


# ── body shape validation ──────────────────────────────────────────────────


def _validate_body_shape(note_type: str, body: dict[str, Any]) -> None:
    """Validate body_json shape matches the discriminated NoteType.

    schema 层不强制 (灵活), 这里业务层 fail-fast 防误存破 shape:
      quote     -> { text: str }
      method    -> { title: str, steps: [{ index: str, text: str }] }
      reflect   -> { text: str }
      material  -> { rows: [{ key: str, value: str }] }

    Raises:
        ServiceValidationError: shape 不匹配 (key 缺 / 类型错 / steps 非 list).
    """
    if note_type == "quote":
        if not isinstance(body.get("text"), str):
            raise ServiceValidationError(
                "quote body requires `text: str`",
                code="note_body_shape_invalid",
            )
    elif note_type == "method":
        if not isinstance(body.get("title"), str):
            raise ServiceValidationError(
                "method body requires `title: str`",
                code="note_body_shape_invalid",
            )
        steps = body.get("steps")
        if not isinstance(steps, list):
            raise ServiceValidationError(
                "method body requires `steps: list`",
                code="note_body_shape_invalid",
            )
        for idx, step in enumerate(steps):
            if not isinstance(step, dict):
                raise ServiceValidationError(
                    f"method.steps[{idx}] must be dict",
                    code="note_body_shape_invalid",
                )
            if not isinstance(step.get("index"), str) or not isinstance(
                step.get("text"), str
            ):
                raise ServiceValidationError(
                    f"method.steps[{idx}] requires `index: str` + `text: str`",
                    code="note_body_shape_invalid",
                )
    elif note_type == "reflect":
        if not isinstance(body.get("text"), str):
            raise ServiceValidationError(
                "reflect body requires `text: str`",
                code="note_body_shape_invalid",
            )
    elif note_type == "material":
        rows = body.get("rows")
        if not isinstance(rows, list):
            raise ServiceValidationError(
                "material body requires `rows: list`",
                code="note_body_shape_invalid",
            )
        for idx, row in enumerate(rows):
            if not isinstance(row, dict):
                raise ServiceValidationError(
                    f"material.rows[{idx}] must be dict",
                    code="note_body_shape_invalid",
                )
            if not isinstance(row.get("key"), str) or not isinstance(
                row.get("value"), str
            ):
                raise ServiceValidationError(
                    f"material.rows[{idx}] requires `key: str` + `value: str`",
                    code="note_body_shape_invalid",
                )
    else:
        raise ServiceValidationError(
            f"unsupported note type: {note_type}",
            code="note_type_invalid",
        )


# ── serializer ─────────────────────────────────────────────────────────────


def _to_note_out(row: Note) -> NoteOutV2:
    """SQLAlchemy Note row → NoteOutV2 Pydantic.

    attached_to JSONB dict → NoteAttachedToV2 (or None 若 row.attached_to None).
    body_json / tags 是 dict / list, 直接 passthrough.
    """
    attached: NoteAttachedToV2 | None = None
    if row.attached_to:
        attached = NoteAttachedToV2(
            wrong_answer_ids=list(row.attached_to.get("wrongAnswerIds", []))
            or list(row.attached_to.get("wrong_answer_ids", [])),
            question_type_ids=list(row.attached_to.get("questionTypeIds", []))
            or list(row.attached_to.get("question_type_ids", [])),
            xingce_question_ids=list(row.attached_to.get("xingceQuestionIds", []))
            or list(row.attached_to.get("xingce_question_ids", [])),
            paper_ids=list(row.attached_to.get("paperIds", []))
            or list(row.attached_to.get("paper_ids", [])),
        )
    return NoteOutV2(
        id=row.id,
        type=row.type,  # type: ignore[arg-type]
        body=row.body_json,
        source_kind=row.source_kind,  # type: ignore[arg-type]
        source_ref=row.source_ref,
        source_quote=row.source_quote,
        source_domain=row.source_domain,  # type: ignore[arg-type]
        title=row.title,
        tags=list(row.tags),
        attached_to=attached,
        visibility=row.visibility,  # type: ignore[arg-type]
        ease=row.ease,
        review_count=row.review_count,
        reviewed_at=row.reviewed_at,
        next_review_at=row.next_review_at,
        is_public=row.is_public,
        public_at=row.public_at,
        display_anonymous=row.display_anonymous,
        likes_count=row.likes_count,
        comments_count=row.comments_count,
        question_id=row.question_id,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _to_review_out(row: NoteReview) -> NoteReviewOutV2:
    return NoteReviewOutV2(
        id=row.id,
        note_id=row.note_id,
        reviewed_at=row.reviewed_at,
        recall_quality=row.recall_quality,
        ease_before=row.ease_before,
        ease_after=row.ease_after,
        interval_days=row.interval_days,
        next_review_at=row.next_review_at,
    )


# ── CRUD ───────────────────────────────────────────────────────────────────


def create_note(
    session: Session, *, user_id: int, payload: NoteCreateV2
) -> NoteOutV2:
    """Create new note. Validates body shape against type."""
    _validate_body_shape(payload.type, payload.body)

    attached_dict: dict[str, Any] | None = None
    if payload.attached_to is not None:
        # 存 camelCase 跟 FE TS type 对齐.
        attached_dict = {
            "wrongAnswerIds": list(payload.attached_to.wrong_answer_ids),
            "questionTypeIds": list(payload.attached_to.question_type_ids),
            "xingceQuestionIds": list(payload.attached_to.xingce_question_ids),
            "paperIds": list(payload.attached_to.paper_ids),
        }

    row = Note(
        user_id=user_id,
        type=payload.type,
        body_json=payload.body,
        source_kind=payload.source_kind,
        source_ref=payload.source_ref,
        source_quote=payload.source_quote,
        source_domain=payload.source_domain,
        title=payload.title,
        tags=list(payload.tags),
        attached_to=attached_dict,
        visibility=payload.visibility,
        ease=_SM2_DEFAULT_EASE,
        review_count=0,
        reviewed_at=None,
        next_review_at=None,
    )
    session.add(row)
    session.flush()
    session.refresh(row)
    return _to_note_out(row)


def _load_owned_note(
    session: Session, *, user_id: int, note_id: int
) -> Note:
    """Load note ensuring it belongs to user_id. Cross-user → 404.

    Raises:
        NotFoundError: id 不存在 OR 不属于该 user.
    """
    row = session.get(Note, note_id)
    if row is None or row.user_id != user_id:
        raise NotFoundError("note not found")
    return row


def get_note(
    session: Session, *, user_id: int, note_id: int
) -> NoteOutV2:
    row = _load_owned_note(session, user_id=user_id, note_id=note_id)
    return _to_note_out(row)


def update_note(
    session: Session,
    *,
    user_id: int,
    note_id: int,
    payload: NoteUpdateV2,
) -> NoteOutV2:
    """Patch note partial. None field = 不改; 显式空 list = 清空 (e.g. tags=[]).

    Type/body 互相依赖: 改 type 必须同时改 body (shape 不匹配 422). 单独改
    body 不改 type 则按当前 type 校验.
    """
    row = _load_owned_note(session, user_id=user_id, note_id=note_id)

    # type / body interdependency
    if payload.type is not None or payload.body is not None:
        new_type = payload.type if payload.type is not None else row.type
        new_body = payload.body if payload.body is not None else row.body_json
        _validate_body_shape(new_type, new_body)
        row.type = new_type
        row.body_json = new_body

    if payload.source_kind is not None:
        row.source_kind = payload.source_kind
    if payload.source_ref is not None:
        row.source_ref = payload.source_ref
    if payload.source_quote is not None:
        row.source_quote = payload.source_quote
    if payload.source_domain is not None:
        row.source_domain = payload.source_domain
    if payload.title is not None:
        row.title = payload.title
    if payload.tags is not None:
        row.tags = list(payload.tags)
    if payload.attached_to is not None:
        row.attached_to = {
            "wrongAnswerIds": list(payload.attached_to.wrong_answer_ids),
            "questionTypeIds": list(payload.attached_to.question_type_ids),
            "xingceQuestionIds": list(payload.attached_to.xingce_question_ids),
            "paperIds": list(payload.attached_to.paper_ids),
        }
    if payload.visibility is not None:
        row.visibility = payload.visibility

    row.updated_at = utc_now()
    session.flush()
    session.refresh(row)
    return _to_note_out(row)


def delete_note(
    session: Session, *, user_id: int, note_id: int
) -> None:
    """Delete note. note_reviews CASCADE 自动清."""
    row = _load_owned_note(session, user_id=user_id, note_id=note_id)
    session.delete(row)
    session.flush()


# ── List + filters ─────────────────────────────────────────────────────────


def list_notes(
    session: Session,
    *,
    user_id: int,
    type: str | None = None,
    source_domain: str | None = None,
    tag: str | None = None,
    cursor: int | None = None,
    limit: int = 20,
) -> NoteListOutV2:
    """List notes with filters + cursor pagination.

    Filters AND-combined (空过滤器 = 不限制). Pagination cursor by id DESC,
    取 limit+1 探 has_more. 不返 total — total 走独立 GET /stats.

    tag filter: list contains JSON op 跨方言不一致 (PG `@>` / SQLite `json_each`).
    实现走 LIKE on JSON-stringified tags (Postgres 操作 jsonb_array_elements
    + WHERE EXISTS 也可, 但 SQLite test path 需独立 SQL). 简化版: 应用层 in-row
    filter — 数据量小 (一 user N=百级) 接受成本. 量大后 P3 抽 GIN 索引.
    """
    stmt = select(Note).where(Note.user_id == user_id)
    if type is not None:
        stmt = stmt.where(Note.type == type)
    if source_domain is not None:
        stmt = stmt.where(Note.source_domain == source_domain)
    if cursor is not None:
        stmt = stmt.where(Note.id < cursor)
    stmt = stmt.order_by(Note.id.desc()).limit(limit + 1)

    rows = list(session.scalars(stmt).all())

    # tag filter in-row (post-SQL) — 跨方言简化
    if tag is not None:
        rows = [r for r in rows if tag in (r.tags or [])]

    has_more = len(rows) > limit
    items = rows[:limit]
    next_cursor = items[-1].id if has_more and items else None
    return NoteListOutV2(
        items=[_to_note_out(r) for r in items],
        next_cursor=next_cursor,
    )


# ── Stats ──────────────────────────────────────────────────────────────────


def get_stats(session: Session, *, user_id: int) -> NoteStatsV2:
    """Aggregate counts: total / due_count (next_review_at <= now OR NULL) /
    by_type / by_source_domain.

    一次 SQL 出全部 (CASE sum 模式, SQLite + PG 同), 不 N+1.
    """
    now = utc_now()

    # Total + due
    stmt_total_due = select(
        func.count(Note.id).label("total"),
        func.coalesce(
            func.sum(
                sql_case(
                    (Note.next_review_at.is_(None), 1),
                    (Note.next_review_at <= now, 1),
                    else_=0,
                )
            ),
            0,
        ).label("due_count"),
    ).where(Note.user_id == user_id)
    row_td = session.execute(stmt_total_due).one()

    # By type
    stmt_by_type = (
        select(Note.type, func.count(Note.id))
        .where(Note.user_id == user_id)
        .group_by(Note.type)
    )
    by_type_raw: dict[str, int] = {
        str(row[0]): int(row[1]) for row in session.execute(stmt_by_type).all()
    }
    by_type = {
        "quote": by_type_raw.get("quote", 0),
        "method": by_type_raw.get("method", 0),
        "reflect": by_type_raw.get("reflect", 0),
        "material": by_type_raw.get("material", 0),
    }

    # By source domain
    stmt_by_domain = (
        select(Note.source_domain, func.count(Note.id))
        .where(Note.user_id == user_id)
        .group_by(Note.source_domain)
    )
    by_domain_raw: dict[str, int] = {
        str(row[0]): int(row[1]) for row in session.execute(stmt_by_domain).all()
    }
    by_source_domain = {
        "xingce": by_domain_raw.get("xingce", 0),
        "essay": by_domain_raw.get("essay", 0),
    }

    return NoteStatsV2(
        total=int(row_td.total),
        due_count=int(row_td.due_count),
        by_type=by_type,  # type: ignore[arg-type]
        by_source_domain=by_source_domain,  # type: ignore[arg-type]
    )


# ── Review queue + submit ──────────────────────────────────────────────────


def get_due_reviews(
    session: Session,
    *,
    user_id: int,
    limit: int = 5,
    cursor: int | None = None,
) -> NoteListOutV2:
    """Get due review queue. ORDER BY next_review_at ASC NULLS FIRST.

    Due = next_review_at IS NULL (never reviewed) OR next_review_at <= now.
    NULLS FIRST 让新 note 先排 (first-review 一进队列就显示).

    cursor: id < cursor (secondary order). 数据量小, 主排序仍按 next_review_at.
    """
    now = utc_now()
    stmt = select(Note).where(
        Note.user_id == user_id,
        # NULL OR <= now (跨方言 OR + COALESCE 模式)
        # SQLite 不支持 NULLS FIRST keyword, 用 case 模拟
    )
    # filter: next_review_at NULL OR <= now
    stmt = stmt.where(
        (Note.next_review_at.is_(None)) | (Note.next_review_at <= now)
    )
    if cursor is not None:
        stmt = stmt.where(Note.id < cursor)
    # next_review_at NULL 排前 (CASE 模拟 NULLS FIRST), 然后 ASC, 然后 id DESC.
    stmt = stmt.order_by(
        sql_case((Note.next_review_at.is_(None), 0), else_=1),
        Note.next_review_at.asc(),
        Note.id.desc(),
    ).limit(limit + 1)

    rows = list(session.scalars(stmt).all())
    has_more = len(rows) > limit
    items = rows[:limit]
    next_cursor = items[-1].id if has_more and items else None
    return NoteListOutV2(
        items=[_to_note_out(r) for r in items],
        next_cursor=next_cursor,
    )


def submit_review(
    session: Session,
    *,
    user_id: int,
    note_id: int,
    payload: NoteReviewSubmitV2,
) -> NoteOutV2:
    """User 反馈 quality → SM-2 重算 ease/interval/next_review_at + audit row.

    返 updated note (含新 ease + next_review_at). audit row 通过 GET reviews 查.
    """
    row = _load_owned_note(session, user_id=user_id, note_id=note_id)

    ease_before = row.ease
    new_ease, interval_days, next_at = _update_sm2(
        ease=row.ease,
        review_count=row.review_count,
        recall_quality=payload.recall_quality,
    )

    now = utc_now()
    row.ease = new_ease
    row.review_count = row.review_count + 1
    row.reviewed_at = now
    row.next_review_at = next_at
    row.updated_at = now

    audit = NoteReview(
        note_id=row.id,
        user_id=user_id,
        reviewed_at=now,
        recall_quality=payload.recall_quality,
        ease_before=ease_before,
        ease_after=new_ease,
        interval_days=interval_days,
        next_review_at=next_at,
    )
    session.add(audit)
    session.flush()
    session.refresh(row)
    return _to_note_out(row)


def list_reviews(
    session: Session,
    *,
    user_id: int,
    note_id: int,
) -> NoteReviewListOutV2:
    """List review audit history for a note. Cross-user → 404 (load_owned check)."""
    _load_owned_note(session, user_id=user_id, note_id=note_id)
    stmt = (
        select(NoteReview)
        .where(NoteReview.note_id == note_id)
        .order_by(NoteReview.reviewed_at.desc())
    )
    rows = list(session.scalars(stmt).all())
    return NoteReviewListOutV2(items=[_to_review_out(r) for r in rows])
