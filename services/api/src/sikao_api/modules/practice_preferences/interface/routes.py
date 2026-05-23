from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import (
    PracticePreferencesPatchV2,
    PracticePreferencesResponseV2,
)
from sikao_api.db.session import get_db_session
from sikao_api.modules.identity.application.security_v2 import (
    get_current_user_v2,
    verify_csrf_v2,
)
from sikao_api.modules.practice_preferences.application.service import (
    PracticePreferencesService,
)
from sikao_api.modules.practice_preferences.domain.errors import (
    InvalidPatchPathError,
    InvalidPreferenceFieldError,
    InvalidResetSectionError,
    SchemaVersionMismatchError,
)
from sikao_api.modules.practice_preferences.domain.types import (
    CURRENT_PRACTICE_PREFERENCES_SCHEMA_VERSION,
)
from sikao_api.modules.practice_preferences.interface.schemas import (
    PracticePreferencesPatchRequestV2,
    PracticePreferencesPutRequestV2,
    PracticePreferencesResetRequestV2,
    PracticePreferencesWriteResponseV2,
)

router = APIRouter(
    prefix="/api/v2/profile/practice-preferences",
    tags=["practice-preferences"],
)


@router.get("", response_model=PracticePreferencesResponseV2)
def get_practice_preferences(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PracticePreferencesResponseV2:
    response = PracticePreferencesService(session).get_preferences(user=user)
    session.commit()
    return response


@router.put(
    "",
    response_model=PracticePreferencesWriteResponseV2,
    dependencies=[Depends(verify_csrf_v2)],
)
def put_practice_preferences(
    payload: PracticePreferencesPutRequestV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PracticePreferencesWriteResponseV2 | JSONResponse:
    service = PracticePreferencesService(session)
    try:
        result = service.put_preferences(
            user=user,
            schema_version=payload.schema_version,
            payload=payload.payload.model_dump(mode="json"),
        )
    except InvalidPreferenceFieldError as exc:
        return _invalid_preference_field_response(exc)
    except SchemaVersionMismatchError as exc:
        return _schema_mismatch_response(exc)
    session.commit()
    return _write_response(result)


@router.patch(
    "",
    response_model=PracticePreferencesWriteResponseV2,
    dependencies=[Depends(verify_csrf_v2)],
)
def patch_practice_preferences(
    payload: PracticePreferencesPatchRequestV2,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PracticePreferencesWriteResponseV2 | JSONResponse:
    service = PracticePreferencesService(session)
    try:
        result = service.patch_preferences(
            user=user,
            schema_version=payload.schema_version,
            patches=[
                PracticePreferencesPatchV2(path=item.path, value=item.value)
                for item in payload.patches
            ],
        )
    except InvalidPatchPathError as exc:
        return JSONResponse(
            status_code=422,
            content={
                "detail": exc.message,
                "code": "invalid_patch_path",
                "path": exc.path,
                "message": exc.message,
            },
        )
    except InvalidPreferenceFieldError as exc:
        return _invalid_preference_field_response(exc)
    except SchemaVersionMismatchError as exc:
        return _schema_mismatch_response(exc)
    session.commit()
    return _write_response(result)


@router.post(
    "/reset",
    response_model=PracticePreferencesWriteResponseV2,
    dependencies=[Depends(verify_csrf_v2)],
)
def reset_practice_preferences(
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    payload: PracticePreferencesResetRequestV2 | None = None,
) -> PracticePreferencesWriteResponseV2 | JSONResponse:
    service = PracticePreferencesService(session)
    try:
        result = service.reset_preferences(
            user=user,
            sections=[] if payload is None else list(payload.sections),
        )
    except InvalidResetSectionError as exc:
        return JSONResponse(
            status_code=422,
            content={
                "detail": exc.message,
                "code": "invalid_reset_section",
                "section": exc.section,
                "message": exc.message,
            },
        )
    except InvalidPreferenceFieldError as exc:
        return _invalid_preference_field_response(exc)
    session.commit()
    return _write_response(result)


def _write_response(
    response: PracticePreferencesResponseV2,
) -> PracticePreferencesWriteResponseV2:
    return PracticePreferencesWriteResponseV2(
        schema_version=response.schema_version,
        payload=response.payload,
        updated_at=response.updated_at,
    )


def _invalid_preference_field_response(
    exc: InvalidPreferenceFieldError,
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "detail": exc.message,
            "code": "invalid_preference_field",
            "field": exc.field,
            "message": exc.message,
        },
    )


def _schema_mismatch_response(exc: SchemaVersionMismatchError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "detail": "schema version mismatch",
            "code": "schema_version_mismatch",
            "schemaVersion": CURRENT_PRACTICE_PREFERENCES_SCHEMA_VERSION,
            "payload": exc.payload.model_dump(mode="json", by_alias=True),
        },
    )
