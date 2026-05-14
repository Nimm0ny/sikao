"""SIKAO 行测 specialty — 4 read-only 聚合 endpoint routes (mirror essay_specialty_v2).

配套 sikao (6).zip lhr 提供的 essay-redesign.html hifi 复用到行测专项. 4 endpoint:

  GET /api/v2/papers/xingce/specialty/summary    → StatStrip totals + ResumeHero
  GET /api/v2/papers/xingce/specialty/categories → CategoryCard 5 大类 + 子行三态
  GET /api/v2/papers/xingce/list/extended        → PaperRow 扩字段 (region/track/...)
  GET /api/v2/papers/xingce/filters              → regions / years / paperTypes

设计选择 (跟 essay 镜像):
  - 独立 router (prefix=/api/v2/papers/xingce) 跟 papers_v2 解耦
  - summary / list/extended 需要登录 (per-user data)
  - categories / filters 匿名可调用 (前者匿名全 pending; 后者元数据非 user-specific)
"""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from sikao_api.db.session import get_db_session
from sikao_api.db import schemas
from sikao_api.db.models import User
from sikao_api.modules.auth.application.security import get_current_user, get_optional_current_user
from sikao_api.modules.analytics.application.xingce_specialty import XingceSpecialtyAggregationService

router = APIRouter(prefix="/api/v2/papers/xingce", tags=["xingce-specialty-v2"])


@router.get(
    "/specialty/summary",
    response_model=schemas.XingceSpecialtySummaryV2,
)
def get_xingce_specialty_summary(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.XingceSpecialtySummaryV2:
    """行测 specialty hero band 数据.

    Returns:
      totals: StatStrip (practiced / total / streakDays / weekDone / avgScore=正确率%)
      resume: ResumeHero 续答 (无 answer → None, FE 隐藏 hero)
    """
    return XingceSpecialtyAggregationService(session).get_specialty_summary(
        user_id=user.id,
    )


@router.get(
    "/specialty/categories",
    response_model=schemas.XingceSpecialtyCategoriesResponseV2,
)
def get_xingce_specialty_categories(
    session: Annotated[Session, Depends(get_db_session)],
    user: Annotated[User | None, Depends(get_optional_current_user)] = None,
) -> schemas.XingceSpecialtyCategoriesResponseV2:
    """CategoryCard 5 大类 + per-question 状态 (done / progress / pending).

    匿名调用 (user=None) → 全 status='pending'. 5 大类固定: 言语 / 判断 / 数量 /
    资料 / 常识. 非 5 大类的细分 subtype (e.g. "图形推理" / "公共基础知识") 通过
    keyword bucket 归并 (见 services/xingce_specialty.py _XINGCE_CATEGORIES).

    每类返前 6 道题 (sub-grid 2 列 × 3 行典型展示); state='empty' 当该类 total=0.
    """
    return XingceSpecialtyAggregationService(session).get_specialty_categories(
        user_id=user.id if user is not None else None,
    )


@router.get(
    "/list/extended",
    response_model=schemas.XingcePapersListExtendedResponseV2,
)
def list_xingce_papers_extended(
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
) -> schemas.XingcePapersListExtendedResponseV2:
    """XingcePapers view 扩字段 list.

    扩字段: region / track='gk' / difficulty / status / progress / lastAttempt /
    pinned. 需登录 (status / progress / lastAttempt 是 per-user).

    Query:
      page / pageSize: 标准分页 (1-based, pageSize ∈ [1,50])
      region: "国考" / "省考" / source_provider 名 / 缺省=全部
      year: exam_year exact match / 缺省=全部
      paperType: source_kind exact match / 缺省=全部
      sort: default(sort_order DESC) / year(year DESC) / recent(lastAttempt DESC)
    """
    return XingceSpecialtyAggregationService(session).list_xingce_papers_extended(
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
    response_model=schemas.XingcePapersFiltersResponseV2,
)
def get_xingce_papers_filters(
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.XingcePapersFiltersResponseV2:
    """FiltersPanel chip 候选集 (regions / years / paperTypes).

    匿名可调用 (元数据非 user-specific).
    """
    return XingceSpecialtyAggregationService(session).get_xingce_papers_filters()
