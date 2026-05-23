from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Header, Request
from sqlalchemy.orm import Session

from sikao_api.core.limiter import identifier_by_ip, make_limiter
from sikao_api.core.config import Settings
from sikao_api.core.deps import get_app_settings
from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import (
    EssayGradingResponseV2,
    EssayReferenceAnswerEnvelopeV2,
    OperationAckV2,
)
from sikao_api.db.session import get_db_session
from sikao_api.modules.essay_grading.application.background_grader import (
    grade_submission_async,
    mark_submission_failed,
)
from sikao_api.modules.essay_grading.application.reference_feedback import (
    create_reference_feedback,
    delete_reference_feedback,
)
from sikao_api.modules.essay_grading.application.reference_generator_runner import (
    generate_reference_answer_async,
    queue_reference_generation,
)
from sikao_api.modules.essay_grading.application.reference_query import (
    list_public_reference_answers,
)
from sikao_api.modules.essay_grading.application.service import (
    PracticeEssayGradingService,
)
from sikao_api.modules.essay_grading.interface.schemas import (
    EssayReferenceGenerateRequestV2,
    EssayReferenceReportRequestV2,
)
from sikao_api.modules.identity.application.security_v2 import (
    get_current_user_v2,
    verify_csrf_v2,
)
from sikao_api.modules.llm.application.idempotency import (
    build_idempotent_request_hash,
    claim_idempotency_key,
    get_replay,
    release_idempotency_claim,
    store_replay,
    validate_idempotency_key,
)

router = APIRouter(prefix="/api/v2/practice/essay", tags=["essay-grading-v2"])


async def identifier_by_user_id(request: Request) -> str:
    user_id = getattr(request.state, "current_user_v2_id", None)
    if isinstance(user_id, int):
        return f"user:{user_id}"
    return await identifier_by_ip(request)


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


@router.get(
    "/questions/{question_id}/reference-answers",
    response_model=list[EssayReferenceAnswerEnvelopeV2],
    dependencies=[
        Depends(get_current_user_v2),
        Depends(make_limiter(times=120, minutes=1, identifier=identifier_by_user_id)),
    ],
)
def get_reference_answers(
    question_id: int,
    session: Annotated[Session, Depends(get_db_session)],
) -> list[EssayReferenceAnswerEnvelopeV2]:
    return list_public_reference_answers(session, question_id=question_id)


