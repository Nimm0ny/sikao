from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeSessionV2, UserV2
from sikao_api.db.schemas_v2 import MockExamCountdownResponseV2
from sikao_api.modules.mock_exam.domain.errors import MOCK_EXAM_NOT_STARTED, NOT_MOCK_EXAM
from sikao_api.modules.system.application.errors import ConflictError, NotFoundError


def get_mock_exam_countdown(
    session: Session,
    *,
    user: UserV2,
    session_id: int,
) -> MockExamCountdownResponseV2:
    practice_session = session.scalar(
        select(PracticeSessionV2).where(
            PracticeSessionV2.id == session_id,
            PracticeSessionV2.user_id == user.id,
        )
    )
    if practice_session is None:
        raise NotFoundError("practice session not found", code="practice_session_not_found")
    if not practice_session.exam_mode:
        raise NotFoundError("mock exam not found", code=NOT_MOCK_EXAM)
    if practice_session.auto_submit_at is None or practice_session.first_question_at is None:
        raise ConflictError("mock exam has not started", code=MOCK_EXAM_NOT_STARTED)

    server_now = datetime.now(UTC).replace(tzinfo=None)
    remaining_seconds = max(
        0,
        int((practice_session.auto_submit_at - server_now).total_seconds()),
    )
    elapsed_seconds = max(
        0,
        int((server_now - practice_session.first_question_at).total_seconds()),
    )
    return MockExamCountdownResponseV2(
        server_now=server_now,
        auto_submit_at=practice_session.auto_submit_at,
        remaining_seconds=remaining_seconds,
        status=practice_session.status,
        elapsed_seconds=elapsed_seconds,
    )
