from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Header, Request
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.core.deps import get_app_settings
from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import EssayGradingResponseV2
from sikao_api.db.session import get_db_session
from sikao_api.modules.essay_grading.application.background_grader import (
    grade_submission_async,
    mark_submission_failed,
)
from sikao_api.modules.essay_grading.application.service import (
    PracticeEssayGradingService,
)
from sikao_api.modules.identity.application.security_v2 import (
    get_current_user_v2,
    verify_csrf_v2,
)
from sikao_api.modules.llm.application.idempotency import (
    claim_idempotency_key,
    get_replay,
    release_idempotency_claim,
    store_replay,
    validate_idempotency_key,
)

router = APIRouter(prefix="/api/v2/practice/essay", tags=["essay-grading-v2"])


@router.post(
    "/submissions/{submission_id}/grade",
    response_model=EssayGradingResponseV2,
    dependencies=[Depends(verify_csrf_v2)],
)
def trigger_essay_grading(
    submission_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> EssayGradingResponseV2:
    validate_idempotency_key(idempotency_key or "")
    service = PracticeEssayGradingService(session, settings)
    request_hash = service.build_idempotent_request_hash(submission_id=submission_id)
    replay = get_replay(
        session,
        user_id=user.id,
        endpoint="practice.essay_submissions.grade",
        idempotency_key=idempotency_key or "",
        request_hash=request_hash,
    )
    if replay is not None:
        return EssayGradingResponseV2.model_validate(replay)

    claim_idempotency_key(
        session,
        user_id=user.id,
        endpoint="practice.essay_submissions.grade",
        idempotency_key=idempotency_key or "",
        request_hash=request_hash,
    )
    try:
        result = service.trigger_grading(user=user, submission_id=submission_id)
        session.commit()
    except Exception:
        release_idempotency_claim(
            session,
            user_id=user.id,
            endpoint="practice.essay_submissions.grade",
            idempotency_key=idempotency_key or "",
            request_hash=request_hash,
        )
        raise

    if result.schedule_needed:
        session_factory = request.app.state.db.session_factory
        try:
            background_tasks.add_task(
                grade_submission_async,
                session_factory,
                settings,
                submission_id,
            )
            store_replay(
                session,
                user_id=user.id,
                endpoint="practice.essay_submissions.grade",
                idempotency_key=idempotency_key or "",
                request_hash=request_hash,
                response_body=result.response.model_dump(mode="json"),
            )
            session.commit()
        except Exception as exc:
            session.rollback()
            with session_factory() as recovery_session:
                mark_submission_failed(
                    session=recovery_session,
                    submission_id=submission_id,
                    error_message=f"RuntimeError: trigger enqueue failed: {type(exc).__name__}: {exc}",
                )
                release_idempotency_claim(
                    recovery_session,
                    user_id=user.id,
                    endpoint="practice.essay_submissions.grade",
                    idempotency_key=idempotency_key or "",
                    request_hash=request_hash,
                )
                recovery_session.commit()
            raise
    else:
        store_replay(
            session,
            user_id=user.id,
            endpoint="practice.essay_submissions.grade",
            idempotency_key=idempotency_key or "",
            request_hash=request_hash,
            response_body=result.response.model_dump(mode="json"),
        )
        session.commit()
    return result.response


@router.get(
    "/submissions/{submission_id}/grading-status",
    response_model=EssayGradingResponseV2,
)
def get_essay_grading_status(
    submission_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> EssayGradingResponseV2:
    service = PracticeEssayGradingService(session, settings)
    submission = service.get_submission(user=user, submission_id=submission_id)
    return service.build_grading_response(submission=submission)


@router.get(
    "/submissions/{submission_id}/result",
    response_model=EssayGradingResponseV2,
)
def get_essay_grading_result(
    submission_id: int,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> EssayGradingResponseV2:
    service = PracticeEssayGradingService(session, settings)
    submission = service.get_submission(user=user, submission_id=submission_id)
    return service.build_grading_response(submission=submission)
