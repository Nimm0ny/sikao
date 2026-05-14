from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.core.deps import get_app_settings
from sikao_api.db.session import get_db_session
from sikao_api.db import schemas
from sikao_api.modules.system.application.ops import OpsService

router = APIRouter(tags=["ops"])


@router.get("/healthz", response_model=schemas.HealthResponse)
def healthz(
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> schemas.HealthResponse:
    return OpsService(session, settings).healthz()


@router.get("/readyz", response_model=schemas.ReadyzResponse)
def readyz(
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> schemas.ReadyzResponse:
    return OpsService(session, settings).readyz()


@router.get("/version", response_model=schemas.VersionResponse)
def version(
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> schemas.VersionResponse:
    return OpsService(session, settings).version()


@router.get("/version.json", response_model=schemas.VersionResponse)
def version_json(
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> schemas.VersionResponse:
    return OpsService(session, settings).version()