@router.post(
    "/reference-answers/{reference_id}/like",
    response_model=EssayReferenceAnswerEnvelopeV2,
    dependencies=[
        Depends(get_current_user_v2),
        Depends(verify_csrf_v2),
        Depends(make_limiter(times=60, minutes=1, identifier=identifier_by_user_id)),
    ],
)
def post_reference_like(
    reference_id: int,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> EssayReferenceAnswerEnvelopeV2:
    result = create_reference_feedback(
        session,
        user=user,
        reference_id=reference_id,
        action="like",
        note=None,
        request_id=getattr(request.state, "request_id", None),
    )
    session.commit()
    return result


@router.delete(
    "/reference-answers/{reference_id}/like",
    response_model=EssayReferenceAnswerEnvelopeV2,
    dependencies=[
        Depends(get_current_user_v2),
        Depends(verify_csrf_v2),
        Depends(make_limiter(times=60, minutes=1, identifier=identifier_by_user_id)),
    ],
)
def delete_reference_like(
    reference_id: int,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> EssayReferenceAnswerEnvelopeV2:
    result = delete_reference_feedback(
        session,
        user=user,
        reference_id=reference_id,
        action="like",
        request_id=getattr(request.state, "request_id", None),
    )
    session.commit()
    return result


@router.post(
    "/reference-answers/{reference_id}/favorite",
    response_model=EssayReferenceAnswerEnvelopeV2,
    dependencies=[
        Depends(get_current_user_v2),
        Depends(verify_csrf_v2),
        Depends(make_limiter(times=60, minutes=1, identifier=identifier_by_user_id)),
    ],
)
def post_reference_favorite(
    reference_id: int,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> EssayReferenceAnswerEnvelopeV2:
    result = create_reference_feedback(
        session,
        user=user,
        reference_id=reference_id,
        action="favorite",
        note=None,
        request_id=getattr(request.state, "request_id", None),
    )
    session.commit()
    return result


@router.delete(
    "/reference-answers/{reference_id}/favorite",
    response_model=EssayReferenceAnswerEnvelopeV2,
    dependencies=[
        Depends(get_current_user_v2),
        Depends(verify_csrf_v2),
        Depends(make_limiter(times=60, minutes=1, identifier=identifier_by_user_id)),
    ],
)
def delete_reference_favorite(
    reference_id: int,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> EssayReferenceAnswerEnvelopeV2:
    result = delete_reference_feedback(
        session,
        user=user,
        reference_id=reference_id,
        action="favorite",
        request_id=getattr(request.state, "request_id", None),
    )
    session.commit()
    return result


@router.post(
    "/reference-answers/{reference_id}/report",
    response_model=EssayReferenceAnswerEnvelopeV2,
    dependencies=[
        Depends(get_current_user_v2),
        Depends(verify_csrf_v2),
        Depends(make_limiter(times=60, minutes=1, identifier=identifier_by_user_id)),
    ],
)
def post_reference_report(
    reference_id: int,
    payload: EssayReferenceReportRequestV2,
    request: Request,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
) -> EssayReferenceAnswerEnvelopeV2:
    result = create_reference_feedback(
        session,
        user=user,
        reference_id=reference_id,
        action="report",
        note=payload.note,
        request_id=getattr(request.state, "request_id", None),
    )
    session.commit()
    return result


@router.post(
    "/reference-answers/generate",
    response_model=OperationAckV2,
    dependencies=[
        Depends(get_current_user_v2),
        Depends(verify_csrf_v2),
        Depends(make_limiter(times=10, hours=24, identifier=identifier_by_user_id)),
    ],
)
def post_generate_reference_answer(
    payload: EssayReferenceGenerateRequestV2,
    request: Request,
    background_tasks: BackgroundTasks,
    user: Annotated[UserV2, Depends(get_current_user_v2)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> OperationAckV2:
    validate_idempotency_key(idempotency_key or "")
    request_hash = build_idempotent_request_hash(
        payload={"questionId": payload.question_id}
    )
    replay = get_replay(
        session,
        user_id=user.id,
        endpoint="practice.essay_reference.generate",
        idempotency_key=idempotency_key or "",
        request_hash=request_hash,
    )
    if replay is not None:
        return OperationAckV2.model_validate(replay)

    claim_idempotency_key(
        session,
        user_id=user.id,
        endpoint="practice.essay_reference.generate",
        idempotency_key=idempotency_key or "",
        request_hash=request_hash,
    )
    try:
        response = queue_reference_generation(
            session,
            user=user,
            question_id=payload.question_id,
            request_id=getattr(request.state, "request_id", None),
        )
        if response.status == "queued":
            background_tasks.add_task(
                generate_reference_answer_async,
                request.app.state.db.session_factory,
                settings,
                user_id=user.id,
                question_id=payload.question_id,
                actor_type="user",
                actor_id=str(user.id),
                action=None,
                request_id=getattr(request.state, "request_id", None),
            )
        store_replay(
            session,
            user_id=user.id,
            endpoint="practice.essay_reference.generate",
            idempotency_key=idempotency_key or "",
            request_hash=request_hash,
            response_body=response.model_dump(mode="json"),
        )
        session.commit()
    except Exception:
        session.rollback()
        with request.app.state.db.session_factory() as recovery_session:
            release_idempotency_claim(
                recovery_session,
                user_id=user.id,
                endpoint="practice.essay_reference.generate",
                idempotency_key=idempotency_key or "",
                request_hash=request_hash,
            )
        raise
    return response
