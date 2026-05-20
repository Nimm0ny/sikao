from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import ProfileGoalsResponseV2, ProfileGoalsUpdateRequestV2, ProfileInfoResponseV2, ProfileInfoUpdateRequestV2, ProfileOverviewResponseV2, ProfileSecurityResponseV2, ProfileSecurityUpdateRequestV2
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import get_current_user_v2, verify_csrf_v2
from sikao_api.modules.profile_v2.application.service import ProfileServiceV2

router = APIRouter(prefix="/api/v2/profile", tags=["profile-v2"])


@router.get("/overview", response_model=ProfileOverviewResponseV2)
def get_profile_overview(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ProfileOverviewResponseV2:
    return ProfileServiceV2(session).build_overview(user=user)


@router.get("/security", response_model=ProfileSecurityResponseV2)
def get_profile_security(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ProfileSecurityResponseV2:
    return ProfileServiceV2(session).get_security(user=user)


@router.put("/security", response_model=ProfileSecurityResponseV2, dependencies=[Depends(verify_csrf_v2)])
def put_profile_security(
    payload: ProfileSecurityUpdateRequestV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ProfileSecurityResponseV2:
    result = ProfileServiceV2(session).update_security(user=user, payload=payload)
    session.commit()
    return result


@router.get("/goals", response_model=ProfileGoalsResponseV2)
def get_profile_goals(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ProfileGoalsResponseV2:
    return ProfileServiceV2(session).get_goals(user=user)


@router.put("/goals", response_model=ProfileGoalsResponseV2, dependencies=[Depends(verify_csrf_v2)])
def put_profile_goals(
    payload: ProfileGoalsUpdateRequestV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ProfileGoalsResponseV2:
    result = ProfileServiceV2(session).update_goals(user=user, payload=payload)
    session.commit()
    return result


@router.get("/info", response_model=ProfileInfoResponseV2)
def get_profile_info(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ProfileInfoResponseV2:
    return ProfileServiceV2(session).get_info(user=user)


@router.put("/info", response_model=ProfileInfoResponseV2, dependencies=[Depends(verify_csrf_v2)])
def put_profile_info(
    payload: ProfileInfoUpdateRequestV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ProfileInfoResponseV2:
    result = ProfileServiceV2(session).update_info(user=user, payload=payload)
    session.commit()
    return result
