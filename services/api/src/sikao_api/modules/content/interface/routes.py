from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import CatalogListResponseV2, PracticeCenterResponseV2
from sikao_api.db.session import get_db_session
from sikao_api.modules.content.application.service import (
    DifficultyFilter,
    PaperSort,
    build_practice_center_overview,
    build_essay_categories,
    build_essay_papers,
    build_xingce_categories,
    build_xingce_papers,
)
from sikao_api.modules.identity.application.security_v2 import get_optional_current_user_v2
from sikao_api.modules.system.application.errors import ValidationError

router = APIRouter(prefix="/api/v2/practice", tags=["content-v2"])


def _resolve_optional_query_text(
    *,
    request: Request,
    canonical_name: str,
    legacy_name: str,
    canonical_value: str | None,
    max_length: int,
) -> str | None:
    legacy_value = request.query_params.get(legacy_name)
    if canonical_value is not None and legacy_value is not None and canonical_value != legacy_value:
        raise ValidationError(
            f"{canonical_name} conflicts with {legacy_name}",
            code=f"{canonical_name}_query_conflict",
        )

    value = canonical_value if canonical_value is not None else legacy_value
    if value is None:
        return None
    if value == "":
        raise ValidationError(
            f"{canonical_name} must not be empty",
            code=f"{canonical_name}_query_empty",
        )
    if len(value) > max_length:
        raise ValidationError(
            f"{canonical_name} must be <= {max_length} characters",
            code=f"{canonical_name}_query_too_long",
        )
    return value


@router.get("/center", response_model=PracticeCenterResponseV2)
def get_practice_center(
    session: Annotated[Session, Depends(get_db_session)],
) -> PracticeCenterResponseV2:
    return build_practice_center_overview(session)


@router.get("/xingce/categories", response_model=CatalogListResponseV2)
def list_xingce_categories(
    request: Request,
    session: Annotated[Session, Depends(get_db_session)],
    level: Annotated[int, Query(ge=1, le=2)] = 1,
    category_l1: Annotated[str | None, Query(alias="category_l1", max_length=64)] = None,
) -> CatalogListResponseV2:
    resolved_category_l1 = _resolve_optional_query_text(
        request=request,
        canonical_name="category_l1",
        legacy_name="categoryL1",
        canonical_value=category_l1,
        max_length=64,
    )
    return build_xingce_categories(session, level=level, category_l1=resolved_category_l1)


@router.get("/xingce/papers", response_model=CatalogListResponseV2)
def list_xingce_papers(
    request: Request,
    session: Annotated[Session, Depends(get_db_session)],
    user: Annotated[UserV2 | None, Depends(get_optional_current_user_v2)] = None,
    category_l1: Annotated[str | None, Query(alias="category_l1", max_length=64)] = None,
    category_l2: Annotated[str | None, Query(alias="category_l2", max_length=64)] = None,
    year: Annotated[int | None, Query(ge=1900, le=2100)] = None,
    region: Annotated[str | None, Query(max_length=64)] = None,
    exam_type: Annotated[str | None, Query(alias="exam_type", max_length=32)] = None,
    difficulty: Annotated[DifficultyFilter | None, Query()] = None,
    sort: Annotated[PaperSort, Query()] = "year_desc",
) -> CatalogListResponseV2:
    resolved_category_l1 = _resolve_optional_query_text(
        request=request,
        canonical_name="category_l1",
        legacy_name="categoryL1",
        canonical_value=category_l1,
        max_length=64,
    )
    resolved_category_l2 = _resolve_optional_query_text(
        request=request,
        canonical_name="category_l2",
        legacy_name="categoryL2",
        canonical_value=category_l2,
        max_length=64,
    )
    resolved_exam_type = _resolve_optional_query_text(
        request=request,
        canonical_name="exam_type",
        legacy_name="examType",
        canonical_value=exam_type,
        max_length=32,
    )
    return build_xingce_papers(
        session,
        user_id=user.id if user is not None else None,
        category_l1=resolved_category_l1,
        category_l2=resolved_category_l2,
        year=year,
        region=region,
        exam_type=resolved_exam_type,
        difficulty=difficulty,
        sort=sort,
    )


@router.get("/essay/categories", response_model=CatalogListResponseV2)
def list_essay_categories(
    request: Request,
    session: Annotated[Session, Depends(get_db_session)],
    level: Annotated[int, Query(ge=1, le=2)] = 1,
    category_l1: Annotated[str | None, Query(alias="category_l1", max_length=64)] = None,
) -> CatalogListResponseV2:
    resolved_category_l1 = _resolve_optional_query_text(
        request=request,
        canonical_name="category_l1",
        legacy_name="categoryL1",
        canonical_value=category_l1,
        max_length=64,
    )
    return build_essay_categories(session, level=level, category_l1=resolved_category_l1)


@router.get("/essay/papers", response_model=CatalogListResponseV2)
def list_essay_papers(
    request: Request,
    session: Annotated[Session, Depends(get_db_session)],
    user: Annotated[UserV2 | None, Depends(get_optional_current_user_v2)] = None,
    category_l1: Annotated[str | None, Query(alias="category_l1", max_length=64)] = None,
    category_l2: Annotated[str | None, Query(alias="category_l2", max_length=64)] = None,
    year: Annotated[int | None, Query(ge=1900, le=2100)] = None,
    region: Annotated[str | None, Query(max_length=64)] = None,
    exam_type: Annotated[str | None, Query(alias="exam_type", max_length=32)] = None,
    sort: Annotated[PaperSort, Query()] = "year_desc",
) -> CatalogListResponseV2:
    resolved_category_l1 = _resolve_optional_query_text(
        request=request,
        canonical_name="category_l1",
        legacy_name="categoryL1",
        canonical_value=category_l1,
        max_length=64,
    )
    resolved_category_l2 = _resolve_optional_query_text(
        request=request,
        canonical_name="category_l2",
        legacy_name="categoryL2",
        canonical_value=category_l2,
        max_length=64,
    )
    resolved_exam_type = _resolve_optional_query_text(
        request=request,
        canonical_name="exam_type",
        legacy_name="examType",
        canonical_value=exam_type,
        max_length=32,
    )
    return build_essay_papers(
        session,
        user_id=user.id if user is not None else None,
        category_l1=resolved_category_l1,
        category_l2=resolved_category_l2,
        year=year,
        region=region,
        exam_type=resolved_exam_type,
        sort=sort,
    )
