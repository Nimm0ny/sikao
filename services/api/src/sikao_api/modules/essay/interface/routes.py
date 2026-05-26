"""申论批改 endpoints — Slice 2c.

3 endpoints (plan §4.2):
  POST /api/v2/essay/grade        # 提交答案 → BackgroundTask 异步评分, 200 + grading_id
  GET  /api/v2/essay/grades/{id}  # 查批改状态/结果 (前端轮询 ~1 秒一次)
  GET  /api/v2/essay/grades       # 列我的批改历史

POST mutating → verify_csrf_token 强制. async 评分走 FastAPI BackgroundTasks,
立即返 pending record 让前端拿 id 轮询 (PoC 单机够用, 不上 celery).

跨用户 404 (跟 Slice 1a LlmConversation 一致): 别人的 record GET 不返 403/404
区分, 统一 'not found' 防 leak record 存在性.
"""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Annotated, Any

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    Request,
    status,
)
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.core.deps import get_app_settings
from sikao_api.db.session import get_db_session
from sikao_api.db import schemas
from sikao_api.db.models import EssayDraftRecord, EssayGradingRecord, User
from sikao_api.modules.essay.application.essay_draft import EssayDraftService
from sikao_api.modules.essay.application.essay_grading import (
    EssayGradingService,
    grade_essay_record_async,
)
from sikao_api.modules.auth.application.security import (
    get_current_user,
    get_optional_current_user,
    verify_csrf_token,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v2/essay", tags=["essay-v2"])


@router.post(
    "/grade",
    response_model=schemas.EssayGradingV2,
    status_code=status.HTTP_200_OK,
)
def submit_essay_grade(
    payload: schemas.EssayGradingSubmissionV2,
    request: Request,
    background_tasks: BackgroundTasks,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    _csrf: Annotated[None, Depends(verify_csrf_token)],
) -> schemas.EssayGradingV2:
    """创建 pending grading record + schedule LLM 评分 BackgroundTask."""
    service = EssayGradingService(session)
    record = service.submit(
        user_id=user.id,
        question_id=payload.question_id,
        answer_text=payload.answer_text,
    )
    # 显式 commit — BackgroundTask 跑前 record 必须落库, 不然 fresh session 读
    # 不到. dep cleanup (db/session.py:43) 的隐式 commit 在 FastAPI 0.135 里跑
    # 在 response 序列化之后, 理论上仍早于 bg task; 但 IntegrityError 等 commit
    # 失败若发生在 dep cleanup 时, 用户已收到 200 响应, 行为不一致. 显式 commit
    # 把 commit-failure 锁回 handler 异常路径 → exception_handler 转 500 →
    # add_task 不会执行, 用户收到错误而非"幻影 record".
    session.commit()
    session_factory = request.app.state.db.session_factory
    background_tasks.add_task(
        grade_essay_record_async, session_factory, settings, record.id
    )
    return _serialize_record(record)


@router.get(
    "/grades/{record_id}",
    response_model=schemas.EssayGradingV2,
)
def get_my_essay_grade(
    record_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.EssayGradingV2:
    record = EssayGradingService(session).get_my_record(
        user_id=user.id, record_id=record_id
    )
    return _serialize_record(record)


@router.get(
    "/grades",
    response_model=list[schemas.EssayGradingV2],
)
def list_my_essay_grades(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> list[schemas.EssayGradingV2]:
    records = EssayGradingService(session).list_my_records(
        user_id=user.id, limit=20
    )
    return [_serialize_record(r) for r in records]


# ── Phase D: 申论专项练习 (跨卷单题) ─────────────────────────────────────


@router.get(
    "/categories",
    response_model=schemas.CategoriesResponseV2,
)
def list_essay_categories(
    session: Annotated[Session, Depends(get_db_session)],
    user: Annotated[User | None, Depends(get_optional_current_user)] = None,
) -> schemas.CategoriesResponseV2:
    """#18 申论专项 category tree (方案 B 修订版).

    跨 745 套申论真题按 canonical_subtype 聚合, 跟 /api/v2/categories (行测)
    视觉对称. doneByUser 走 EssayGradingRecord status='completed' (申论 SSOT,
    不是 PracticeSession.answer 行测路径).

    匿名调用 (user=None) → doneByUser 全 0. 返 6 行 raw (公文/应用文 各自一行),
    前端合并 '公文 · 应用文' 显 5 卡.
    """
    return EssayGradingService(session).list_essay_categories(
        user_id=user.id if user is not None else None,
    )


@router.get(
    "/specialty/questions",
    response_model=schemas.EssaySpecialtyListResponseV2,
)
def list_essay_specialty_questions(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    subtype: Annotated[
        str,
        Query(
            min_length=1,
            max_length=128,
            description=(
                "canonical_subtype 单值或逗号分隔多值. "
                "白名单: 归纳概括 / 大作文 / 综合分析 / 公文 / 应用文 / 提出对策. "
                "前端 '公文 · 应用文' chip 传 'subtype=公文,应用文' (规范官 P0-3 2026-05-08)."
            ),
        ),
    ],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[
        int, Query(ge=1, le=50, alias="pageSize")
    ] = 20,
) -> schemas.EssaySpecialtyListResponseV2:
    """跨卷列出某 canonical_subtype 下的全部 essay 题, paginate.

    需登录 (last_answered_at 是 per-user 计算). subtype 不在白名单 / 库里
    没题 → 返 total=0 + items=[] (不 404, 让前端 chip 仍可切换).

    多值 (规范官 P0-3 2026-05-08): subtype 接受逗号分隔多值, e.g.
    `?subtype=公文,应用文`. service 层做 IN 查询, 视觉上视作"合并类".

    See app/services/essay_grading.py:list_specialty_questions.
    """
    subtypes = [s.strip() for s in subtype.split(",") if s.strip()]
    if not subtypes:
        # 整个 subtype 串只有空白/逗号 — 422 (跟 Query min_length 语义对齐)
        from sikao_api.modules.system.application.errors import ValidationError as _VErr

        raise _VErr("subtype must contain at least one non-empty value")
    return EssayGradingService(session).list_specialty_questions(
        user_id=user.id,
        subtypes=subtypes,
        page=page,
        page_size=page_size,
    )


# ── PR13 P5: 申论草稿持久化 endpoints ────────────────────────────────────


@router.post(
    "/drafts",
    response_model=schemas.EssayDraftV2,
    status_code=status.HTTP_200_OK,
)
def save_essay_draft(
    payload: schemas.EssayDraftSubmissionV2,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    _csrf: Annotated[None, Depends(verify_csrf_token)],
) -> schemas.EssayDraftV2:
    """FE autosave 入口 — 同 (user, question) upsert 草稿.

    URL deviation from plan §8 (master 拍板): plan 写
    /api/v2/essay/sessions/{session_id}/draft, BE 现状没 session 实体,
    upsert 按 (user_id, question_id) — 简化 URL 到 /drafts. session_id
    是 FE 路由 namespace, 不需 BE 实体对应.
    """
    record = EssayDraftService(session).upsert(
        user_id=user.id,
        question_id=payload.question_id,
        typed_draft=payload.typed_draft,
        handwritten_draft_metadata=payload.handwritten_draft_metadata,
    )
    # 跟 submit_essay_grade 一致: 显式 commit 把 commit-failure 锁回
    # handler 异常路径 → 用户收到错误而非"幻影 record".
    session.commit()
    return _serialize_draft(record)


@router.get(
    "/drafts/{question_id}",
    response_model=schemas.EssayDraftV2,
)
def get_my_essay_draft(
    question_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.EssayDraftV2:
    """获取当前用户某题的最新草稿; 跨用户 / 没存过 → 404 防 leak.

    EssayDraftService.get_my_draft 已按 user_id 过滤, 拿别人的 draft id
    在本 endpoint 里不可能 (走 question_id 不走 record_id). 没草稿
    → record None → 404 跟 EssayGrading 一致.
    """
    record = EssayDraftService(session).get_my_draft(
        user_id=user.id, question_id=question_id
    )
    if record is None:
        raise HTTPException(status_code=404, detail="draft not found")
    return _serialize_draft(record)


# ── 序列化 helper ─────────────────────────────────────────────────────────


def _serialize_record(record: EssayGradingRecord) -> schemas.EssayGradingV2:
    """ORM → EssayGradingV2 schema. score Decimal → float."""
    return schemas.EssayGradingV2(
        id=record.id,
        question_id=record.question_id,
        answer_text=record.answer_text,
        status=record.status,  # type: ignore[arg-type]
        score=_decimal_to_float(record.score),
        feedback=_serialize_feedback(record.feedback_json),
        failure_reason=record.failure_reason,
        created_at=record.created_at,
        graded_at=record.graded_at,
    )


def _decimal_to_float(value: Decimal | None) -> float | None:
    return float(value) if value is not None else None


def _serialize_feedback(
    raw: dict[str, Any] | None,
) -> schemas.EssayFeedbackV2 | None:
    """feedback_json (JSON 列) → EssayFeedbackV2.

    1st review P2-B: feedback_json 是我们自己 sanity check 后写入的, shape 不
    可能错. 不再吞异常 — Pydantic ValidationError 直接抛 (500), 让 server log +
    request_id 能追到 row 是哪条. 跟 CLAUDE.md fail-fast 对齐.
    """
    if raw is None:
        return None
    if not isinstance(raw, dict):
        # JSON 列偶发存非 dict (manual SQL 改) — log + 当未完成显示, 不 500
        logger.warning(
            "essay grading feedback_json is not a dict: type=%s", type(raw).__name__
        )
        return None
    return schemas.EssayFeedbackV2.model_validate(raw)


def _serialize_draft(record: EssayDraftRecord) -> schemas.EssayDraftV2:
    """ORM → EssayDraftV2 schema.

    handwritten_draft_metadata 列是 JSONB_COMPAT (PG=JSONB / SQLite=JSON). 默认
    存的是 dict, 但跟 _serialize_feedback 一致防御性 isinstance — 若有人手 SQL
    改成非 dict (list / str), log + 当未提供, 不 500.
    """
    metadata = record.handwritten_draft_metadata
    if metadata is not None and not isinstance(metadata, dict):
        logger.warning(
            "essay_draft.handwritten_draft_metadata is not a dict: type=%s",
            type(metadata).__name__,
        )
        metadata = None
    return schemas.EssayDraftV2(
        id=record.id,
        question_id=record.question_id,
        typed_draft=record.typed_draft,
        handwritten_draft_metadata=metadata,
        saved_at=record.saved_at,
        updated_at=record.updated_at,
    )
