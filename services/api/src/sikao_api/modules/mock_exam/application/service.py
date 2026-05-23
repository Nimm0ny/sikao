from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PaperRevisionV2, PaperV2, PracticeSessionAnswerV2, PracticeSessionV2, QuestionV2, UserV2
from sikao_api.db.schemas_v2 import MockExamCreateRequestV2, MockExamCreateResponseV2
from sikao_api.modules.mock_exam.domain.errors import PAPER_NOT_FOUND, PAPER_NOT_MOCK_ELIGIBLE
from sikao_api.modules.mock_exam.domain.types import DEFAULT_ESSAY_TIME_LIMIT_MINUTES, DEFAULT_XINGCE_TIME_LIMIT_MINUTES, MIN_MOCK_EXAM_QUESTION_COUNT
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.modules.system.application.errors import ValidationError


def create_mock_exam(
    session: Session,
    *,
    user: UserV2,
    payload: MockExamCreateRequestV2,
    request_id: str | None,
    idempotency_key: str,
) -> MockExamCreateResponseV2:
    paper = session.scalar(select(PaperV2).where(PaperV2.paper_code == payload.paper_code))
    if paper is None:
        raise ValidationError("paper not found", code=PAPER_NOT_FOUND)

    revision = session.scalar(
        select(PaperRevisionV2)
        .where(
            PaperRevisionV2.paper_id == paper.id,
            PaperRevisionV2.status == "published",
        )
        .order_by(PaperRevisionV2.revision_number.desc(), PaperRevisionV2.id.desc())
    )
    if revision is None:
        raise ValidationError("paper not found", code=PAPER_NOT_FOUND)

    questions = list(
        session.scalars(
            select(QuestionV2)
            .where(QuestionV2.revision_id == revision.id)
            .order_by(QuestionV2.item_no.asc(), QuestionV2.id.asc())
        )
    )
    if len(questions) < MIN_MOCK_EXAM_QUESTION_COUNT:
        raise ValidationError(
            "paper is not eligible for mock exam",
            code=PAPER_NOT_MOCK_ELIGIBLE,
        )

    resolved_time_limit = payload.time_limit_minutes or _default_time_limit_minutes(paper.subject_kind)
    created_at = datetime.now(UTC).replace(tzinfo=None)
    practice_session = PracticeSessionV2(
        user_id=user.id,
        track=paper.subject_kind,
        entry_kind="mock_exam",
        status="draft",
        paper_id=paper.id,
        revision_id=revision.id,
        payload_json={},
        started_at=created_at,
        practice_mode="full_set",
        source_mode="paper",
        config_snapshot={
            "mock_exam": {
                "delayed_review_minutes": payload.delayed_review_minutes,
            }
        },
        exam_mode=True,
        time_limit_minutes=resolved_time_limit,
        allow_review_during=False,
        allow_pause=False,
        delayed_review_until=None,
    )
    session.add(practice_session)
    session.flush()

    for display_order, question in enumerate(questions, start=1):
        session.add(
            PracticeSessionAnswerV2(
                session_id=practice_session.id,
                question_id=question.id,
                question_key=str(question.id),
                display_order=display_order,
                response_json={},
            )
        )

    add_audit_log(
        session,
        user_id=user.id,
        actor_type="user",
        actor_id=str(user.id),
        action="mock_exam.created",
        target_type="practice_session_v2",
        target_id=practice_session.id,
        after={
            "paper_code": paper.paper_code,
            "time_limit_minutes": resolved_time_limit,
            "delayed_review_minutes": payload.delayed_review_minutes,
        },
        metadata={"idempotency_key": idempotency_key},
        request_id=request_id,
        ip=None,
    )
    session.flush()
    return MockExamCreateResponseV2(
        session_id=practice_session.id,
        paper_code=paper.paper_code,
        time_limit_minutes=resolved_time_limit,
        auto_submit_at=practice_session.auto_submit_at,
        expires_at=practice_session.expires_at,
        status=practice_session.status,
    )


def _default_time_limit_minutes(track: str) -> int:
    if track == "essay":
        return DEFAULT_ESSAY_TIME_LIMIT_MINUTES
    return DEFAULT_XINGCE_TIME_LIMIT_MINUTES
