from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from sikao_api.core.config import get_settings
from sikao_api.db.session import get_db_session
from sikao_api.db import schemas
from sikao_api.db.models import User
from sikao_api.modules.question_bank.application.exam_papers import ExamPaperService
from sikao_api.modules.auth.application.security import get_current_user, get_optional_current_user

router = APIRouter(prefix="/api/v2", tags=["papers-v2"])


@router.get("/papers", response_model=list[schemas.PaperSummaryV2])
def list_papers(
    session: Annotated[Session, Depends(get_db_session)],
    kind: Literal["essay"] | None = None,
) -> list[schemas.PaperSummaryV2]:
    """List public papers. Slice 2d: ?kind=essay 过滤含 essay 题的卷 (申论真题入口)."""
    return ExamPaperService(session).list_public_papers(kind=kind)


@router.get("/categories", response_model=schemas.CategoriesResponseV2)
def list_categories(
    session: Annotated[Session, Depends(get_db_session)],
    user: Annotated[User | None, Depends(get_optional_current_user)] = None,
) -> schemas.CategoriesResponseV2:
    """Phase 1.1 fenbi-merge — 6 大类聚合. 匿名调用 doneByUser=0."""
    return ExamPaperService(session).list_categories(
        user_id=user.id if user is not None else None,
    )


@router.get(
    "/papers/me/status",
    response_model=schemas.PaperUserStatusResponseV2,
    response_model_exclude_none=True,
)
def list_paper_user_status(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.PaperUserStatusResponseV2:
    """Phase 1.2 fenbi-merge — 当前用户对每个 public paper 的状态 overlay.

    需登录. 前端在题库列表页登录态下拉这个 endpoint, 跟 /papers join
    显示 status chip 三态.
    """
    return ExamPaperService(session).list_paper_user_status(user_id=user.id)


@router.get(
    "/papers/essay/list",
    response_model=schemas.EssayPaperListResponseV2,
)
def list_essay_papers_paginated(
    session: Annotated[Session, Depends(get_db_session)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50, alias="pageSize")] = 20,
) -> schemas.EssayPaperListResponseV2:
    """batch 5b: 申论卷分页 endpoint, 防 EssayPapers 745 套全量铺 ~67000px DOM
    把 LCP 拉爆 (CLAUDE.md §4 列表收口铁律). Home `/papers?kind=essay` slice
    前 2 走老 endpoint 不动.

    路由顺序: 必须放在 `/papers/{paper_code}` 之前, 否则 FastAPI 把 `essay/list`
    当成 paper_code='essay' 进 get_paper.
    """
    return ExamPaperService(session).list_essay_papers_paginated(
        page=page, page_size=page_size
    )


@router.get("/papers/{paper_code}", response_model=schemas.PaperDetailV2, response_model_exclude_none=True)
def get_paper(paper_code: str, session: Annotated[Session, Depends(get_db_session)]) -> schemas.PaperDetailV2:
    return ExamPaperService(session).get_public_paper_detail(paper_code)


@router.get("/papers/{paper_code}/questions", response_model=list[schemas.PaperQuestionItemV2])
def get_paper_questions(
    paper_code: str,
    session: Annotated[Session, Depends(get_db_session)],
) -> list[schemas.PaperQuestionItemV2]:
    return ExamPaperService(session).list_public_questions(paper_code)


@router.get("/questions/{question_id}", response_model=schemas.QuestionDetailV2)
def get_question(question_id: int, session: Annotated[Session, Depends(get_db_session)]) -> schemas.QuestionDetailV2:
    return ExamPaperService(session).get_public_question(question_id)


@router.get("/assets/questions/{asset_id}", response_model=None)
def get_question_asset(asset_id: int, session: Annotated[Session, Depends(get_db_session)]) -> FileResponse:
    """v1 上线设计 (alembic 0012, M1): asset.file_path 是 settings.assets_root 下
    的相对路径 (`<paperCode>/assets/<basename>`), 这里拼回 absolute. 解决 dev/prod
    路径切换 + 题库搬家不断的 known issue (CLAUDE.md §12 E)."""
    asset = ExamPaperService(session).get_question_asset(asset_id)
    absolute_path = get_settings().assets_root / asset.file_path
    return FileResponse(absolute_path, media_type=asset.mime_type or None)


@router.get("/assets/material-groups/{asset_id}", response_model=None)
def get_material_group_asset(asset_id: int, session: Annotated[Session, Depends(get_db_session)]) -> FileResponse:
    asset = ExamPaperService(session).get_material_group_asset(asset_id)
    absolute_path = get_settings().assets_root / asset.file_path
    return FileResponse(absolute_path, media_type=asset.mime_type or None)
