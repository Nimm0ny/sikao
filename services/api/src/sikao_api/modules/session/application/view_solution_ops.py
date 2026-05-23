from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeSessionAnswerV2, UserV2
from sikao_api.db.schemas_v2 import PracticeSessionItemV2
from sikao_api.modules.mock_exam.application.enforcer import assert_can_view_solution
from sikao_api.modules.session.application.answer_lookup import load_session_answer
from sikao_api.modules.session.application.answer_item_state import (
    has_meaningful_answer,
    serialize_answer_item,
)
from sikao_api.modules.system.application.errors import ForbiddenError


def mark_view_solution(
    session: Session,
    *,
    user: UserV2,
    session_id: int,
    answer_id: int,
) -> PracticeSessionItemV2:
    practice_session, answer = load_session_answer(session, user_id=user.id, session_id=session_id, answer_id=answer_id)
    now = datetime.now(UTC).replace(tzinfo=None)
    if practice_session.practice_mode == "full_set" and practice_session.status != "submitted":
        raise ForbiddenError("strict closed book", code="STRICT_CLOSED_BOOK")
    assert_can_view_solution(practice_session, now=now)
    if practice_session.practice_mode == "full_set" and not _session_has_meaningful_answer(session, session_id=session_id):
        raise ForbiddenError("strict closed book", code="STRICT_CLOSED_BOOK")
    answer.viewed_solution = True
    answer.view_solution_at = now
    session.add(answer)
    session.flush()
    return serialize_answer_item(session, practice_session=practice_session, answer=answer)


def _session_has_meaningful_answer(session: Session, *, session_id: int) -> bool:
    rows = session.scalars(
        select(PracticeSessionAnswerV2.response_json).where(
            PracticeSessionAnswerV2.session_id == session_id
        )
    )
    return any(has_meaningful_answer(payload) for payload in rows)
