from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from sikao_api.db.schemas_v2 import CatalogListResponseV2, PracticeCenterResponseV2
from sikao_api.db.session import get_db_session
from sikao_api.modules.content.application.service import (
    build_essay_categories,
    build_essay_papers,
    build_practice_center_overview,
    build_xingce_categories,
    build_xingce_papers,
)

router = APIRouter(prefix="/api/v2/practice", tags=["content-v2"])


@router.get("/center", response_model=PracticeCenterResponseV2)
def get_practice_center(
    session: Annotated[Session, Depends(get_db_session)],
) -> PracticeCenterResponseV2:
    return build_practice_center_overview(session)


@router.get("/xingce/categories", response_model=CatalogListResponseV2)
def list_xingce_categories(
    session: Annotated[Session, Depends(get_db_session)],
) -> CatalogListResponseV2:
    return build_xingce_categories(session)


@router.get("/xingce/papers", response_model=CatalogListResponseV2)
def list_xingce_papers(
    session: Annotated[Session, Depends(get_db_session)],
) -> CatalogListResponseV2:
    return build_xingce_papers(session)


@router.get("/essay/categories", response_model=CatalogListResponseV2)
def list_essay_categories(
    session: Annotated[Session, Depends(get_db_session)],
) -> CatalogListResponseV2:
    return build_essay_categories(session)


@router.get("/essay/papers", response_model=CatalogListResponseV2)
def list_essay_papers(
    session: Annotated[Session, Depends(get_db_session)],
) -> CatalogListResponseV2:
    return build_essay_papers(session)
