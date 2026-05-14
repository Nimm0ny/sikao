"""SIKAO Wave 4 Phase 2C — essay-specialty 聚合 endpoint routes.

4 read-only endpoint (无 schema migration):

  GET /api/v2/papers/essay/specialty/summary    → StatStrip totals + ResumeHero
  GET /api/v2/papers/essay/specialty/categories → CategoryCard 5 大类 + 子行三态
  GET /api/v2/papers/essay/list/extended        → PaperRow 扩字段 (region/track/...)
  GET /api/v2/papers/essay/filters              → 可选 regions / years / paperTypes

设计选择:
  - 走独立 router (prefix=/api/v2/papers/essay) 跟 papers_v2 / essay_v2 解耦,
    避免污染既有路由的责任范围
  - /list/extended 用 sub-path 避免跟 papers_v2.list_essay_papers_paginated
    (/api/v2/papers/essay/list) 冲突. Y2-FE wire 完后两个 list endpoint 共存:
      老 list (PaperSummaryV2) → Home `?kind=essay` slice 前 N
      新 list/extended (扩字段 + user state) → /essay/papers view 完整 list
  - summary / categories 需要登录 (per-user data); filters / list/extended 也
    在登录态调用 (extended 需 user_id 算 progress/lastAttempt)

配套 docs/plan/sikao-module-essay-specialty-2026-05-11.md.
"""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from sikao_api.db.session import get_db_session
from sikao_api.db import schemas
from sikao_api.db.models import User
from sikao_api.modules.essay.application.essay_specialty import EssaySpecialtyAggregationService
from sikao_api.modules.auth.application.security import get_current_user, get_optional_current_user

router = APIRouter(prefix="/api/v2/papers/essay", tags=["essay-specialty-v2"])


@router.get(
    "/specialty/summary",
    response_model=schemas.EssaySpecialtySummaryV2,
)
def get_essay_specialty_summary(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.EssaySpecialtySummaryV2:
    """SIKAO essay-specialty hero band 数据.

    Returns:
      totals: StatStrip 4 格 (practiced / total / streakDays / weekDone / avgScore)
      resume: ResumeHero 续答 (无 grading record → None, FE 隐藏 hero)
    """
    return EssaySpecialtyAggregationService(session).get_specialty_summary(
        user_id=user.id,
    )


@router.get(
    "/specialty/categories",
    response_model=schemas.EssaySpecialtyCategoriesResponseV2,
)
def get_essay_specialty_categories(
    session: Annotated[Session, Depends(get_db_session)],
    user: Annotated[User | None, Depends(get_optional_current_user)] = None,
) -> schemas.EssaySpecialtyCategoriesResponseV2:
    """CategoryCard 5 大类 + per-question 状态 (done / progress / pending).

    匿名调用 (user=None) → 全 status='pending'. 后端拆开 6 类 (公文 + 应用文 分行),
    FE 按 plan §2.1 合并 "公文 · 应用文" 显 5 卡.

    每类返前 6 道题 (sub-grid 2 列 × 3 行典型展示); state='empty' 当该类 total=0.
    """
    return EssaySpecialtyAggregationService(session).get_specialty_categories(
        user_id=user.id if user is not None else None,
    )


@router.get(
    "/list/extended",
    response_model=schemas.EssayPapersListExtendedResponseV2,
)
def list_essay_papers_extended(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50, alias="pageSize")] = 20,
    region: Annotated[str | None, Query(max_length=64)] = None,
    year: Annotated[int | None, Query(ge=1900, le=2100)] = None,
    paper_type: Annotated[str | None, Query(max_length=64, alias="paperType")] = None,
    sort: Annotated[
        Literal["default", "year", "recent"],
        Query(),
    ] = "default",
) -> schemas.EssayPapersListExtendedResponseV2:
    """EssayPapers view 扩字段 list.

    扩字段: region / track / difficulty / status / progress / lastAttempt / pinned.
    需登录 (status / progress / lastAttempt 是 per-user).

    Query:
      page / pageSize: 标准分页 (1-based, pageSize ∈ [1,50])
      region: "国考" / "省考" / source_provider 名 / 缺省=全部
      year: exam_year exact match / 缺省=全部
      paperType: source_kind exact match / 缺省=全部
      sort: default(sort_order DESC) / year(year DESC) / recent(lastAttempt DESC)
    """
    return EssaySpecialtyAggregationService(session).list_essay_papers_extended(
        user_id=user.id,
        page=page,
        page_size=page_size,
        region=region,
        year=year,
        paper_type=paper_type,
        sort=sort,
    )


@router.get(
    "/filters",
    response_model=schemas.EssayPapersFiltersResponseV2,
)
def get_essay_papers_filters(
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.EssayPapersFiltersResponseV2:
    """FiltersPanel chip 候选集 (regions / years / paperTypes).

    匿名可调用 (元数据非 user-specific).
    """
    return EssaySpecialtyAggregationService(session).get_essay_papers_filters()
