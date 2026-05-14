"""学习计划 endpoints — Slice 3a + 3c + 3d.

4 endpoints:
  GET   /api/v2/study-plan/today       # 拿今日 plan, 不存在则同步生成 (D2, Slice 3a)
  PATCH /api/v2/study-plan/tasks/{id}  # 改 task status (pending → completed/skipped, Slice 3a)
  GET   /api/v2/study-plan/history     # 历史 plan 列表 (cursor 分页, slim, Slice 3c)
  GET   /api/v2/study-plan/{plan_id}   # 按 id 拿完整 plan + tasks (Slice 3d 详情页)

GET /today 是 async (内部 await LLM call); PATCH /tasks + GET /history 是 sync.

跨用户 404 (跟 essay_v2 / llm_conversations_v2 一致): 别人的 task PATCH 不返
403/404 区分, 统一 'not found' 防 leak task 存在性. 已 finalized task 改 status
返 422 (业务状态机非法转移).

DB 行 → Pydantic outer discriminated union 走 TypeAdapter.validate_python,
按 task_kind 自动 narrow 到 PracticeTaskResponse / ReviewWrongTaskResponse /
EssayWritingTaskResponse — schemas.py §4.3 outer union 落点. FastAPI auto OpenAPI
输出 oneOf+discriminator, FE openapi-typescript regen 拿到 narrow union.

GET /history 返 StudyPlanHistoryListV2 slim — 不含 task payload, 详情页 (3d) 才用
full StudyPlanResponse. cursor 走 plan_date date 强类型, FastAPI 自动 422 非法格式.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from pydantic import TypeAdapter
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.core.deps import get_app_settings
from sikao_api.db.session import get_db_session
from sikao_api.db import schemas
from sikao_api.db.models import StudyPlan, StudyPlanTask, User
from sikao_api.modules.auth.application.security import get_current_user, verify_csrf_token
from sikao_api.modules.study_record.application.study_plans import StudyPlanService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v2/study-plan", tags=["study-plan-v2"])

# Adapter 用于反向 narrow: DB row → outer discriminated union (schemas.py §4.3 用法).
# Module-level cache 避免每次请求重建 adapter.
_TASK_RESPONSE_ADAPTER: TypeAdapter[schemas.StudyTaskResponse] = TypeAdapter(
    schemas.StudyTaskResponse
)


@router.get(
    "/today",
    response_model=schemas.StudyPlanResponse,
    status_code=status.HTTP_200_OK,
)
async def get_today_plan(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> schemas.StudyPlanResponse:
    """拿今日 plan. 不存在则同步生成 (D2 阻塞模式, deepseek-flash ~3-5s).

    分支:
    - cache hit (当天已有) → 直接返
    - cold start (用户答题量 < 阈值 OR 近 7 天 0 答题) → fallback_cold_start
    - LLM 路径成功 → success
    - LLM 任一段失败 → fallback_llm_failed (FE 据 generation_status banner 区分)
    """
    service = StudyPlanService(session, settings)
    plan, outcome = await service.get_or_create_today(user_id=user.id)

    # metric: route 层埋点 outcome.flow 让 ops dashboard 区分 cache_hit /
    # cold_start / llm_success / llm_failed 比例
    logger.info(
        "study_plan.get_today user_id=%s plan_id=%s flow=%s status=%s",
        user.id, plan.id, outcome.flow, outcome.generation_status,
    )

    return _serialize_plan(plan)


@router.get(
    "/history",
    response_model=schemas.StudyPlanHistoryListV2,
    status_code=status.HTTP_200_OK,
)
def list_history(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    cursor: Annotated[date | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> schemas.StudyPlanHistoryListV2:
    """Slice 3c: 列出过去的 plan (排除今日, plan_date < today_shanghai).

    Cursor 分页 by plan_date desc, FE useInfiniteQuery 拿 next_cursor 翻下一页.
    cursor 强类型 `date` — 非法格式 (?cursor=foo / ?cursor=2099-13-99) 自动 422.
    limit 范围 [1, 50] 之外自动 422 (fail-fast, CLAUDE.md §4).
    """
    service = StudyPlanService(session, settings)
    items, next_cursor = service.list_history(
        user_id=user.id, cursor=cursor, limit=limit
    )
    return schemas.StudyPlanHistoryListV2(
        items=[
            schemas.StudyPlanHistoryItemV2(
                id=row.id,
                plan_date=row.plan_date,
                generation_status=row.generation_status,
                task_total=row.task_total,
                task_completed=row.task_completed,
                created_at=row.created_at,
            )
            for row in items
        ],
        next_cursor=next_cursor,
    )


@router.get(
    "/{plan_id}",
    response_model=schemas.StudyPlanResponse,
    status_code=status.HTTP_200_OK,
)
def get_plan_detail(
    plan_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> schemas.StudyPlanResponse:
    """Slice 3d: 按 plan_id 拿完整 plan + tasks (复用 StudyPlanResponse).

    跨用户 / 不存在 → 404 (统一不暴露 plan 存在性). FastAPI int converter 自动
    422 非法 path param ('abc' / 0 / 负数), 不需要 service 校验.
    """
    service = StudyPlanService(session, settings)
    plan = service.get_plan_by_id(user_id=user.id, plan_id=plan_id)
    return _serialize_plan(plan)


@router.patch(
    "/tasks/{task_id}",
    response_model=schemas.StudyTaskResponse,
    status_code=status.HTTP_200_OK,
)
def patch_task_status(
    task_id: int,
    payload: schemas.StudyTaskPatchRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    _csrf: Annotated[None, Depends(verify_csrf_token)],
) -> schemas.StudyTaskResponse:
    """改 task status. 单向 pending → completed/skipped (D4).

    - 跨用户 → 404 (NotFoundError, 防 leak task 存在性)
    - 当前 status != 'pending' → 422 (ServiceValidationError, 已 finalized)
    """
    service = StudyPlanService(session, settings)
    task = service.patch_task_status(
        user_id=user.id, task_id=task_id, new_status=payload.status
    )
    return _serialize_task(task)


# ── 序列化 helper ─────────────────────────────────────────────────────────


def _serialize_plan(plan: StudyPlan) -> schemas.StudyPlanResponse:
    """StudyPlan ORM → StudyPlanResponse. tasks 走 outer discriminated union narrow."""
    return schemas.StudyPlanResponse(
        id=plan.id,
        plan_date=plan.plan_date,
        generation_status=plan.generation_status,  # type: ignore[arg-type]
        created_at=plan.created_at,
        tasks=[_serialize_task(t) for t in plan.tasks],
    )


def _serialize_task(task: StudyPlanTask) -> schemas.StudyTaskResponse:
    """StudyPlanTask ORM → outer discriminated union. payload_json (JSON dict)
    + task_kind (Literal 字符串) 喂给 TypeAdapter, 按 task_kind narrow 到子类."""
    return _TASK_RESPONSE_ADAPTER.validate_python(
        {
            "id": task.id,
            "task_kind": task.task_kind,
            "payload": task.payload_json,
            "display_order": task.display_order,
            "status": task.status,
            "completed_at": task.completed_at,
            "created_at": task.created_at,
        }
    )
