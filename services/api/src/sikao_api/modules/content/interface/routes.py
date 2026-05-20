from __future__ import annotations

from fastapi import APIRouter

from sikao_api.db.schemas_v2 import CatalogListResponseV2, PracticeCenterResponseV2
from sikao_api.modules.content.application.service import build_empty_catalog, build_practice_center_overview

router = APIRouter(prefix="/api/v2/practice", tags=["content-v2"])


@router.get("/center", response_model=PracticeCenterResponseV2)
def get_practice_center() -> PracticeCenterResponseV2:
    return build_practice_center_overview()


@router.get("/xingce/categories", response_model=CatalogListResponseV2)
def list_xingce_categories() -> CatalogListResponseV2:
    return build_empty_catalog(href_prefix="/practice/center/xingce/categories")


@router.get("/xingce/papers", response_model=CatalogListResponseV2)
def list_xingce_papers() -> CatalogListResponseV2:
    return build_empty_catalog(href_prefix="/practice/center/xingce/papers")


@router.get("/essay/categories", response_model=CatalogListResponseV2)
def list_essay_categories() -> CatalogListResponseV2:
    return build_empty_catalog(href_prefix="/practice/center/essay/categories")


@router.get("/essay/papers", response_model=CatalogListResponseV2)
def list_essay_papers() -> CatalogListResponseV2:
    return build_empty_catalog(href_prefix="/practice/center/essay/papers")
