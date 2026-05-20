from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from sikao_api.db.schemas_v2 import DashboardRecordsResponseV2
from sikao_api.db.session import get_db_session
from sikao_api.db.models_v2 import UserV2
from sikao_api.modules.identity.application.security_v2 import get_current_user_v2
from sikao_api.modules.record.application.service import build_dashboard_records

router = APIRouter(prefix="/api/v2/dashboard", tags=["record-v2"])


@router.get("/records", response_model=DashboardRecordsResponseV2)
def get_dashboard_records(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> DashboardRecordsResponseV2:
    return build_dashboard_records(session, user=user)
