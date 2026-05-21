from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import (
    AccountDeletionRequestV2,
    AccountDeletionResponseV2,
    BindPhoneRequestV2,
    LearningRecordListResponseV2,
    ProfileGoalsResponseV2,
    ProfileGoalsUpdateRequestV2,
    ProfileInfoResponseV2,
    ProfileInfoUpdateRequestV2,
    ProfileOverviewResponseV2,
    ProfilePreferencesResponseV2,
    ProfilePreferencesUpdateRequestV2,
    ProfileSecurityResponseV2,
    ProfileSecurityUpdateRequestV2,
    ProfileSettingsResponseV2,
    ProfileSettingsUpdateRequestV2,
)
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import get_current_user_v2, verify_csrf_v2
from sikao_api.modules.profile_v2.application.service import ProfileServiceV2
from sikao_api.modules.record.application.service import build_learning_record_list

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


@router.get("/records", response_model=LearningRecordListResponseV2)
def get_profile_records(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    page: int = 1,
    size: int = 20,
    kind: str | None = None,
    status: str | None = None,
    from_date: Annotated[date | None, Query(alias="from")] = None,
    to_date: date | None = None,
    session_id: int | None = None,
) -> LearningRecordListResponseV2:
    return build_learning_record_list(
        session,
        user=user,
        page=page,
        size=size,
        kind=kind,
        status=status,
        from_date=from_date,
        to_date=to_date,
        session_id=session_id,
    )



# --- PR-P1: Settings ---


@router.get("/settings", response_model=ProfileSettingsResponseV2)
def get_profile_settings(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ProfileSettingsResponseV2:
    return ProfileServiceV2(session).get_settings(user=user)


@router.put(
    "/settings",
    response_model=ProfileSettingsResponseV2,
    dependencies=[Depends(verify_csrf_v2)],
)
def put_profile_settings(
    payload: ProfileSettingsUpdateRequestV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ProfileSettingsResponseV2:
    result = ProfileServiceV2(session).update_settings(user=user, payload=payload)
    session.commit()
    return result


# --- PR-P2: Preferences ---


@router.get("/preferences", response_model=ProfilePreferencesResponseV2)
def get_profile_preferences(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ProfilePreferencesResponseV2:
    return ProfileServiceV2(session).get_preferences(user=user)


@router.put(
    "/preferences",
    response_model=ProfilePreferencesResponseV2,
    dependencies=[Depends(verify_csrf_v2)],
)
def put_profile_preferences(
    payload: ProfilePreferencesUpdateRequestV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> ProfilePreferencesResponseV2:
    result = ProfileServiceV2(session).update_preferences(user=user, payload=payload)
    session.commit()
    return result


# --- PR-P3: Account Deletion ---


@router.delete(
    "/account",
    response_model=AccountDeletionResponseV2,
    dependencies=[Depends(verify_csrf_v2)],
)
def delete_profile_account(
    payload: AccountDeletionRequestV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> AccountDeletionResponseV2:
    result = ProfileServiceV2(session).request_deletion(user=user, payload=payload)
    session.commit()
    return result


# --- PR-P4: Bind Phone stub ---


@router.post("/bind-phone", status_code=501)
def post_bind_phone(
    payload: BindPhoneRequestV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> dict[str, str]:
    try:
        ProfileServiceV2(session).bind_phone_stub(user=user, payload=payload)
    except NotImplementedError:
        return {"detail": "bind-phone not yet implemented"}
    return {"detail": "bind-phone not yet implemented"}
