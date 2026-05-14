from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.core.deps import get_app_settings
from sikao_api.db.session import get_db_session
from sikao_api.db import schemas
from sikao_api.modules.system.application.ops import OpsService

router = APIRouter(prefix="/api/v2/system", tags=["system-v2"])


@router.get("/bootstrap", response_model=schemas.BootstrapResponseV2)
def bootstrap(
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> schemas.BootstrapResponseV2:
    return OpsService(session, settings).bootstrap()
